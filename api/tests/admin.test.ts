import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { JobRunner } from '../src/admin/jobs.js';
import type { AdminDeps } from '../src/admin/routes.js';
import { createApp } from '../src/app.js';
import {
  CRAWL_SONG,
  FakeCrawlState,
  FakeFileImporter,
  FakeLibrary,
  FakePython,
  MemoryJobStore,
  TOKEN,
} from './admin-fakes.js';
import { FakeCatalog } from './fake-catalog.js';

let python: FakePython;
let crawl: FakeCrawlState;
let library: FakeLibrary;
let jobs: JobRunner;
let app: ReturnType<typeof createApp>;

function build(overrides: Partial<AdminDeps> = {}) {
  const catalog = new FakeCatalog();
  const jobStore = new MemoryJobStore();
  jobs = new JobRunner({
    store: jobStore,
    python,
    importer: new FakeFileImporter(),
    exportPath: '/tmp/songs.jsonl',
  });
  return createApp({
    catalog,
    corsOrigins: ['http://localhost:5173'],
    rateLimitPerMinute: false,
    admin: { token: TOKEN, catalog, crawl, jobs, jobStore, python, library, ...overrides },
  });
}

const auth = { Authorization: `Bearer ${TOKEN}` };

beforeEach(() => {
  python = new FakePython();
  crawl = new FakeCrawlState();
  library = new FakeLibrary();
  app = build();
});

