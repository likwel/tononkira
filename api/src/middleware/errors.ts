import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { HttpError } from '../lib/http-error.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Route inconnue : ${req.method} ${req.path}`));
};

export interface ErrorHandlerOptions {
  logger?: Logger | undefined;
  /** Développement : joint la cause d'une erreur 500 à la réponse (jamais en production). */
  exposeErrors?: boolean | undefined;
}

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  type?: unknown;
  cause?: { code?: unknown; originalCode?: unknown } | undefined;
};

/** Pannes d'infrastructure reconnues : 503 avec la marche à suivre plutôt qu'une 500 muette. */
export function describeServiceError(err: unknown): { code: string; message: string } | null {
  const error = (err ?? {}) as ErrorLike;
  const codes = [error.code, error.cause?.code, error.cause?.originalCode].map(String);
  if (
    codes.some(
      (code) => code === 'P2021' || code === 'P2022' || code === '42P01' || code === '42703',
    )
  ) {
    return {
      code: 'database_outdated',
      message: "La base de données n'est pas à jour : lancer « npm run db:migrate ».",
    };
  }
  if (
    codes.some((code) =>
      ['P1001', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '57P03'].includes(code),
    )
  ) {
    return {
      code: 'database_unavailable',
      message: 'Base de données injoignable : vérifier DATABASE_URL et que PostgreSQL tourne.',
    };
  }
  return null;
}

export function errorHandler({
  logger,
  exposeErrors = false,
}: ErrorHandlerOptions = {}): ErrorRequestHandler {
  return (err, req, res, _next) => {
    // Une route a pu poser un Cache-Control public avant d'échouer : une erreur ne se met pas en cache.
    res.set('Cache-Control', 'no-store');
    if (err instanceof HttpError) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }

    // Erreurs du lecteur de corps d'Express (JSON mal formé, trop volumineux) : faute du client.
    const error = (err ?? {}) as ErrorLike;
    const status = Number(error.status ?? error.statusCode);
    if (status >= 400 && status < 500) {
      res.status(status).json({
        error:
          status === 413
            ? { code: 'payload_too_large', message: 'Requête trop volumineuse' }
            : { code: 'bad_request', message: 'Corps de requête invalide (JSON attendu)' },
      });
      return;
    }

    const service = describeServiceError(err);
    logger?.error(
      { err, method: req.method, url: req.originalUrl },
      service?.message ?? 'Erreur non gérée',
    );
    if (service) {
      res.status(503).json({ error: service });
      return;
    }
    res.status(500).json({
      error: {
        code: 'internal',
        message: 'Erreur interne du serveur',
        ...(exposeErrors && err instanceof Error ? { debug: `${err.name} : ${err.message}` } : {}),
      },
    });
  };
}
