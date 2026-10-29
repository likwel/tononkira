import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { HttpError } from '../lib/http-error.js';

/** Comparaison en temps constant (les empreintes ont toujours la même longueur). */
export function sameToken(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/** Accès réservé : en-tête `Authorization: Bearer <ADMIN_TOKEN>`. */
export function requireAdmin(token: string | undefined): RequestHandler {
  return (req, _res, next) => {
    if (!token) {
      next(
        new HttpError(
          503,
          'admin_disabled',
          "Administration désactivée : définir ADMIN_TOKEN dans api/.env",
        ),
      );
      return;
    }
    const header = req.get('authorization') ?? '';
    const given = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!given || !sameToken(given, token)) {
      next(new HttpError(401, 'unauthorized', "Jeton d'administration invalide"));
      return;
    }
    next();
  };
}
