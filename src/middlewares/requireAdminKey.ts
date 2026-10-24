import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { config } from '../config';

export function requireAdminKey(_req: Request, _res: Response, next: NextFunction): void {
  if (!config.admin.apiKey) {
    return next(new AppError('Admin API is not configured on this server', 503));
  }

  const adminKey  = _req.headers['x-admin-key'];
  const cronToken = _req.headers['authorization'];

  // Accept X-Admin-Key (manual / cron-job.org)
  // or Vercel's cron Authorization: Bearer <CRON_SECRET>
  const validAdminKey  = adminKey === config.admin.apiKey;
  const validVercelCron =
    config.cron.secret.length > 0 &&
    cronToken === `Bearer ${config.cron.secret}`;

  if (!validAdminKey && !validVercelCron) {
    return next(new AppError('Unauthorized', 401));
  }

  next();
}