describe('accès', () => {
  it('refuse sans jeton ou avec un mauvais jeton', async () => {
    expect((await request(app).get('/api/admin/session')).status).toBe(401);
    const res = await request(app).get('/api/admin/session').set('Authorization', 'Bearer faux');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('accepte le bon jeton et ne met jamais en cache', async () => {
    const res = await request(app).get('/api/admin/session').set(auth);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it("est désactivé quand aucun jeton n'est configuré", async () => {
    const res = await request(build({ token: undefined })).get('/api/admin/session').set(auth);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('admin_disabled');
  });

  it('bloque après trop de jetons invalides', async () => {
    for (let i = 0; i < 20; i += 1) {
      await request(app).get('/api/admin/session').set('Authorization', 'Bearer faux');
    }
    const res = await request(app).get('/api/admin/session').set(auth);
    expect(res.status).toBe(429);
  });

  it('autorise le POST depuis le front configuré (CORS)', async () => {
    const res = await request(app)
      .options('/api/admin/jobs')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });
});

describe('historique des pages collectées', () => {
  it('transmet les filtres et indique les chansons présentes dans le catalogue', async () => {
    const res = await request(app)
      .get('/api/admin/pages?status=done&q=%20potika%20&sort=stale&page=2')
      .set(auth);
    expect(res.status).toBe(200);
    expect(crawl.lastSongsQuery).toEqual({ page: 2, limit: 25, status: 'done', q: 'potika', sort: 'stale' });
    expect(res.body.data[0].catalog).toEqual({ artistSlug: 'magma', slug: 'potika' });
  });

  it('refuse un statut inconnu', async () => {
    const res = await request(app).get('/api/admin/pages?status=tout').set(auth);
    expect(res.status).toBe(400);
  });

  it('donne la vue d’ensemble (base, collecte, tâche)', async () => {
    const res = await request(app).get('/api/admin/overview').set(auth);
    expect(res.body.data.db.songs).toBe(1);
    expect(res.body.data.crawl.lastPage).toBe(884);
    expect(res.body.data.job).toBeNull();
  });
});

describe('vérifier une page déjà collectée', () => {
  it('relit la page, signale les changements et met la base à jour', async () => {
    const song = { title: 'potika', source_url: CRAWL_SONG.url };
    python.script = {
      events: [{ url: CRAWL_SONG.url, status: 'updated', changes: ['paroles'], stats: ['vues'], song }],
    };
    const res = await request(app).post('/api/admin/pages/refresh').set(auth).send({ url: CRAWL_SONG.url });

    expect(res.status).toBe(200);
    expect(python.calls[0]).toEqual(['refresh', '--url', CRAWL_SONG.url, '--json']);
    expect(res.body.data).toMatchObject({ status: 'updated', changes: ['paroles'], imported: 'updated' });
    expect(library.imported).toEqual([song]);
  });

  it("n'importe rien pour une page disparue", async () => {
    python.script = { events: [{ url: CRAWL_SONG.url, status: 'gone', song: null }] };
    const res = await request(app).post('/api/admin/pages/refresh').set(auth).send({ url: CRAWL_SONG.url });
    expect(res.body.data).toMatchObject({ status: 'gone', imported: null });
    expect(library.imported).toEqual([]);
  });

  it.each([
    'https://exemple.org/hira/a/b',
    'http://tononkira.serasera.org/hira/a/b',
    'https://tononkira.serasera.org/mpihira/magma',
    'pas une url',
  ])('refuse de relire %s', async (url) => {
    const res = await request(app).post('/api/admin/pages/refresh').set(auth).send({ url });
    expect(res.status).toBe(400);
    expect(python.calls).toEqual([]);
  });

  it('répond 502 si la commande Python ne renvoie rien', async () => {
    python.script = { logs: ['Traceback: ModuleNotFoundError'], code: 1 };
    const res = await request(app).post('/api/admin/pages/refresh').set(auth).send({ url: CRAWL_SONG.url });
    expect(res.status).toBe(502);
    expect(res.body.error.message).toContain('ModuleNotFoundError');
  });
});

describe('pages de liste', () => {
  it('relit une page de liste et compte les nouvelles chansons', async () => {
    python.script = { events: [{ event: 'list_page', page: 9, last: 9, found: 20, new: 3 }] };
    const res = await request(app).post('/api/admin/list-pages/9/refresh').set(auth);
    expect(python.calls[0]).toEqual([
      'crawl', '--from', '9', '--to', '9', '--lists-only', '--refresh-lists', '--no-export', '--events',
    ]);
    expect(res.body.data).toEqual({ page: 9, found: 20, new: 3, empty: false });
  });

  it('liste les pages lues avec la dernière page connue', async () => {
    const res = await request(app).get('/api/admin/list-pages').set(auth);
    expect(res.body.data[0].page).toBe(9);
    expect(res.body.meta.lastPage).toBe(884);
  });
});

describe('tâches', () => {
  it('lance une collecte, puis refuse une deuxième tâche simultanée', async () => {
    python.script = { waitForAbort: true };
    const started = await request(app)
      .post('/api/admin/jobs')
      .set(auth)
      .send({ type: 'crawl', options: { from: 9, to: 12, limit: 50 } });
    expect(started.status).toBe(202);
    expect(started.body.data.status).toBe('running');
    expect(python.calls[0]).toEqual(
      expect.arrayContaining(['crawl', '--from', '9', '--to', '12', '--limit', '50']),
    );

    const second = await request(app).post('/api/admin/jobs').set(auth).send({ type: 'update' });
    expect(second.status).toBe(409);

    const cancel = await request(app).post(`/api/admin/jobs/${started.body.data.id}/cancel`).set(auth);
    expect(cancel.status).toBe(202);
    await jobs.idle();
    const current = await request(app).get('/api/admin/jobs/current').set(auth);
    expect(current.body.data.status).toBe('cancelled');
  });

  it.each([
    [{ type: 'tout' }, 'type'],
    [{ type: 'crawl', options: { delay: 0.1 } }, 'options.delay'],
    [{ type: 'crawl', options: { from: 10, to: 2 } }, 'options.to'],
    [{ type: 'crawl', options: { script: 'rm -rf' } }, 'options'],
  ])('refuse une demande invalide %j', async (body, field) => {
    const res = await request(app).post('/api/admin/jobs').set(auth).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe(field);
    expect(python.calls).toEqual([]);
  });

  it("refuse d'arrêter une tâche qui ne tourne pas", async () => {
    const res = await request(app).post('/api/admin/jobs/42/cancel').set(auth);
    expect(res.status).toBe(409);
  });

  it("garde l'historique des tâches terminées", async () => {
    await request(app).post('/api/admin/jobs').set(auth).send({ type: 'import' });
    await jobs.idle();
    const list = await request(app).get('/api/admin/jobs').set(auth);
    expect(list.body.data[0]).toMatchObject({ type: 'import', status: 'succeeded' });
    const detail = await request(app).get(`/api/admin/jobs/${list.body.data[0].id}`).set(auth);
    expect(detail.body.data.log).toContain('Import terminé');
  });
});
