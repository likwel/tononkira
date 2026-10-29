import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { HttpError } from '../lib/http-error.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Route inconnue : ${req.method} ${req.path}`));
};

export function errorHandler(logger?: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    // Une route a pu poser un Cache-Control public avant d'échouer : une erreur ne se met pas en cache.
    res.set('Cache-Control', 'no-store');
    if (err instanceof HttpError) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }
    logger?.error({ err }, 'Erreur non gérée');
    res.status(500).json({ error: { code: 'internal', message: 'Erreur interne du serveur' } });
  };
}
