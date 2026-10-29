import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { Catalog } from '../catalog.js';
import { HttpError } from '../lib/http-error.js';
import { pageMeta, parseQuery } from '../lib/query.js';
import { requireAdmin } from './auth.js';
import { CRAWL_SORTS, CRAWL_STATUSES, type CrawlStateSource } from './crawl-state.js';
import { JOB_TYPES, type JobRunner, type JobStore } from './jobs.js';
import type { SongLibrary } from './prisma-adapters.js';
import type { PythonEvent, PythonRunner } from './python.js';

export interface AdminDeps {
  token: string | undefined;
  catalog: Catalog;
  crawl: CrawlStateSource;
  jobs: JobRunner;
  jobStore: JobStore;
  python: PythonRunner;
  library: SongLibrary;
}

/** Seules ces pages peuvent être relues à la demande (pas de requête vers un site arbitraire). */
const SOURCE_HOSTS = ['tononkira.serasera.org'];

const page = z.coerce.number().int().min(1).max(100_000).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(25);

const pagesQuery = z.object({
  page,
  limit,
  status: z.enum(CRAWL_STATUSES).optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(CRAWL_SORTS).default('recent'),
});

const refreshBody = z.object({ url: z.string().trim().max(500) });

const pageNumber = z.coerce.number().int().min(1).max(100_000);

const jobBody = z
  .object({
    type: z.enum(JOB_TYPES),
    options: z
      .object({
        from: z.number().int().min(1).max(100_000).optional(),
        to: z.number().int().min(1).max(100_000).optional(),
        limit: z.number().int().min(1).max(100_000).optional(),
        // Plancher de politesse envers le site source.
        delay: z.number().min(0.5, 'au moins 0,5 s entre deux requêtes').max(60).optional(),
        retryErrors: z.boolean().optional(),
        refreshLists: z.boolean().optional(),
        importAfter: z.boolean().optional(),
      })
      .strict()
      .default({}),
  })
  .refine((body) => !(body.options.from && body.options.to && body.options.to < body.options.from), {
    message: 'la dernière page doit suivre la première',
    path: ['options', 'to'],
  });

const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

export function assertSongUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw HttpError.badRequest('URL invalide');
  }
  if (url.protocol !== 'https:' || !SOURCE_HOSTS.includes(url.host) || !url.pathname.startsWith('/hira/')) {
    throw HttpError.badRequest(
      `Seules les pages de chansons de ${SOURCE_HOSTS.join(', ')} peuvent être vérifiées`,
    );
  }
  return raw;
}

export function createAdminRouter(deps: AdminDeps): Router {
  const router = Router();
  router.use(noStore, requireAdmin(deps.token));

  router.get('/session', (_req, res) => {
    res.json({ data: { ok: true } });
  });

  router.get('/overview', async (_req, res) => {
    res.json({
      data: { db: await deps.catalog.stats(), crawl: deps.crawl.stats(), job: deps.jobs.current() },
    });
  });

  router.get('/pages', async (req, res) => {
    const query = parseQuery(pagesQuery, req.query);
    const { items, total } = deps.crawl.songs({ ...query, q: query.q || undefined });
    const inCatalog = await deps.library.findBySourceUrls(items.map((item) => item.url));
    res.json({
      data: items.map((item) => ({ ...item, catalog: inCatalog.get(item.url) ?? null })),
      meta: pageMeta(query, total),
    });
  });

  /** Relit une page de chanson, détecte les changements et met la base à jour. */
  router.post('/pages/refresh', async (req, res) => {
    const url = assertSongUrl(parseQuery(refreshBody, req.body).url);
    let result: PythonEvent | null = null;
    const logs: string[] = [];
    await deps.python.run(['refresh', '--url', url, '--json'], {
      onEvent: (event) => {
        result = event;
      },
      onLog: (line) => logs.push(line),
    });
    const outcome = result as PythonEvent | null;
    if (!outcome) {
      throw new HttpError(502, 'refresh_failed', `La vérification a échoué. ${logs.at(-1) ?? ''}`.trim());
    }
    const status = String(outcome.status);
    const imported =
      outcome.song && ['new', 'updated', 'unchanged'].includes(status)
        ? await deps.library.importSong(outcome.song)
        : null;
    const inCatalog = await deps.library.findBySourceUrls([url]);
    res.json({
      data: {
        url,
        status,
        changes: Array.isArray(outcome.changes) ? outcome.changes : [],
        stats: Array.isArray(outcome.stats) ? outcome.stats : [],
        error: typeof outcome.error === 'string' ? outcome.error : null,
        imported,
        catalog: inCatalog.get(url) ?? null,
      },
    });
  });

  router.get('/list-pages', (req, res) => {
    const query = parseQuery(z.object({ page, limit: limit.default(50) }), req.query);
    const { items, total } = deps.crawl.listPages(query);
    res.json({
      data: items,
      meta: { ...pageMeta(query, total), lastPage: deps.crawl.stats()?.lastPage ?? null },
    });
  });

  /** Relit une page de liste pour y repérer de nouvelles chansons. */
  router.post('/list-pages/:page/refresh', async (req, res) => {
    const number = parseQuery(pageNumber, req.params.page);
    let listed: PythonEvent | null = null;
    const logs: string[] = [];
    const { code } = await deps.python.run(
      ['crawl', '--from', String(number), '--to', String(number), '--lists-only', '--refresh-lists', '--no-export', '--events'],
      {
        onEvent: (event) => {
          if (event.event === 'list_page') listed = event;
        },
        onLog: (line) => logs.push(line),
      },
    );
    const outcome = listed as PythonEvent | null;
    if (code !== 0) {
      throw new HttpError(502, 'refresh_failed', `La relecture a échoué. ${logs.at(-1) ?? ''}`.trim());
    }
    res.json({
      data: {
        page: number,
        found: typeof outcome?.found === 'number' ? outcome.found : 0,
        new: typeof outcome?.new === 'number' ? outcome.new : 0,
        empty: outcome === null,
      },
    });
  });

  router.get('/jobs', async (req, res) => {
    const query = parseQuery(z.object({ page, limit: limit.default(20) }), req.query);
    const { items, total } = await deps.jobStore.list(query);
    res.json({ data: items, meta: pageMeta(query, total) });
  });

  router.get('/jobs/current', (_req, res) => {
    res.json({ data: deps.jobs.current() });
  });

  router.get('/jobs/:id', async (req, res) => {
    const id = parseQuery(pageNumber, req.params.id);
    const current = deps.jobs.current();
    if (current?.id === id) {
      res.json({ data: { ...current, log: current.logs.join('\n') } });
      return;
    }
    const job = await deps.jobStore.get(id);
    if (!job) throw HttpError.notFound('Tâche introuvable');
    res.json({ data: job });
  });

  router.post('/jobs', async (req, res) => {
    const { type, options } = parseQuery(jobBody, req.body);
    res.status(202).json({ data: await deps.jobs.start(type, options) });
  });

  router.post('/jobs/:id/cancel', (req, res) => {
    const id = parseQuery(pageNumber, req.params.id);
    if (!deps.jobs.cancel(id)) throw new HttpError(409, 'not_running', "Cette tâche n'est pas en cours");
    res.status(202).json({ data: { id, cancelling: true } });
  });

  return router;
}
