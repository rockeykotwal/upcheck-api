import type { Application } from 'express';
import { logger } from '../../observability/logger';
import watchlistRouter from './controllers/WatchlistController';

export function registerWatchlist(app: Application): void {
  app.use('/api/watchlist', watchlistRouter);
  logger.info('Watchlist module registered');
}

export * from './models/watchlist.schema';
export * from './repositories/WatchlistRepository';
export * from './services/WatchlistService';
