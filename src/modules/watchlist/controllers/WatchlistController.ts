import 'reflect-metadata';
import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../../../container';
import { authenticate } from '../../../middlewares/authenticate';
import { WatchlistService } from '../services/WatchlistService';
import { TOKENS } from '../../../tokens';

const router = Router();

function service() {
  return container.resolve<WatchlistService>(TOKENS.WatchlistService);
}

/**
 * @openapi
 * /api/watchlist:
 *   get:
 *     tags: [Watchlist]
 *     summary: Get current user's watchlist
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of watched companies with current status
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = res.locals['user'] as { userId: string };
    const items = await service().getWatchlist(userId);
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/watchlist/{slug}:
 *   post:
 *     tags: [Watchlist]
 *     summary: Watch a company
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Watching
 *       404:
 *         description: Company not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:slug', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = res.locals['user'] as { userId: string };
    await service().watch(userId, req.params['slug']!);
    res.json({ success: true, data: { watching: true } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/watchlist/{slug}:
 *   delete:
 *     tags: [Watchlist]
 *     summary: Unwatch a company
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Unwatched
 *       401:
 *         description: Unauthorized
 */
router.delete('/:slug', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = res.locals['user'] as { userId: string };
    await service().unwatch(userId, req.params['slug']!);
    res.json({ success: true, data: { watching: false } });
  } catch (err) {
    next(err);
  }
});

export default router;
