import 'reflect-metadata';
import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../../../container';
import { authenticate } from '../../../middlewares/authenticate';
import { MonitorService } from '../services/MonitorService';
import { AppError } from '../../../errors/AppError';
import { TOKENS } from '../../../tokens';

const router = Router();

function service() {
  return container.resolve<MonitorService>(TOKENS.MonitorService);
}

/**
 * @openapi
 * /api/monitors:
 *   get:
 *     tags: [Monitors]
 *     summary: List the authenticated user's custom monitors
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of monitors with current status
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = res.locals['user'] as { userId: string };
    const monitors = await service().listByUser(userId);
    res.json({ monitors });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/monitors:
 *   post:
 *     tags: [Monitors]
 *     summary: Create a custom HTTP monitor
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, url]
 *             properties:
 *               name:
 *                 type: string
 *               url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Monitor created
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = res.locals['user'] as { userId: string };
    const { name, url } = req.body as { name?: string; url?: string };

    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new AppError('name is required', 400);
    }
    if (!url || typeof url !== 'string' || url.trim() === '') {
      throw new AppError('url is required', 400);
    }

    const monitor = await service().create(userId, name.trim(), url.trim());
    res.status(201).json({ monitor });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/monitors/{slug}:
 *   delete:
 *     tags: [Monitors]
 *     summary: Delete a custom monitor (must be owned by authenticated user)
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
 *         description: Monitor deleted
 *       404:
 *         description: Not found or not owned by you
 *       401:
 *         description: Unauthorized
 */
router.delete('/:slug', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = res.locals['user'] as { userId: string };
    const { slug } = req.params as { slug: string };
    await service().deleteByUser(userId, slug);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
