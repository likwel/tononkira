/**
 * Tâches longues lancées depuis l'administration : une seule à la fois. Chaque tâche
 * lance la ligne de commande Python (collecte, mise à jour, revérification ou simple
 * export), suit sa progression, puis importe le JSONL dans la base.
 */
import type { Page } from '../catalog.js';
import { describeImport, type ImportLogger, type ImportReport } from '../importer/import-songs.js';
import { HttpError } from '../lib/http-error.js';
import type { PythonEvent, PythonRunner } from './python.js';

export const JOB_TYPES = ['crawl', 'update', 'recheck', 'import'] as const;
export type JobType = (typeof JOB_TYPES)[number];
export type JobStatus = 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';

export interface JobOptions {
  from?: number | undefined;
  to?: number | undefined;
  limit?: number | undefined;
  /** Secondes entre deux requêtes vers la source. */
  delay?: number | undefined;
  retryErrors?: boolean | undefined;
  refreshLists?: boolean | undefined;
  /** Importer dans la base à la fin (oui par défaut). */
  importAfter?: boolean | undefined;
}

export interface JobSummary {
  lists?: { pages: number; found: number; new: number };
  songs?: { total: number; saved: number; gone: number; errors: number };
  recheck?: {
    total: number;
    new: number;
    updated: number;
    unchanged: number;
    gone: number;
    errors: number;
  };
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
  log: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface JobSnapshot extends Omit<JobRecord, 'log'> {
  progress: JobProgress | null;
  logs: string[];
}

export interface JobStore {
  create(type: JobType, options: JobOptions): Promise<{ id: number; startedAt: Date }>;
  finish(id: number, status: JobStatus, summary: JobSummary, log: string): Promise<void>;
  list(query: { page: number; limit: number }): Promise<Page<JobRecord>>;
  get(id: number): Promise<JobRecord | null>;
  /** Au démarrage : les tâches restées « en cours » ont été coupées par un arrêt du serveur. */
  interruptRunning(): Promise<number>;
}

export interface FileImporter {
  importFile(
    path: string,
    options: { onProgress: (report: ImportReport) => void; signal: AbortSignal; logger: ImportLogger },
  ): Promise<ImportReport>;
}

/** Arguments de `python -m tononkira_data` pour une tâche. */
export function pythonCommand(type: JobType, options: JobOptions, exportPath: string): string[] {
  const output = ['--events', '--out', exportPath];
  const delay = options.delay !== undefined ? ['--delay', String(options.delay)] : [];
  const limit = options.limit !== undefined ? ['--limit', String(options.limit)] : [];
  switch (type) {
    case 'crawl':
      return [
        'crawl',
        ...output,
        '--from',
        String(options.from ?? 1),
        ...(options.to !== undefined ? ['--to', String(options.to)] : []),
        ...limit,
        ...(options.retryErrors ? ['--retry-errors'] : []),
        ...(options.refreshLists ? ['--refresh-lists'] : []),
        ...delay,
      ];
    case 'update':
      return ['update', ...output, ...delay];
    case 'recheck':
      return ['recheck', ...output, ...limit, ...delay];
    case 'import':
      return ['export', ...output];
  }
}

const LIVE_LOG_LINES = 500;
const STORED_LOG_LINES = 300;

interface RunningJob {
  snapshot: JobSnapshot;
  controller: AbortController;
  done: Promise<void>;
}

const num = (event: PythonEvent, key: string) =>
  typeof event[key] === 'number' ? (event[key] as number) : 0;
const numOrNull = (event: PythonEvent, key: string) =>
  typeof event[key] === 'number' ? (event[key] as number) : null;

export class JobRunner {
  private running: RunningJob | null = null;
  private starting = false;
  private last: JobSnapshot | null = null;

  constructor(
    private readonly deps: {
      store: JobStore;
      python: PythonRunner;
      importer: FileImporter;
      exportPath: string;
    },
  ) {}

  /** Tâche en cours, sinon la dernière terminée depuis le démarrage du serveur. */
  current(): JobSnapshot | null {
    const snapshot = this.running?.snapshot ?? this.last;
    return snapshot ? structuredClone(snapshot) : null;
  }

  async start(type: JobType, options: JobOptions): Promise<JobSnapshot> {
    if (this.running || this.starting) {
      throw new HttpError(409, 'job_running', 'Une tâche est déjà en cours : attendez sa fin ou arrêtez-la.');
    }
    this.starting = true;
    let created: { id: number; startedAt: Date };
    try {
      created = await this.deps.store.create(type, options);
    } finally {
      this.starting = false;
    }
    const job: RunningJob = {
      snapshot: {
        id: created.id,
        type,
        options,
        status: 'running',
        summary: {},
        startedAt: created.startedAt.toISOString(),
        finishedAt: null,
        progress: null,
        logs: [],
      },
      controller: new AbortController(),
      done: Promise.resolve(),
    };
    this.running = job;
    job.done = this.execute(job);
    return structuredClone(job.snapshot);
  }

