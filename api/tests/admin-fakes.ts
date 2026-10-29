import type { Page } from '../src/catalog.js';
import type {
  CrawlSongQuery,
  CrawlSongRow,
  CrawlStateSource,
  CrawlStats,
  ListPageRow,
} from '../src/admin/crawl-state.js';
import type {
  FileImporter,
  JobOptions,
  JobRecord,
  JobStatus,
  JobStore,
  JobSummary,
  JobType,
} from '../src/admin/jobs.js';
import type { CatalogEntry, SongLibrary } from '../src/admin/prisma-adapters.js';
import type { PythonEvent, PythonRunHandlers, PythonRunner } from '../src/admin/python.js';
import type { ImportReport, UpsertOutcome } from '../src/importer/import-songs.js';

export const TOKEN = 'jeton-de-test-suffisamment-long-0123456789';

export const CRAWL_SONG: CrawlSongRow = {
  url: 'https://tononkira.serasera.org/hira/magma/potika',
  artistSlug: 'magma',
  slug: 'potika',
  title: 'potika',
  artists: [{ slug: 'magma', name: 'MAGMA' }],
  status: 'done',
  attempts: 0,
  error: null,
  discoveredAt: '2026-10-29T06:59:00+00:00',
  updatedAt: '2026-10-29T07:00:00+00:00',
  scrapedAt: '2026-10-29T07:00:00+00:00',
  checkedAt: null,
  changedAt: '2026-10-29T07:00:00+00:00',
};

export class FakeCrawlState implements CrawlStateSource {
  lastSongsQuery: CrawlSongQuery | null = null;
  statsValue: CrawlStats | null = {
    pending: 2,
    done: 1,
    error: 0,
    gone: 0,
    total: 3,
    listPages: 1,
    lastPage: 884,
    lastListFetchedAt: null,
    lastSongUpdatedAt: null,
  };

  stats() {
    return this.statsValue;
  }

  songs(query: CrawlSongQuery): Page<CrawlSongRow> {
    this.lastSongsQuery = query;
    return { items: [CRAWL_SONG], total: 1 };
  }

  listPages(): Page<ListPageRow> {
    return { items: [{ page: 9, songCount: 20, fetchedAt: '2026-10-29T07:00:00+00:00' }], total: 1 };
  }
}

export interface PythonScript {
  events?: PythonEvent[];
  logs?: string[];
  code?: number;
  /** Ne termine qu'à l'arrêt demandé (code 130, comme la ligne de commande). */
  waitForAbort?: boolean;
}

export class FakePython implements PythonRunner {
  calls: string[][] = [];
  script: PythonScript = { code: 0 };

  run(args: string[], { onEvent, onLog, signal }: PythonRunHandlers = {}) {
    this.calls.push(args);
    const { events = [], logs = [], code = 0, waitForAbort } = this.script;
    logs.forEach((line) => onLog?.(line));
    events.forEach((event) => onEvent?.(event));
    if (!waitForAbort) return Promise.resolve({ code });
    return new Promise<{ code: number | null }>((resolve) => {
      signal?.addEventListener('abort', () => resolve({ code: 130 }), { once: true });
    });
  }
}

export class MemoryJobStore implements JobStore {
  jobs: JobRecord[] = [];

  async create(type: JobType, options: JobOptions) {
    const job: JobRecord = {
      id: this.jobs.length + 1,
      type,
      options,
      status: 'running',
      summary: {},
      log: '',
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    this.jobs.push(job);
    return { id: job.id, startedAt: new Date(job.startedAt) };
  }

  async finish(id: number, status: JobStatus, summary: JobSummary, log: string) {
    const job = this.jobs.find((candidate) => candidate.id === id)!;
    Object.assign(job, { status, summary, log, finishedAt: new Date().toISOString() });
  }

  async list({ page, limit }: { page: number; limit: number }) {
    const items = [...this.jobs].reverse().slice((page - 1) * limit, page * limit);
    return { items, total: this.jobs.length };
  }

  async get(id: number) {
    return this.jobs.find((job) => job.id === id) ?? null;
  }

  async interruptRunning() {
    return 0;
  }
}

export const IMPORT_REPORT: ImportReport = {
  lines: 3,
  created: 1,
  updated: 1,
  unchanged: 1,
  invalid: 0,
  failed: 0,
};

export class FakeFileImporter implements FileImporter {
  paths: string[] = [];

  async importFile(path: string, { onProgress }: Parameters<FileImporter['importFile']>[1]) {
    this.paths.push(path);
    onProgress(IMPORT_REPORT);
    return IMPORT_REPORT;
  }
}

export class FakeLibrary implements SongLibrary {
  imported: unknown[] = [];
  catalog = new Map<string, CatalogEntry>([
    [CRAWL_SONG.url, { artistSlug: 'magma', slug: 'potika' }],
  ]);

  async findBySourceUrls(urls: string[]) {
    return new Map([...this.catalog].filter(([url]) => urls.includes(url)));
  }

  async importSong(raw: unknown): Promise<UpsertOutcome> {
    this.imported.push(raw);
    return 'updated';
  }
}
