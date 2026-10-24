import 'reflect-metadata';
import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../../../container';
import { authenticate } from '../../../middlewares/authenticate';
import { AiService } from '../services/AiService';

const router = Router();

function service() {
  return container.resolve(AiService);
}

/**
 * @openapi
 * /api/ai/summary/{slug}:
 *   get:
 *     tags: [AI]
 *     summary: Generate an AI incident summary for a service
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         example: github
 *     responses:
 *       200:
 *         description: AI-generated incident summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slug:
 *                   type: string
 *                 summary:
 *                   type: string
 *       404:
 *         description: No snapshot data found for this slug
 */
router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params as { slug: string };
    const summary = await service().summarize(slug);
    res.json({ slug, summary });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/ai/summary/{slug}/send:
 *   post:
 *     tags: [AI]
 *     summary: Generate AI incident summary and email all watchers
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
 *         description: Summary sent — returns number of recipients
 *       404:
 *         description: Service not found or no snapshot data
 *       401:
 *         description: Unauthorized
 */
router.post('/:slug/send', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params as { slug: string };
    const sent = await service().summarizeAndSend(slug);
    res.json({ sent });
  } catch (err) {
    next(err);
  }
});

export default router;
