import 'reflect-metadata';
import { container } from '../container';
import { TOKENS } from '../tokens';
import { StatusPollerService } from '../modules/status/services/StatusPollerService';
import { logger } from '../observability/logger';

const INTERVAL_MS = 1 * 60 * 1_000; // 1 minute

export function startStatusPollerJob(): void {
  const poller = container.resolve<StatusPollerService>(TOKENS.StatusPollerService);

  const run = () => {
    poller.poll().catch((err: Error) => {
      logger.error('Status poll failed', { error: err.message });
    });
  };

  // Run once immediately on boot, then every 5 minutes
  run();
  setInterval(run, INTERVAL_MS);

  logger.info('Status poller job started', { intervalMs: INTERVAL_MS });
}
