import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { WatchlistRepository } from '../../watchlist/repositories/WatchlistRepository';
import { UserRepository }      from '../../users/repositories/UserRepository';
import { EmailService }        from '../../email/services/EmailService';
import { CompanyRepository }   from '../../status/repositories/CompanyRepository';
import { logger }              from '../../../observability/logger';
import type { StatusIndicator } from '../../status/types/statuspage.types';
import { config } from '../../../config';

function alertType(prev: StatusIndicator, next: StatusIndicator): 'degraded' | 'recovered' | null {
  if (prev === next) return null;
  if (next === 'none') return 'recovered';
  if (prev === 'none') return 'degraded';
  return 'degraded'; // e.g. minor → major
}

@injectable()
export class AlertService {
  constructor(
    @inject(TOKENS.WatchlistRepository) private readonly watchlist: WatchlistRepository,
    @inject(TOKENS.UserRepository)      private readonly users: UserRepository,
    @inject(TOKENS.EmailService)        private readonly email: EmailService,
    @inject(TOKENS.CompanyRepository)   private readonly companies: CompanyRepository,
  ) {}

  async notifyStatusChange(opts: {
    companyId:     string;
    slug:          string;
    prevIndicator: StatusIndicator;
    nextIndicator: StatusIndicator;
    description:   string;
  }): Promise<void> {
    const type = alertType(opts.prevIndicator, opts.nextIndicator);
    if (!type) return;

    const [watchers, company] = await Promise.all([
      this.watchlist.findByCompanyId(opts.companyId),
      this.companies.findById(opts.companyId),
    ]);

    if (watchers.length === 0 || !company) return;

    const companyName = company.name;
    const statusUrl   = `${config.app.frontendUrl}/status/${opts.slug}`;

    logger.info('Sending status change alerts', {
      slug: opts.slug,
      type,
      recipients: watchers.length,
    });

    await Promise.allSettled(
      watchers.map(async (entry) => {
        const user = await this.users.findById(entry.userId);
        if (!user) return;

        await this.email.sendStatusChangeEmail({
          to:          user.email,
          firstName:   user.firstName,
          companyName,
          indicator:   opts.nextIndicator,
          description: opts.description,
          statusUrl,
          type,
        });
      }),
    );
  }
}
