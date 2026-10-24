import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { SnapshotRepository } from '../../status/repositories/SnapshotRepository';
import { WatchlistRepository } from '../../watchlist/repositories/WatchlistRepository';
import { UserRepository } from '../../users/repositories/UserRepository';
import { CompanyRepository } from '../../status/repositories/CompanyRepository';
import { EmailService } from '../../email/services/EmailService';
import { logger } from '../../../observability/logger';
import { getCache, setCache } from '../../../cache/redis';
import { config } from '../../../config';
import type { AiProvider } from '../providers/AiProvider';
import type { StatusSnapshot } from '../../status/types/snapshot.types';
import type { StatusIndicator } from '../../status/types/statuspage.types';

type RiskLevel = 'elevated' | 'high';

const SEVERITY_RANK: Record<StatusIndicator, number> = {
  none: 0,
  maintenance: 0,
  minor: 1,
  major: 2,
  critical: 3,
};

const DEDUP_TTL_SECONDS = 2 * 60 * 60; // 2 hours

function computeRiskScore(snapshots: StatusSnapshot[]): {
  score: number;
  nonNoneCount: number;
  hasEscalation: boolean;
} {
  const recent = snapshots.slice(0, 20);
  const nonNoneCount = recent.filter(
    (s) => s.indicator !== 'none' && s.indicator !== 'maintenance',
  ).length;

  let score = nonNoneCount;

  // Escalation: newer snapshot has higher severity than the one before it (desc order)
  const hasEscalation = recent.slice(0, 10).some((s, i, arr) => {
    if (i === arr.length - 1) return false;
    return SEVERITY_RANK[s.indicator] > SEVERITY_RANK[arr[i + 1]!.indicator];
  });
  if (hasEscalation) score += 5;

  const latest = recent[0];
  if (latest?.indicator === 'major') score += 2;
  if (latest?.indicator === 'critical') score += 4;

  // 3+ consecutive non-none in last 5 snapshots
  const consecutiveNonNone = recent
    .slice(0, 5)
    .filter((s) => s.indicator !== 'none' && s.indicator !== 'maintenance').length;
  if (consecutiveNonNone >= 3) score += 2;
  if (consecutiveNonNone >= 5) score += 2;

  return { score, nonNoneCount, hasEscalation };
}

function buildPrompt(
  slug: string,
  snapshots: StatusSnapshot[],
  nonNoneCount: number,
  hasEscalation: boolean,
): string {
  const latestIndicator = snapshots[0]?.indicator ?? 'unknown';
  const lines = snapshots
    .slice(0, 10)
    .map((s) => `- ${s.fetchedAt.toISOString()}: ${s.indicator} — ${s.description}`);

  return [
    `You are an incident monitoring assistant. The service "${slug}" is showing signs of potential escalation.`,
    '',
    `Recent activity: ${nonNoneCount} out of ${Math.min(snapshots.length, 20)} checks in the last ~20 minutes reported issues.`,
    hasEscalation ? 'The severity has been escalating over recent checks.' : '',
    `Current severity: ${latestIndicator}`,
    '',
    'Most recent status snapshots (newest first):',
    ...lines,
    '',
    'Write a concise predictive warning in 2-3 sentences for a user monitoring this service.',
    'Mention the pattern detected and what they should watch for. Be clear but not alarmist.',
  ]
    .filter(Boolean)
    .join('\n');
}

@injectable()
export class PredictionService {
  constructor(
    @inject(TOKENS.AiProvider)          private readonly ai: AiProvider,
    @inject(TOKENS.SnapshotRepository)  private readonly snapshots: SnapshotRepository,
    @inject(TOKENS.WatchlistRepository) private readonly watchlist: WatchlistRepository,
    @inject(TOKENS.UserRepository)      private readonly users: UserRepository,
    @inject(TOKENS.CompanyRepository)   private readonly companies: CompanyRepository,
    @inject(TOKENS.EmailService)        private readonly email: EmailService,
  ) {}

  async analyzeAndAlert(companyId: string, slug: string): Promise<void> {
    const recent = await this.snapshots.findRecentBySlug(slug, 20);
    if (recent.length < 5) return;

    const { score, nonNoneCount, hasEscalation } = computeRiskScore(recent);
    const riskLevel: RiskLevel | null = score >= 10 ? 'high' : score >= 5 ? 'elevated' : null;
    if (!riskLevel) return;

    const dedupKey = `prediction:alerted:${slug}:${riskLevel}`;
    const alreadyAlerted = await getCache<boolean>(dedupKey);
    if (alreadyAlerted) return;

    logger.info('Predictive alert triggered', { slug, riskLevel, score });

    const warningText = await this.ai.complete(buildPrompt(slug, recent, nonNoneCount, hasEscalation));

    const [watchers, company] = await Promise.all([
      this.watchlist.findByCompanyId(companyId),
      this.companies.findById(companyId),
    ]);

    await setCache(dedupKey, true, DEDUP_TTL_SECONDS);

    if (!company || watchers.length === 0) return;

    const statusUrl = `${config.app.frontendUrl}/status/${slug}`;

    await Promise.allSettled(
      watchers.map(async (entry) => {
        const user = await this.users.findById(entry.userId);
        if (!user) return;
        await this.email.sendPredictionAlertEmail({
          to:          user.email,
          firstName:   user.firstName,
          companyName: company.name,
          riskLevel,
          warningText,
          statusUrl,
        });
      }),
    );
  }
}
