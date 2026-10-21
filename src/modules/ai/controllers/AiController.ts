import 'reflect-metadata';
import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../../../container';
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

export default router;
