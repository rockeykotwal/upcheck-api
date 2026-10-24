import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { SnapshotRepository } from '../../status/repositories/SnapshotRepository';
import { PostmortemRepository } from '../../status/repositories/PostmortemRepository';
import { WatchlistRepository } from '../../watchlist/repositories/WatchlistRepository';
import { UserRepository } from '../../users/repositories/UserRepository';
import { CompanyRepository } from '../../status/repositories/CompanyRepository';
import { EmailService } from '../../email/services/EmailService';
import { logger } from '../../../observability/logger';
import { config } from '../../../config';
import type { AiProvider } from '../providers/AiProvider';
import type { StatusSnapshot } from '../../status/types/snapshot.types';
import type { StatusIndicator } from '../../status/types/statuspage.types';
import type { Postmortem } from '../../status/types/postmortem.types';

const SEVERITY_RANK: Record<StatusIndicator, number> = {
  none: 0,
  maintenance: 0,
  minor: 1,
  major: 2,
  critical: 3,
};

function getPeakIndicator(snapshots: StatusSnapshot[]): StatusIndicator {
  return snapshots.reduce<StatusIndicator>((peak, s) => {
    return SEVERITY_RANK[s.indicator] > SEVERITY_RANK[peak] ? s.indicator : peak;
  }, 'none');
}

function buildPrompt(
  slug: string,
  chronologicalSnapshots: StatusSnapshot[],
  startedAt: Date,
  resolvedAt: Date,
  durationMinutes: number,
  peakIndicator: StatusIndicator,
): string {
  const lines = chronologicalSnapshots
    .slice(0, 30)
    .map((s) => `- ${s.fetchedAt.toISOString()}: ${s.indicator} — ${s.description}`);

  return [
    `You are an incident analyst. Write a postmortem summary for the following resolved incident.`,
    '',
    `Service: ${slug}`,
    `Duration: ${durationMinutes} minutes`,
    `Started: ${startedAt.toISOString()}`,
    `Resolved: ${resolvedAt.toISOString()}`,
    `Peak severity: ${peakIndicator}`,
    '',
    'Incident timeline (oldest to newest):',
    ...lines,
    '',
    'Write a 3-4 sentence postmortem summary covering what happened, how severe it was, and when it resolved.',
    'Keep it factual, clear, and professional.',
  ].join('\n');
}

@injectable()
export class PostmortemService {
  constructor(
    @inject(TOKENS.AiProvider)             private readonly ai: AiProvider,
    @inject(TOKENS.SnapshotRepository)     private readonly snapshots: SnapshotRepository,
    @inject(TOKENS.PostmortemRepository)   private readonly postmortems: PostmortemRepository,
    @inject(TOKENS.WatchlistRepository)    private readonly watchlist: WatchlistRepository,
    @inject(TOKENS.UserRepository)         private readonly users: UserRepository,
    @inject(TOKENS.CompanyRepository)      private readonly companies: CompanyRepository,
    @inject(TOKENS.EmailService)           private readonly email: EmailService,
  ) {}

  async generateAndStore(companyId: string, slug: string): Promise<void> {
    const incidentWindow = await this.snapshots.findIncidentWindow(slug);
    if (incidentWindow.length === 0) {
      logger.warn('Empty incident window for postmortem', { slug });
      return;
    }

    // incidentWindow is sorted desc (newest first); oldest is last
    const resolvedAt = new Date();
    const startedAt  = incidentWindow[incidentWindow.length - 1]!.fetchedAt;
    const durationMinutes = Math.max(1, Math.round((resolvedAt.getTime() - startedAt.getTime()) / 60000));
    const peakIndicator   = getPeakIndicator(incidentWindow);

    // Reverse to get chronological order for the prompt
    const chronological = [...incidentWindow].reverse();
    const summary = await this.ai.complete(
      buildPrompt(slug, chronological, startedAt, resolvedAt, durationMinutes, peakIndicator),
    );

    const postmortem: Postmortem = {
      slug,
      companyId,
      startedAt,
      resolvedAt,
      durationMinutes,
      peakIndicator,
      snapshotCount: incidentWindow.length,
      summary,
      createdAt: new Date(),
    };

    await this.postmortems.save(postmortem);
    logger.info('Postmortem generated and stored', { slug, durationMinutes, peakIndicator });

    const [watchers, company] = await Promise.all([
      this.watchlist.findByCompanyId(companyId),
      this.companies.findById(companyId),
    ]);

    if (!company || watchers.length === 0) return;

    const statusUrl = `${config.app.frontendUrl}/status/${slug}`;

    await Promise.allSettled(
      watchers.map(async (entry) => {
        const user = await this.users.findById(entry.userId);
        if (!user) return;
        await this.email.sendPostmortemEmail({
          to:              user.email,
          firstName:       user.firstName,
          companyName:     company.name,
          durationMinutes,
          peakIndicator,
          summary,
          statusUrl,
        });
      }),
    );
  }
}
