/**
 * Lecture seule de la base de collecte écrite par data/ (schéma :
 * contracts/crawl-state.sql). L'API n'y écrit jamais : toute modification passe
 * par la ligne de commande Python.
 */
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { Page } from '../catalog.js';

export const CRAWL_STATUSES = ['pending', 'done', 'error', 'gone'] as const;
export type CrawlStatus = (typeof CRAWL_STATUSES)[number];
export const CRAWL_SORTS = ['recent', 'stale', 'title'] as const;
export type CrawlSort = (typeof CRAWL_SORTS)[number];

export interface CrawlStats {
  pending: number;
  done: number;
  error: number;
  gone: number;
  total: number;
  listPages: number;
  lastPage: number | null;
  lastListFetchedAt: string | null;
  lastSongUpdatedAt: string | null;
}

export interface CrawlSongRow {
  url: string;
  artistSlug: string;
  slug: string;
  title: string;
  artists: { slug: string; name: string }[];
  status: CrawlStatus;
  attempts: number;
  error: string | null;
  discoveredAt: string;
  updatedAt: string;
  scrapedAt: string | null;
  checkedAt: string | null;
  changedAt: string | null;
}

export interface ListPageRow {
  page: number;
  songCount: number;
  fetchedAt: string;
}

export interface CrawlSongQuery {
  page: number;
  limit: number;
  status?: CrawlStatus | undefined;
  q?: string | undefined;
  sort: CrawlSort;
}

/** Ce que l'administration lit de la collecte (implémenté en mémoire dans les tests). */
export interface CrawlStateSource {
  stats(): CrawlStats | null;
  songs(query: CrawlSongQuery): Page<CrawlSongRow>;
  listPages(query: { page: number; limit: number }): Page<ListPageRow>;
}

type Row = Record<string, unknown>;

const SONG_ORDER: Record<CrawlSort, string> = {
  recent: 'updated_at DESC, rowid DESC',
  // Jamais vérifiées d'abord, puis les vérifications les plus anciennes.
  stale: 'checked_at IS NOT NULL, checked_at, updated_at, rowid',
  title: 'title COLLATE NOCASE, rowid',
};

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);
const text = (value: unknown) => (value === null || value === undefined ? null : String(value));

function parseArtists(raw: unknown): { slug: string; name: string }[] {
  if (typeof raw !== 'string') return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as { slug: string; name: string }[]) : [];
  } catch {
    return [];
  }
}

export class SqliteCrawlState implements CrawlStateSource {
  constructor(
    private readonly path: string,
    private readonly source = 'serasera',
  ) {}

  private read<T>(fallback: T, fn: (db: DatabaseSync) => T): T {
    if (!existsSync(this.path)) return fallback;
    const db = new DatabaseSync(this.path, { readOnly: true });
    try {
      return fn(db);
    } finally {
      db.close();
    }
  }

  stats(): CrawlStats | null {
    return this.read(null, (db) => {
      const counts = { pending: 0, done: 0, error: 0, gone: 0 };
      const rows = db
        .prepare('SELECT status, COUNT(*) AS n FROM songs WHERE source = ? GROUP BY status')
        .all(this.source) as Row[];
      for (const row of rows) {
        if (row.status && String(row.status) in counts) {
          counts[String(row.status) as CrawlStatus] = Number(row.n);
        }
      }
      const lists = db
        .prepare('SELECT COUNT(*) AS n, MAX(fetched_at) AS last FROM list_pages WHERE source = ?')
        .get(this.source) as Row;
      const songs = db
        .prepare('SELECT MAX(updated_at) AS last FROM songs WHERE source = ?')
        .get(this.source) as Row;
      const lastPage = db
        .prepare('SELECT value FROM meta WHERE key = ?')
        .get(`${this.source}:last_page`) as Row | undefined;
      return {
        ...counts,
        total: counts.pending + counts.done + counts.error + counts.gone,
        listPages: Number(lists.n),
        lastPage: lastPage ? Number(lastPage.value) : null,
        lastListFetchedAt: text(lists.last),
        lastSongUpdatedAt: text(songs.last),
      };
    });
  }

  songs({ page, limit, status, q, sort }: CrawlSongQuery): Page<CrawlSongRow> {
    return this.read({ items: [], total: 0 }, (db) => {
      const where = ['source = ?'];
      const params: (string | number)[] = [this.source];
      if (status) {
        where.push('status = ?');
        params.push(status);
      }
      if (q) {
        const pattern = `%${escapeLike(q)}%`;
        where.push(
          "(title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\'" +
            " OR json_extract(data, '$.artists') LIKE ? ESCAPE '\\')",
        );
        params.push(pattern, pattern, pattern);
      }
      const clause = where.join(' AND ');
      const total = Number(
        (db.prepare(`SELECT COUNT(*) AS n FROM songs WHERE ${clause}`).get(...params) as Row).n,
      );
      const rows = db
        .prepare(
          `SELECT url, artist_slug, slug, title, status, attempts, error, discovered_at,
                  updated_at, checked_at, changed_at,
                  json_extract(data, '$.scraped_at') AS scraped_at,
                  json_extract(data, '$.artists') AS artists
           FROM songs WHERE ${clause}
           ORDER BY ${SONG_ORDER[sort]} LIMIT ? OFFSET ?`,
        )
        .all(...params, limit, (page - 1) * limit) as Row[];
      return {
        total,
        items: rows.map((row) => ({
          url: String(row.url),
          artistSlug: String(row.artist_slug),
          slug: String(row.slug),
          title: String(row.title),
          artists: parseArtists(row.artists),
          status: String(row.status) as CrawlStatus,
          attempts: Number(row.attempts),
          error: text(row.error),
          discoveredAt: String(row.discovered_at),
          updatedAt: String(row.updated_at),
          scrapedAt: text(row.scraped_at),
          checkedAt: text(row.checked_at),
          changedAt: text(row.changed_at),
        })),
      };
    });
  }

  listPages({ page, limit }: { page: number; limit: number }): Page<ListPageRow> {
    return this.read({ items: [], total: 0 }, (db) => {
      const total = Number(
        (db.prepare('SELECT COUNT(*) AS n FROM list_pages WHERE source = ?').get(this.source) as Row)
          .n,
      );
      const rows = db
        .prepare(
          'SELECT page, song_count, fetched_at FROM list_pages WHERE source = ?' +
            ' ORDER BY page LIMIT ? OFFSET ?',
        )
        .all(this.source, limit, (page - 1) * limit) as Row[];
      return {
        total,
        items: rows.map((row) => ({
          page: Number(row.page),
          songCount: Number(row.song_count),
          fetchedAt: String(row.fetched_at),
        })),
      };
    });
  }
}
