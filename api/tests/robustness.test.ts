import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { JobRunner } from '../src/admin/jobs.js';
import { defaultPythonBin, ProcessPythonRunner, pythonEnv } from '../src/admin/python.js';
import { createApp } from '../src/app.js';
import { schemaModels, staleClientModels } from '../src/db.js';
import { describeServiceError } from '../src/middleware/errors.js';
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

describe('erreurs serveur', () => {
  function app(options: { exposeErrors?: boolean } = {}) {
    const catalog = new FakeCatalog();
    return {
      catalog,
      app: createApp({ catalog, corsOrigins: [], rateLimitPerMinute: false, ...options }),
    };
  }

  it('base non migrée : 503 avec la commande à lancer, pas une 500 muette', async () => {
    const { catalog, app: server } = app();
    catalog.failWith = Object.assign(new Error('The table `lyric_edits` does not exist'), {
      code: 'P2021',
    });
    const res = await request(server).get('/api/stats');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({ code: 'database_outdated' });
    expect(res.body.error.message).toContain('npm run db:migrate');
  });

  it('base injoignable : 503 explicite', () => {
    const error = Object.assign(new Error('connect'), { cause: { code: 'ECONNREFUSED' } });
    expect(describeServiceError(error)?.code).toBe('database_unavailable');
    expect(describeServiceError(new TypeError('x'))).toBeNull();
  });

  it('cause jointe en développement seulement', async () => {
    const dev = app({ exposeErrors: true });
    dev.catalog.failWith = new TypeError("Cannot read properties of undefined (reading 'count')");
    const res = await request(dev.app).get('/api/stats');
    expect(res.status).toBe(500);
    expect(res.body.error.debug).toContain("reading 'count'");

    const prod = app();
    prod.catalog.failWith = new TypeError('secret');
    expect((await request(prod.app).get('/api/stats')).body.error.debug).toBeUndefined();
  });
});

describe('client Prisma', () => {
  it('lit les modèles du schéma', () => {
    expect(schemaModels('model Song {\n}\n/// doc\nmodel LyricEdit {\n}\n')).toEqual([
      'Song',
      'LyricEdit',
    ]);
  });

  it('signale un client généré avant l’ajout d’un modèle', () => {
    expect(staleClientModels(['Song', 'LyricEdit'], ['Song'])).toEqual(['LyricEdit']);
  });

  it('le client généré correspond au schéma (sinon : npm run db:generate -w api)', () => {
    expect(staleClientModels()).toEqual([]);
  });
});

describe('Python sous Linux et Windows', () => {
  it('trouve le Python du venv selon le système', () => {
    expect(defaultPythonBin('/srv/tononkira/data', 'linux')).toBe(
      '/srv/tononkira/data/.venv/bin/python',
    );
    expect(defaultPythonBin('C:\\tononkira\\data', 'win32')).toBe(
      'C:\\tononkira\\data\\.venv\\Scripts\\python.exe',
    );
  });

  it('transmet ce qu’il faut pour démarrer, jamais les secrets de l’API', () => {
    const env = pythonEnv({
      Path: 'C:\\Windows',
      SystemRoot: 'C:\\Windows',
      HTTPS_PROXY: 'http://proxy:3128',
      DATABASE_URL: 'postgresql://secret',
      ADMIN_TOKEN: 'secret',
    });
    expect(env).toMatchObject({
      PATH: 'C:\\Windows',
      SYSTEMROOT: 'C:\\Windows',
      HTTPS_PROXY: 'http://proxy:3128',
      PYTHONIOENCODING: 'utf-8',
    });
    expect(JSON.stringify(env)).not.toContain('secret');
  });

  it('Python absent : erreur 503 avec la marche à suivre', async () => {
    const runner = new ProcessPythonRunner('/chemin/inexistant/python', process.cwd());
    await expect(runner.run(['stats'])).rejects.toMatchObject({
      status: 503,
      code: 'python_unavailable',
    });
  });
});

describe('corps de requête invalide', () => {
  it('JSON mal formé : 400, pas 500', async () => {
    const catalog = new FakeCatalog();
    const python = new FakePython();
    const jobStore = new MemoryJobStore();
    const jobs = new JobRunner({
      store: jobStore,
      python,
      importer: new FakeFileImporter(),
      exportPath: '/tmp/songs.jsonl',
    });
    const server = createApp({
      catalog,
      corsOrigins: [],
      rateLimitPerMinute: false,
      admin: {
        token: TOKEN,
        catalog,
        crawl: new FakeCrawlState(),
        jobs,
        jobStore,
        python,
        library: new FakeLibrary(),
        edits: new FakeLyricEdits(),
      },
    });
    const res = await request(server)
      .post('/api/admin/jobs')
      .set('Authorization', `Bearer ${TOKEN}`)
      .set('Content-Type', 'application/json')
      .send('{"type": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });
});
