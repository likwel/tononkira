import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { createAdminRouter, type AdminDeps } from './admin/routes.js';
import type { Catalog } from './catalog.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { createApiRouter } from './routes.js';

export interface AppOptions {
  catalog: Catalog;
  corsOrigins: string[];
  logger?: Logger;
  /** Requêtes par minute et par IP ; `false` pour désactiver (tests). */
  rateLimitPerMinute?: number | false;
  /** Routes /api/admin (absentes si non fourni). */
  admin?: AdminDeps;
}

export function createApp({
  catalog,
  corsOrigins,
  logger,
  rateLimitPerMinute = 300,
  admin,
}: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, methods: ['GET', 'POST'] }));
  app.use(compression());
  if (logger)
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  if (rateLimitPerMinute) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60_000,
        limit: rateLimitPerMinute,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: {
          error: { code: 'rate_limited', message: 'Trop de requêtes, réessayez dans une minute' },
        },
      }),
    );
  }

  if (admin) {
    app.use(
      '/api/admin',
      // Freine la recherche du jeton : seules les réponses 401 sont comptées.
      rateLimit({
        windowMs: 15 * 60_000,
        limit: 20,
        skipSuccessfulRequests: true,
        requestWasSuccessful: (_req, res) => res.statusCode !== 401,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: {
          error: { code: 'rate_limited', message: 'Trop de tentatives, réessayez plus tard' },
        },
      }),
      express.json({ limit: '16kb' }),
      createAdminRouter(admin),
    );
  }
  app.use('/api', createApiRouter(catalog));
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
