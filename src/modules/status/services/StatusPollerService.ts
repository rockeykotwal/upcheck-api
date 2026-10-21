import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { StatusFetcherService } from './StatusFetcherService';
import { SnapshotRepository } from '../repositories/SnapshotRepository';
import { logger } from '../../../observability/logger';

@injectable()
export class StatusPollerService {
  constructor(
    @inject(TOKENS.StatusFetcherService) private readonly fetcher: StatusFetcherService,
    @inject(TOKENS.SnapshotRepository)   private readonly snapshots: SnapshotRepository,
  ) {}

  async poll(): Promise<void> {
    logger.info('Status poll started');

    const results = await this.fetcher.fetchAll();

    const succeeded = results.filter((r) => r.ok).length;
    const failed    = results.length - succeeded;

    await this.snapshots.saveMany(results);

    logger.info('Status poll complete', { succeeded, failed, total: results.length });
  }
}
