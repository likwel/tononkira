import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { FakeCatalog } from './fake-catalog.js';

let catalog: FakeCatalog;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  catalog = new FakeCatalog();
  app = createApp({ catalog, corsOrigins: ['http://localhost:5173'], rateLimitPerMinute: false });
});

describe('GET /api/health', () => {
  it('répond ok quand la base répond', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('répond 503 quand la base est indisponible', async () => {
    catalog.healthy = false;
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
  });
});

describe('GET /api/songs', () => {
  it('applique les valeurs par défaut et renvoie la pagination', async () => {
    const res = await request(app).get('/api/songs');
    expect(res.status).toBe(200);
    expect(catalog.lastCall('listSongs')).toEqual([{ page: 1, limit: 24, sort: 'recent' }]);
    expect(res.body.meta).toEqual({ page: 1, limit: 24, total: 50, totalPages: 3 });
    expect(res.body.data[0].title).toBe('Hira');
    expect(res.headers['cache-control']).toContain('max-age=60');
  });

  it('transmet tri, lettre (en minuscule) et page', async () => {
    await request(app).get('/api/songs?page=2&limit=10&sort=popular&letter=T');
    expect(catalog.lastCall('listSongs')).toEqual([
      { page: 2, limit: 10, sort: 'popular', letter: 't' },
    ]);
  });

  it.each([
    ['page=0', 'page'],
    ['limit=500', 'limit'],
    ['sort=hasard', 'sort'],
    ['letter=ab', 'letter'],
  ])('refuse %s avec 400', async (qs, field) => {
    const res = await request(app).get(`/api/songs?${qs}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
    expect(res.body.error.details[0].field).toBe(field);
    expect(catalog.lastCall('listSongs')).toBeUndefined();
  });
});

describe('GET /api/songs/:artistSlug/:slug', () => {
  it('renvoie la chanson avec ses paroles et sa source', async () => {
    const res = await request(app).get('/api/songs/mpihira/hira');
    expect(res.status).toBe(200);
    expect(res.body.data.lyrics).toBe('Andalana');
    expect(res.body.data.sourceUrl).toMatch(/^https:\/\/tononkira\.serasera\.org\//);
  });

  it('renvoie 404 pour une chanson inconnue, sans mise en cache', async () => {
    const res = await request(app).get('/api/songs/mpihira/tsy-misy');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('GET /api/songs/random', () => {
  it("n'est pas confondu avec une chanson et n'est jamais mis en cache", async () => {
    const res = await request(app).get('/api/songs/random');
    expect(res.status).toBe(200);
    expect(catalog.lastCall('randomSong')).toEqual([]);
    expect(catalog.lastCall('getSong')).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('renvoie 404 quand le catalogue est vide', async () => {
    catalog.songs = [];
    const res = await request(app).get('/api/songs/random');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/artists', () => {
  it('transmet la recherche par nom et le tri', async () => {
    const res = await request(app).get('/api/artists?q=%20mpi%20&sort=songs');
    expect(res.status).toBe(200);
    expect(catalog.lastCall('listArtists')).toEqual([
      { page: 1, limit: 48, sort: 'songs', q: 'mpi' },
    ]);
  });

  it('renvoie la fiche artiste ou 404', async () => {
    expect((await request(app).get('/api/artists/mpihira')).body.data.totalViews).toBe(10);
    expect((await request(app).get('/api/artists/tsy-misy')).status).toBe(404);
  });
});

describe('GET /api/search', () => {
  it('cherche chansons et artistes en page 1', async () => {
    const res = await request(app).get('/api/search?q=tiako');
    expect(res.status).toBe(200);
    expect(res.body.data.songs[0].excerpt).toBe('Andalana');
    expect(res.body.data.artists).toHaveLength(1);
    expect(catalog.lastCall('searchArtists')).toEqual(['tiako', 8]);
  });

  it('ne recherche plus les artistes au-delà de la page 1', async () => {
    const res = await request(app).get('/api/search?q=tiako&page=2');
    expect(res.body.data.artists).toEqual([]);
    expect(catalog.lastCall('searchArtists')).toBeUndefined();
  });

  it('refuse une recherche trop courte', async () => {
    const res = await request(app).get('/api/search?q=a');
    expect(res.status).toBe(400);
    expect(catalog.lastCall('searchSongs')).toBeUndefined();
  });
});

describe('erreurs', () => {
  it('renvoie 404 JSON pour une route inconnue', async () => {
    const res = await request(app).get('/api/tsy-misy');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('/api/tsy-misy');
  });

  it("masque le détail d'une erreur interne", async () => {
    catalog.failWith = new Error('connexion refusée : mot de passe xyz');
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('xyz');
  });

  it("n'autorise que l'origine configurée (CORS)", async () => {
    const ok = await request(app).get('/api/stats').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const ko = await request(app).get('/api/stats').set('Origin', 'https://ailleurs.example');
    expect(ko.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('limite de débit', () => {
  it('répond 429 au-delà de la limite par minute', async () => {
    const limited = createApp({ catalog, corsOrigins: [], rateLimitPerMinute: 2 });
    await request(limited).get('/api/stats');
    await request(limited).get('/api/stats');
    const res = await request(limited).get('/api/stats');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('rate_limited');
  });
});