  cancel(id: number): boolean {
    const job = this.running;
    if (!job || job.snapshot.id !== id) return false;
    this.log(job, 'Arrêt demandé…');
    job.controller.abort();
    return true;
  }

  /** Attend la fin de la tâche en cours (tests, arrêt du serveur). */
  async idle(): Promise<void> {
    await this.running?.done;
  }

  private async execute(job: RunningJob): Promise<void> {
    const { snapshot, controller } = job;
    let status: JobStatus = 'succeeded';
    try {
      const args = pythonCommand(snapshot.type, snapshot.options, this.deps.exportPath);
      this.log(job, `› tononkira_data ${args.join(' ')}`);
      const { code } = await this.deps.python.run(args, {
        signal: controller.signal,
        onLog: (line) => this.log(job, line),
        onEvent: (event) => this.onEvent(job, event),
      });
      if (controller.signal.aborted) {
        status = 'cancelled';
      } else if (code !== 0) {
        throw new Error(`la commande Python s'est terminée avec le code ${code}`);
      } else if (snapshot.type === 'import' || snapshot.options.importAfter !== false) {
        await this.importExport(job);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        status = 'cancelled';
      } else {
        status = 'failed';
        snapshot.summary.error = error instanceof Error ? error.message : String(error);
        this.log(job, `Échec : ${snapshot.summary.error}`);
      }
    }

    snapshot.status = status;
    snapshot.finishedAt = new Date().toISOString();
    snapshot.progress = status === 'succeeded' ? null : snapshot.progress;
    if (status === 'cancelled') this.log(job, 'Tâche arrêtée. Relancer reprend là où elle s’est arrêtée.');
    try {
      await this.deps.store.finish(
        snapshot.id,
        status,
        snapshot.summary,
        snapshot.logs.slice(-STORED_LOG_LINES).join('\n'),
      );
    } catch (error) {
      this.log(job, `Historique non enregistré : ${String(error)}`);
    }
    this.last = snapshot;
    this.running = null;
  }

  private async importExport(job: RunningJob): Promise<void> {
    const { snapshot, controller } = job;
    const total = snapshot.summary.exported ?? null;
    snapshot.progress = { phase: 'import', current: 0, total };
    this.log(job, 'Import dans la base (mise à jour par URL source, sans suppression)…');
    const report = await this.deps.importer.importFile(this.deps.exportPath, {
      signal: controller.signal,
      logger: { info: (line) => this.log(job, line), warn: (line) => this.log(job, line) },
      onProgress: (progress) => {
        snapshot.summary.import = progress;
        snapshot.progress = { phase: 'import', current: progress.lines, total };
      },
    });
    snapshot.summary.import = report;
    this.log(job, `Import terminé : ${describeImport(report)}.`);
  }

  private onEvent(job: RunningJob, event: PythonEvent): void {
    const { snapshot } = job;
    switch (event.event) {
      case 'phase':
        if (event.phase === 'songs' || event.phase === 'recheck') {
          snapshot.progress = { phase: event.phase, current: 0, total: num(event, 'total') };
        } else if (event.phase === 'lists') {
          snapshot.progress = { phase: 'lists', current: 0, total: numOrNull(event, 'to') };
        }
        break;
      case 'list_page': {
        snapshot.progress = { phase: 'lists', current: num(event, 'page'), total: numOrNull(event, 'last') };
        const lists = snapshot.summary.lists ?? { pages: 0, found: 0, new: 0 };
        snapshot.summary.lists = {
          pages: lists.pages + 1,
          found: lists.found + num(event, 'found'),
          new: lists.new + num(event, 'new'),
        };
        break;
      }
      case 'lists_done':
        snapshot.summary.lists = { pages: num(event, 'pages'), found: num(event, 'found'), new: num(event, 'new') };
        break;
      case 'song':
      case 'songs_done':
        if (event.event === 'song') {
          snapshot.progress = { phase: 'songs', current: num(event, 'index'), total: num(event, 'total') };
        }
        snapshot.summary.songs = {
          total: num(event, 'total'),
          saved: num(event, 'saved'),
          gone: num(event, 'gone'),
          errors: num(event, 'errors'),
        };
        break;
      case 'recheck':
      case 'recheck_done':
        if (event.event === 'recheck') {
          snapshot.progress = { phase: 'recheck', current: num(event, 'index'), total: num(event, 'total') };
        }
        snapshot.summary.recheck = {
          total: num(event, 'total'),
          new: num(event, 'new'),
          updated: num(event, 'updated'),
          unchanged: num(event, 'unchanged'),
          gone: num(event, 'gone'),
          errors: num(event, 'errors'),
        };
        break;
      case 'exported':
        snapshot.summary.exported = num(event, 'count');
        snapshot.progress = { phase: 'export', current: num(event, 'count'), total: num(event, 'count') };
        break;
    }
  }

  private log(job: RunningJob, line: string): void {
    const { logs } = job.snapshot;
    logs.push(line);
    if (logs.length > LIVE_LOG_LINES) logs.splice(0, logs.length - LIVE_LOG_LINES);
  }
}
