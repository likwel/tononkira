import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { JobRunner } from '../src/admin/jobs.js';
import { createApp } from '../src/app.js';
import {
  FakeCrawlState,
  FakeFileImporter,
  FakeLibrary,
  FakeLyricEdits,
  FakePython,
  MemoryJobStore,
  TOKEN,
} from './admin-fakes.js';
import { FakeCatalog } from './fake-catalog.js';

const auth = { Authorization: `Bearer ${TOKEN}` };
const PATH = '/api/songs/mpihira/hira/edits';
const CORRECTED = 'Andalana voavaha sy voadio tsara';

let edits: FakeLyricEdits;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  edits = new FakeLyricEdits();
  const catalog = new FakeCatalog();
  const python = new FakePython();
  const jobStore = new MemoryJobStore();
  app = createApp({
    catalog,
    corsOrigins: ['http://localhost:5173'],
    rateLimitPerMinute: false,
    edits,
    admin: {
      token: TOKEN,
      catalog,
      crawl: new FakeCrawlState(),
      jobs: new JobRunner({
        store: jobStore,
        python,
        importer: new FakeFileImporter(),
        exportPath: '/tmp/songs.jsonl',
      }),
      jobStore,
      python,
      library: new FakeLibrary(),
      edits,
    },
  });
});

describe('POST /api/songs/:artistSlug/:slug/edits', () => {
  it('enregistre la proposition sans toucher aux paroles publiées', async () => {
    const res = await request(app)
      .post(PATH)
      .send({ lyrics: CORRECTED, note: 'Faute au 2e vers', author: 'Rakoto' });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ id: 1, status: 'pending' });
    expect(edits.published.get('mpihira/hira')).toBe('Andalana');
    expect(edits.rows[0]).toMatchObject({
      lyrics: CORRECTED,
      baseLyrics: 'Andalana',
      note: 'Faute au 2e vers',
      author: 'Rakoto',
    });
  });

  it('accepte une proposition sans nom ni commentaire', async () => {
    const res = await request(app).post(PATH).send({ lyrics: CORRECTED });
    expect(res.status).toBe(201);
    expect(edits.rows[0]).toMatchObject({ note: null, author: null });
  });

  it('répond 404 pour une chanson inconnue', async () => {
    const res = await request(app).post('/api/songs/inconnu/inconnu/edits').send({
      lyrics: CORRECTED,
    });
    expect(res.status).toBe(404);
  });

  it('refuse un texte identique aux paroles publiées', async () => {
    const res = await request(app).post(PATH).send({ lyrics: '  Andalana  ' });
    expect(res.status).toBe(400);
    expect(edits.rows).toHaveLength(0);
  });

  it.each([
    ['trop court', { lyrics: 'court' }],
    ['absent', {}],
    ['commentaire trop long', { lyrics: CORRECTED, note: 'x'.repeat(501) }],
  ])('refuse un envoi %s avec 400', async (_label, body) => {
    const res = await request(app).post(PATH).send(body);
    expect(res.status).toBe(400);
    expect(edits.rows).toHaveLength(0);
  });
});

describe('GET /api/admin/lyric-edits', () => {
  it('exige le jeton', async () => {
    expect((await request(app).get('/api/admin/lyric-edits')).status).toBe(401);
  });

  it('ne renvoie que les propositions en attente par défaut', async () => {
    await request(app).post(PATH).send({ lyrics: CORRECTED });
    await request(app)
      .post(PATH)
      .send({ lyrics: `${CORRECTED} indray` });
    await request(app).post('/api/admin/lyric-edits/1/reject').set(auth);

    const res = await request(app).get('/api/admin/lyric-edits').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(2);
    expect(res.body.meta.total).toBe(1);

    const rejected = await request(app).get('/api/admin/lyric-edits?status=rejected').set(auth);
    expect(rejected.body.data.map((row: { id: number }) => row.id)).toEqual([1]);
  });
});

describe('POST /api/admin/lyric-edits/:id/approve', () => {
  beforeEach(async () => {
    await request(app).post(PATH).send({ lyrics: CORRECTED });
  });

  it('publie les paroles proposées', async () => {
    const res = await request(app).post('/api/admin/lyric-edits/1/approve').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(edits.published.get('mpihira/hira')).toBe(CORRECTED);
  });

  it('publie le texte retouché par l’administration', async () => {
    const retouched = `${CORRECTED}\nAmpiana andalana`;
    const res = await request(app)
      .post('/api/admin/lyric-edits/1/approve')
      .set(auth)
      .send({ lyrics: retouched });

    expect(res.status).toBe(200);
    expect(edits.published.get('mpihira/hira')).toBe(retouched);
  });

  it('laisse les paroles en place quand la proposition est refusée', async () => {
    const res = await request(app).post('/api/admin/lyric-edits/1/reject').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(edits.published.get('mpihira/hira')).toBe('Andalana');
  });

  it('répond 409 quand la proposition a déjà été traitée', async () => {
    await request(app).post('/api/admin/lyric-edits/1/approve').set(auth);
    const again = await request(app).post('/api/admin/lyric-edits/1/approve').set(auth);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('already_reviewed');
  });

  it('répond 404 pour une proposition inconnue', async () => {
    expect((await request(app).post('/api/admin/lyric-edits/99/approve').set(auth)).status).toBe(
      404,
    );
  });
});

describe('GET /api/admin/overview', () => {
  it('compte les propositions en attente', async () => {
    await request(app).post(PATH).send({ lyrics: CORRECTED });
    const res = await request(app).get('/api/admin/overview').set(auth);
    expect(res.body.data.pendingEdits).toBe(1);
  });
});
