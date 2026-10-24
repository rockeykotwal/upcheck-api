import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { StatusFetcherService } from './StatusFetcherService';
import { SnapshotRepository }   from '../repositories/SnapshotRepository';
import { AlertService }         from '../../alert/services/AlertService';
import { PredictionService }    from '../../ai/services/PredictionService';
import { PostmortemService }    from '../../ai/services/PostmortemService';
import { logger } from '../../../observability/logger';
import type { FetchResult } from '../types/statuspage.types';

@injectable()
export class StatusPollerService {
  constructor(
    @inject(TOKENS.StatusFetcherService) private readonly fetcher: StatusFetcherService,
    @inject(TOKENS.SnapshotRepository)   private readonly snapshots: SnapshotRepository,
    @inject(TOKENS.AlertService)         private readonly alerts: AlertService,
    @inject(TOKENS.PredictionService)    private readonly prediction: PredictionService,
    @inject(TOKENS.PostmortemService)    private readonly postmortem: PostmortemService,
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

    // Fire alerts, predictions, and postmortems — errors are swallowed so one
    // bad action doesn't abort the entire poll cycle
    await Promise.allSettled(
      succeeded.map((result, i) => {
        const prev = previous[i]?.indicator ?? null;
        return Promise.all([
          this.maybeAlert(result, prev),
          this.maybePrediction(result, prev),
          this.maybePostmortem(result, prev),
        ]);
      }),
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

  private async maybePrediction(result: FetchResult, _prev: string | null): Promise<void> {
    if (!result.status) return;
    const { companyId, slug, indicator } = result.status;
    if (indicator === 'none' || indicator === 'maintenance') return;
    try {
      await this.prediction.analyzeAndAlert(companyId, slug);
    } catch (err) {
      logger.warn('Prediction analysis failed', { slug, error: (err as Error).message });
    }
  }

  private async maybePostmortem(result: FetchResult, prev: string | null): Promise<void> {
    if (!result.status) return;
    const { companyId, slug, indicator } = result.status;
    // Trigger postmortem only on recovery: was degraded, now none
    if (!prev || prev === 'none' || indicator !== 'none') return;
    try {
      await this.postmortem.generateAndStore(companyId, slug);
    } catch (err) {
      logger.warn('Postmortem generation failed', { slug, error: (err as Error).message });
    }
  }
}
