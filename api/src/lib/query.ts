import { z } from 'zod';
import { HttpError } from './http-error.js';

const page = z.coerce.number().int().min(1).max(10_000).default(1);
const limit = (fallback: number) => z.coerce.number().int().min(1).max(100).default(fallback);
const letter = z
  .string()
  .regex(/^[a-z]$/i, 'une seule lettre de A à Z')
  .transform((value) => value.toLowerCase())
  .optional();

export const songListQuery = z.object({
  page,
  limit: limit(24),
  sort: z.enum(['recent', 'popular', 'title']).default('recent'),
  letter,
});

export const artistListQuery = z.object({
  page,
  limit: limit(48),
  sort: z.enum(['name', 'songs']).default('name'),
  letter,
  q: z.string().trim().max(100).optional(),
});

export const searchQuery = z.object({
  q: z.string().trim().min(2, 'au moins 2 caractères').max(100),
  page,
  limit: limit(20),
});

export function parseQuery<T extends z.ZodType>(schema: T, query: unknown): z.infer<T> {
  const result = schema.safeParse(query);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw HttpError.badRequest('Paramètres invalides', details);
  }
  return result.data;
}

export function pageMeta(query: { page: number; limit: number }, total: number) {
  return {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}
