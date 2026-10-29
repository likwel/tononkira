import { Router, type Response } from 'express';
import type { Catalog } from './catalog.js';
import { HttpError } from './lib/http-error.js';
import { artistListQuery, pageMeta, parseQuery, searchQuery, songListQuery } from './lib/query.js';

/** Les données ne changent qu'à l'import : un court cache navigateur/CDN suffit. */
function cacheFor(res: Response, seconds: number): void {
  res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
}

export function createApiRouter(catalog: Catalog): Router {
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
