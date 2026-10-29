/** Miroir des réponses de /api/admin (api/src/admin). */
import type { PageMeta, Stats } from '../lib/types';

export type CrawlStatus = 'pending' | 'done' | 'error' | 'gone';
export type CrawlSort = 'recent' | 'stale' | 'title';
export type JobType = 'crawl' | 'update' | 'recheck' | 'import';
export type JobStatus = 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';

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

export interface CatalogEntry {
  artistSlug: string;
  slug: string;
}

export interface CrawlSong {
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
  catalog: CatalogEntry | null;
}

export interface ListPage {
  page: number;
  songCount: number;
  fetchedAt: string;
}

export interface JobOptions {
  from?: number;
  to?: number;
  limit?: number;
  delay?: number;
  retryErrors?: boolean;
  refreshLists?: boolean;
  importAfter?: boolean;
}

export interface ImportReport {
  lines: number;
  created: number;
  updated: number;
  unchanged: number;
  invalid: number;
  failed: number;
}

export interface JobSummary {
  lists?: { pages: number; found: number; new: number };
  songs?: { total: number; saved: number; gone: number; errors: number };
  recheck?: { total: number; new: number; updated: number; unchanged: number; gone: number; errors: number };
  exported?: number;
  import?: ImportReport;
  error?: string;
}

export interface JobProgress {
  phase: 'lists' | 'songs' | 'recheck' | 'export' | 'import';
  current: number;
  total: number | null;
}

export interface JobRecord {
  id: number;
  type: JobType;
  options: JobOptions;
  status: JobStatus;
  summary: JobSummary;
  startedAt: string;
  finishedAt: string | null;
  log?: string;
}

export interface JobSnapshot extends JobRecord {
  progress: JobProgress | null;
  logs: string[];
}

export interface Overview {
  db: Stats;
  crawl: CrawlStats | null;
  job: JobSnapshot | null;
}

export interface RefreshResult {
  url: string;
  status: 'new' | 'updated' | 'unchanged' | 'gone' | 'error';
  changes: string[];
  stats: string[];
  error: string | null;
  imported: 'created' | 'updated' | 'unchanged' | null;
  catalog: CatalogEntry | null;
}

export interface ListPageRefresh {
  page: number;
  found: number;
  new: number;
  empty: boolean;
}

export interface AdminPage<T> {
  data: T[];
  meta: PageMeta & { lastPage?: number | null };
}
