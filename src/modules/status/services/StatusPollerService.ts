import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { StatusFetcherService } from './StatusFetcherService';
import { SnapshotRepository }   from '../repositories/SnapshotRepository';
import { AlertService }         from '../../alert/services/AlertService';
import { logger } from '../../../observability/logger';
import type { FetchResult } from '../types/statuspage.types';

@injectable()
export class StatusPollerService {
  constructor(
    @inject(TOKENS.StatusFetcherService) private readonly fetcher: StatusFetcherService,
    @inject(TOKENS.SnapshotRepository)   private readonly snapshots: SnapshotRepository,
    @inject(TOKENS.AlertService)         private readonly alerts: AlertService,
  ) {}

  async poll(): Promise<void> {
    logger.info('Status poll started');

    const results   = await this.fetcher.fetchAll();
    const succeeded = results.filter((r) => r.ok);
    const failed    = results.length - succeeded.length;

    // Capture previous snapshots before overwriting
    const previous = await Promise.all(
      succeeded.map((r) => this.snapshots.findLatestBySlug(r.slug)),
    );

    await this.snapshots.saveMany(results);

    // Fire alerts for any indicator changes — errors are swallowed so one
    // bad alert doesn't abort the entire poll cycle
    await Promise.allSettled(
      succeeded.map((result, i) => this.maybeAlert(result, previous[i]?.indicator ?? null)),
    );

    logger.info('Status poll complete', { succeeded: succeeded.length, failed, total: results.length });
  }

  private async maybeAlert(
    result:   FetchResult,
    prevIndicator: string | null,
  ): Promise<void> {
    if (!result.status) return;
    const { companyId, slug, indicator, description } = result.status;
    if (!prevIndicator || prevIndicator === indicator) return;

    await this.alerts.notifyStatusChange({
      companyId,
      slug,
      prevIndicator: prevIndicator as never,
      nextIndicator: indicator,
      description,
    });
  }
}
