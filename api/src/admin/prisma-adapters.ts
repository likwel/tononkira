/** Implémentations Prisma des besoins de l'administration (historique des tâches, import). */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { Page } from '../catalog.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { importSongs, SongImporter, type UpsertOutcome } from '../importer/import-songs.js';
import { parseSongLine } from '../importer/song-line.js';
import { HttpError } from '../lib/http-error.js';
import type {
  FileImporter,
  JobOptions,
  JobRecord,
  JobStatus,
  JobStore,
  JobSummary,
  JobType,
} from './jobs.js';

export interface CatalogEntry {
  artistSlug: string;
  slug: string;
}

/** Ce que l'administration demande à la base au sujet des chansons collectées. */
export interface SongLibrary {
  /** Chansons déjà présentes dans le catalogue public, par URL source. */
  findBySourceUrls(urls: string[]): Promise<Map<string, CatalogEntry>>;
  /** Importe une chanson collectée (même règle que l'import JSONL). */
  importSong(raw: unknown): Promise<UpsertOutcome>;
}

type JobRow = {
  id: number;
  type: string;
  options: Prisma.JsonValue;
  status: string;
  summary: Prisma.JsonValue;
  log?: string;
  startedAt: Date;
  finishedAt: Date | null;
};

function toRecord(row: JobRow): JobRecord {
  return {
    id: row.id,
    type: row.type as JobType,
    options: (row.options ?? {}) as JobOptions,
    status: row.status as JobStatus,
    summary: (row.summary ?? {}) as JobSummary,
    log: row.log ?? '',
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

const listSelect = {
  id: true,
  type: true,
  options: true,
  status: true,
  summary: true,
  startedAt: true,
  finishedAt: true,
} as const;

export class PrismaJobStore implements JobStore {
  constructor(private readonly db: PrismaClient) {}

  create(type: JobType, options: JobOptions) {
    return this.db.crawlJob.create({
      data: { type, options: options as Prisma.InputJsonObject, status: 'running' },
      select: { id: true, startedAt: true },
    });
  }

  async finish(id: number, status: JobStatus, summary: JobSummary, log: string) {
    await this.db.crawlJob.update({
      where: { id },
      data: {
        status,
        summary: summary as unknown as Prisma.InputJsonObject,
        log,
        finishedAt: new Date(),
      },
    });
  }

  async list({ page, limit }: { page: number; limit: number }): Promise<Page<JobRecord>> {
    const [total, rows] = await Promise.all([
      this.db.crawlJob.count(),
      this.db.crawlJob.findMany({
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: listSelect,
      }),
    ]);
    return { total, items: rows.map(toRecord) };
  }

  async get(id: number) {
    const row = await this.db.crawlJob.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async interruptRunning() {
    const { count } = await this.db.crawlJob.updateMany({
      where: { status: 'running' },
      data: { status: 'interrupted', finishedAt: new Date() },
    });
    return count;
  }
}

export class PrismaSongLibrary implements SongLibrary {
  constructor(private readonly db: PrismaClient) {}

  async findBySourceUrls(urls: string[]) {
    if (!urls.length) return new Map<string, CatalogEntry>();
    const rows = await this.db.song.findMany({
      where: { sourceUrl: { in: urls } },
      select: { sourceUrl: true, artistSlug: true, slug: true },
    });
    return new Map(rows.map((row) => [row.sourceUrl, { artistSlug: row.artistSlug, slug: row.slug }]));
  }

  importSong(raw: unknown) {
    const parsed = parseSongLine(JSON.stringify(raw));
    if (!parsed.ok) {
      throw new HttpError(422, 'invalid_song', `Chanson collectée invalide : ${parsed.error}`);
    }
    return new SongImporter(this.db).upsert(parsed.song);
  }
}

export class PrismaFileImporter implements FileImporter {
  constructor(private readonly db: PrismaClient) {}

  importFile(path: string, { onProgress, signal, logger }: Parameters<FileImporter['importFile']>[1]) {
    const lines = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
    return importSongs(this.db, lines, logger, { onProgress, signal, progressEvery: 200 });
  }
}
