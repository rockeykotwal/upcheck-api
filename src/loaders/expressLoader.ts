import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { container } from '../container';
import { UserService } from '../api/services/UserService';
import authRouter from '../api/controllers/AuthController';
import { authenticate } from '../api/middlewares/authenticate';
import { config } from '../config';
import { corsOptions } from '../config/cors.config';
import { requestLogger } from '../api/middlewares/requestLogger';
import { defaultRateLimiter } from '../api/middlewares/rateLimiter';
import { notFound } from '../api/middlewares/notFound';
import { errorHandler } from '../api/middlewares/errorHandler';
import { registerRbac } from '../modules/rbac';

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'Upcheck API',
      version:     '0.1.0',
      description: 'Upcheck — live service status aggregator API',
    },
    servers: [
      { url: `http://localhost:${config.app.port}`, description: 'Local development' },
    ],
    tags: [
      { name: 'Auth',      description: 'Authentication' },
      { name: 'Companies', description: 'Company status' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [
    './src/api/controllers/*.ts',
    './src/modules/*/controllers/*.ts',
    './dist/api/controllers/*.js',
    './dist/modules/*/controllers/*.js',
  ],
} as swaggerJsdoc.Options);

export function expressLoader(): Application {
  const app = express();

  // ── CORS — must be first so preflight and credentialed requests are handled ─
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // ── Security headers ───────────────────────────────────────────────────────
  app.use(helmet());

  // ── Body & cookie parsing ──────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // ── Request logging ────────────────────────────────────────────────────────
  app.use(requestLogger);

  // ── Health — registered BEFORE rate limiter so it is never rate-limited ────
  app.get('/health', (_req, res) => {
    res.json({
      status:    'ok',
      uptime:    process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // ── Swagger UI ─────────────────────────────────────────────────────────────
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // ── Auth routes (public — no authentication required) ─────────────────────
  app.use('/api/auth', authRouter);

  // ── GET /api/users/me ──────────────────────────────────────────────────────
  const userService = container.resolve(UserService);

  app.get(
    '/api/users/me',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { userId } = res.locals['user'] as { userId: string };
        const user = await userService.findById(userId);
        const { passwordHash: _pw, ...safeUser } = user;
        res.json({ user: safeUser });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── RBAC module (roles, permissions, user-role assignment) ────────────────
  registerRbac(app);

  // ── Global rate limiting (skips /health via `skip` option) ─────────────────
  app.use(defaultRateLimiter);

  // ── 404 & global error handler — always last ───────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
