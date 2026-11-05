import { Router, type Response } from 'express';
import { z } from 'zod';
import type { Catalog } from './catalog.js';
import { HttpError } from './lib/http-error.js';
import { artistListQuery, pageMeta, parseQuery, searchQuery, songListQuery } from './lib/query.js';
import type { LyricEdits } from './lyric-edits.js';

const editBody = z.object({
  lyrics: z.string().trim().min(20, 'au moins 20 caractères').max(20_000),
  note: z.string().trim().max(500).optional(),
  author: z.string().trim().max(80).optional(),
});

/** Les données ne changent qu'à l'import : un court cache navigateur/CDN suffit. */
function cacheFor(res: Response, seconds: number): void {
  res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
}

export function createApiRouter(catalog: Catalog, edits?: LyricEdits): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    try {
      await catalog.ping();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  router.get('/stats', async (_req, res) => {
    cacheFor(res, 300);
    res.json({ data: await catalog.stats() });
  });

  router.get('/songs', async (req, res) => {
    cacheFor(res, 60);
    const query = parseQuery(songListQuery, req.query);
    const { items, total } = await catalog.listSongs(query);
    res.json({ data: items, meta: pageMeta(query, total) });
  });

  router.get('/songs/random', async (_req, res) => {
    const song = await catalog.randomSong();
    if (!song) throw HttpError.notFound('Aucune chanson dans le catalogue');
    res.set('Cache-Control', 'no-store');
    res.json({ data: song });
  });

  router.get('/songs/:artistSlug/:slug', async (req, res) => {
    cacheFor(res, 300);
    const song = await catalog.getSong(req.params.artistSlug, req.params.slug);
    if (!song) throw HttpError.notFound('Chanson introuvable');
    res.json({ data: song });
  });

  if (edits) {
    /** Correction proposée par un visiteur : enregistrée, mais publiée seulement après validation. */
    router.post('/songs/:artistSlug/:slug/edits', async (req, res) => {
      const body = parseQuery(editBody, req.body);
      const result = await edits.submit({
        artistSlug: req.params.artistSlug,
        slug: req.params.slug,
        ...body,
      });
      if (result === 'unknown-song') throw HttpError.notFound('Chanson introuvable');
      if (result === 'unchanged')
        throw HttpError.badRequest('Ces paroles sont identiques à celles déjà publiées');
      res.status(201).json({ data: { id: result.id, status: result.status } });
    });
  }

  router.get('/artists', async (req, res) => {
    cacheFor(res, 60);
    const query = parseQuery(artistListQuery, req.query);
    const { items, total } = await catalog.listArtists(query);
    res.json({ data: items, meta: pageMeta(query, total) });
  });

  router.get('/artists/:slug', async (req, res) => {
    cacheFor(res, 300);
    const artist = await catalog.getArtist(req.params.slug);
    if (!artist) throw HttpError.notFound('Artiste introuvable');
    res.json({ data: artist });
  });

  router.get('/search', async (req, res) => {
    cacheFor(res, 60);
    const query = parseQuery(searchQuery, req.query);
    const [songs, artists] = await Promise.all([
      catalog.searchSongs(query),
      query.page === 1 ? catalog.searchArtists(query.q, 8) : Promise.resolve([]),
    ]);
    res.json({ data: { songs: songs.items, artists }, meta: pageMeta(query, songs.total) });
  });

  return router;
}
