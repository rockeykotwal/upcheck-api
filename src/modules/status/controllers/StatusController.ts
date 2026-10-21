import 'reflect-metadata';
import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../../../container';
import { StatusService } from '../services/StatusService';
import { AppError } from '../../../errors/AppError';

const router = Router();

// Lazy-resolved so MongoDb is available before first request (mongoLoader runs before routes are hit)
function service() {
  return container.resolve(StatusService);
}

/**
 * @openapi
 * /api/status:
 *   get:
 *     tags: [Companies]
 *     summary: List all companies with their current status
 *     responses:
 *       200:
 *         description: Array of companies with latest snapshot
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const statuses = await service().listAll();
    res.json({ statuses });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/status/search:
 *   get:
 *     tags: [Companies]
 *     summary: Search companies by name or slug
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Filtered list of companies
 *       400:
 *         description: Missing query parameter
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query['q'];
    if (typeof q !== 'string' || q.trim() === '') {
      throw new AppError('Query parameter "q" is required', 400);
    }
    const statuses = await service().search(q);
    res.json({ statuses });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/status/{slug}:
 *   get:
 *     tags: [Companies]
 *     summary: Get a single company with current status and history
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Company detail with last 20 snapshots
 *       404:
 *         description: Company not found
 */
router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params as { slug: string };
    const detail = await service().getDetail(slug);
    if (!detail) throw new AppError('Company not found', 404);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

export default router;
