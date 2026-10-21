import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { config } from '../config';

export function requireAdminKey(_req: Request, _res: Response, next: NextFunction): void {
  if (!config.admin.apiKey) {
    return next(new AppError('Admin API is not configured on this server', 503));
  }

  const key = _req.headers['x-admin-key'];

  if (!key || key !== config.admin.apiKey) {
    return next(new AppError('Unauthorized', 401));
  }

  next();
}
