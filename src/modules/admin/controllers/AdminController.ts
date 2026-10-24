import 'reflect-metadata';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { container } from '../../../container';
import { TOKENS } from '../../../tokens';
import { AdminService } from '../services/AdminService';
import { StatusPollerService } from '../../status/services/StatusPollerService';
import { requireAdminKey } from '../../../middlewares/requireAdminKey';
import { AppError } from '../../../errors/AppError';
import { logger } from '../../../observability/logger';
import type { CompanyStatus } from '../../status/models/company.schema';

const VALID_STATUSES: CompanyStatus[] = ['active', 'paused', 'retired'];

const router = Router();

function service(): AdminService {
  return container.resolve<AdminService>(TOKENS.AdminService);
}

router.use(requireAdminKey);

// GET /api/admin/companies
router.get('/companies', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const companies = await service().listAll();
    res.json({ companies });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/companies
router.post('/companies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug, statusPageUrl, category, logoUrl } = req.body as Record<string, string>;

    if (!name || !slug || !statusPageUrl) {
      return next(new AppError('name, slug, and statusPageUrl are required', 400));
    }

    const company = await service().addCompany({ name, slug, statusPageUrl, category, logoUrl });
    res.status(201).json({ company });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/companies/:slug/status
router.patch('/companies/:slug/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params as { slug: string };
    const { status } = req.body as { status: CompanyStatus };

    if (!status || !VALID_STATUSES.includes(status)) {
      return next(new AppError(`status must be one of: ${VALID_STATUSES.join(', ')}`, 400));
    }

    const company = await service().setStatus(slug, status);
    res.json({ company });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/companies/:slug
router.delete('/companies/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params as { slug: string };
    await service().deleteCompany(slug);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/poll — trigger a status poll manually (for external cron on serverless)
router.post('/poll', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = (req.query['source'] as string | undefined) ?? 'unknown';
    const poller  = container.resolve<StatusPollerService>(TOKENS.StatusPollerService);

    logger.info('Manual poll triggered', { source });
    await poller.poll();

    const polledAt = new Date().toISOString();
    logger.info('Manual poll complete', { source, polledAt });

    res.json({ ok: true, source, polledAt });
  } catch (err) {
    next(err);
  }
});

export default router;
