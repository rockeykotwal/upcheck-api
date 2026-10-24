import 'reflect-metadata';
import { container } from '../container';
import { TOKENS } from '../tokens';
import { StatusPollerService } from '../modules/status/services/StatusPollerService';
import { logger } from '../observability/logger';

const INTERVAL_MS = 1 * 60 * 1_000; // 1 minute

export function startStatusPollerJob(): void {
  const poller = container.resolve<StatusPollerService>(TOKENS.StatusPollerService);

  const run = () => {
    logger.info('Internal poll triggered', { source: 'internal' });
    poller.poll().catch((err: Error) => {
      logger.error('Status poll failed', { source: 'internal', error: err.message });
    });
  };

  run();
  setInterval(run, INTERVAL_MS);

  logger.info('Status poller job started', { source: 'internal', intervalMs: INTERVAL_MS });
}
