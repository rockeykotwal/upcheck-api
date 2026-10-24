import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { SnapshotRepository }   from '../../status/repositories/SnapshotRepository';
import { CompanyRepository }    from '../../status/repositories/CompanyRepository';
import { WatchlistRepository }  from '../../watchlist/repositories/WatchlistRepository';
import { UserRepository }       from '../../users/repositories/UserRepository';
import { EmailService }         from '../../email/services/EmailService';
import { AppError } from '../../../errors/AppError';
import { config }   from '../../../config';
import type { AiProvider } from '../providers/AiProvider';
import type { StatusSnapshot } from '../../status/types/snapshot.types';

function buildPrompt(slug: string, history: StatusSnapshot[]): string {
  const lines = history.map(
    (s) => `- ${s.fetchedAt.toISOString()}: ${s.indicator} — ${s.description}`,
  );

  return [
    `You are an incident analyst. Summarize the recent status history for the service "${slug}" in 2-3 plain sentences.`,
    'Focus on what went wrong, when it started, and whether it has resolved.',
    'If everything looks normal, say so briefly.',
    '',
    'Recent status snapshots (newest first):',
    ...lines,
  ].join('\n');
}

@injectable()
export class AiService {
  constructor(
    @inject(TOKENS.AiProvider)          private readonly provider: AiProvider,
    @inject(TOKENS.SnapshotRepository)  private readonly snapshots: SnapshotRepository,
    @inject(TOKENS.CompanyRepository)   private readonly companies: CompanyRepository,
    @inject(TOKENS.WatchlistRepository) private readonly watchlist: WatchlistRepository,
    @inject(TOKENS.UserRepository)      private readonly users: UserRepository,
    @inject(TOKENS.EmailService)        private readonly email: EmailService,
  ) {}

  async summarize(slug: string): Promise<string> {
    const history = await this.snapshots.findRecentBySlug(slug, 20);

    if (!history.length) {
      throw new AppError(`No snapshot data found for "${slug}"`, 404);
    }

    return this.provider.complete(buildPrompt(slug, history));
  }

  async summarizeAndSend(slug: string): Promise<number> {
    const [history, company] = await Promise.all([
      this.snapshots.findRecentBySlug(slug, 20),
      this.companies.findBySlug(slug),
    ]);

    if (!history.length) throw new AppError(`No snapshot data found for "${slug}"`, 404);
    if (!company)        throw new AppError('Service not found', 404);

    const summary  = await this.provider.complete(buildPrompt(slug, history));
    const watchers = await this.watchlist.findByCompanyId(company.id);
    if (watchers.length === 0) return 0;

    const current    = history[0]!;
    const statusUrl  = `${config.app.frontendUrl}/status/${slug}`;

    const results = await Promise.allSettled(
      watchers.map(async (entry) => {
        const user = await this.users.findById(entry.userId);
        if (!user) return;
        await this.email.sendIncidentSummaryEmail({
          to:          user.email,
          firstName:   user.firstName,
          companyName: company.name,
          indicator:   current.indicator,
          summary,
          statusUrl,
        });
      }),
    );

    return results.filter((r) => r.status === 'fulfilled').length;
  }
}
