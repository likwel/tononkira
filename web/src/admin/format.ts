import { formatNumber, plural } from '../lib/format';
import type {
  CrawlStatus,
  JobOptions,
  JobProgress,
  JobStatus,
  JobSummary,
  JobType,
  RefreshResult,
} from './types';

export const JOB_LABEL: Record<JobType, string> = {
  crawl: 'Collecte',
  update: 'Nouveautés',
  recheck: 'Revérification',
  import: 'Import',
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  running: 'En cours',
  succeeded: 'Terminée',
  failed: 'Échec',
  cancelled: 'Arrêtée',
  interrupted: 'Interrompue',
};

export const CRAWL_STATUS_LABEL: Record<CrawlStatus, string> = {
  done: 'Collectée',
  pending: 'En attente',
  error: 'Erreur',
  gone: 'Disparue',
};

const PHASE_LABEL: Record<JobProgress['phase'], string> = {
  lists: 'Pages de liste',
  songs: 'Chansons',
  recheck: 'Revérification',
  export: 'Export',
  import: 'Import en base',
};

const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
const dateTime = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Indian/Antananarivo',
});

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
];

/** « il y a 5 minutes », « hier »… ; `null` → tiret. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '—';
  const seconds = Math.round((time - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "à l'instant";
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateTime.format(date).replace(/[  ]/g, ' ');
}

/** Durée lisible : « 45 s », « 3 min 12 s », « 2 h 05 ». */
export function formatDuration(start: string, end: string | null, now = Date.now()): string {
  const seconds = Math.max(0, Math.round(((end ? new Date(end).getTime() : now) - new Date(start).getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
  return `${Math.floor(seconds / 3600)} h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}`;
}

export function describeOptions(type: JobType, options: JobOptions): string {
  const parts: string[] = [];
  if (type === 'crawl') {
    parts.push(options.to ? `pages ${options.from ?? 1} à ${options.to}` : `depuis la page ${options.from ?? 1}`);
  }
  if (options.limit) parts.push(`${formatNumber(options.limit)} chansons max.`);
  if (options.retryErrors) parts.push('erreurs retentées');
  if (options.refreshLists) parts.push('listes relues');
  if (options.delay) parts.push(`délai ${String(options.delay).replace('.', ',')} s`);
  if (type !== 'import' && options.importAfter === false) parts.push('sans import');
  return parts.join(' · ');
}

/** Résumé d'une tâche en quelques phrases courtes. */
export function describeSummary(summary: JobSummary): string[] {
  const lines: string[] = [];
  if (summary.lists) {
    lines.push(
      `${plural(summary.lists.pages, 'page')} de liste lue${summary.lists.pages > 1 ? 's' : ''}, ` +
        `${plural(summary.lists.new, 'nouvelle chanson', 'nouvelles chansons')}`,
    );
  }
  if (summary.songs) {
    lines.push(
      `${plural(summary.songs.saved, 'chanson collectée', 'chansons collectées')}` +
        (summary.songs.gone ? `, ${formatNumber(summary.songs.gone)} disparue(s)` : '') +
        (summary.songs.errors ? `, ${plural(summary.songs.errors, 'erreur')}` : ''),
    );
  }
  if (summary.recheck) {
    const r = summary.recheck;
    lines.push(
      `${formatNumber(r.updated)} modifiée(s), ${formatNumber(r.unchanged)} inchangée(s)` +
        (r.gone ? `, ${formatNumber(r.gone)} disparue(s)` : '') +
        (r.errors ? `, ${plural(r.errors, 'erreur')}` : ''),
    );
  }
  if (summary.import) {
    const i = summary.import;
    lines.push(
      `Base : ${formatNumber(i.created)} créée(s), ${formatNumber(i.updated)} mise(s) à jour, ` +
        `${formatNumber(i.unchanged)} inchangée(s)` +
        (i.failed ? `, ${formatNumber(i.failed)} en échec` : ''),
    );
  }
  return lines;
}

export function describeProgress(progress: JobProgress): { label: string; percent: number | null } {
  const { phase, current, total } = progress;
  const label =
    phase === 'lists'
      ? `${PHASE_LABEL[phase]} : page ${formatNumber(current)}${total ? ` / ${formatNumber(total)}` : ''}`
      : `${PHASE_LABEL[phase]} : ${formatNumber(current)}${total ? ` / ${formatNumber(total)}` : ''}`;
  const percent = total ? Math.min(100, Math.round((current / total) * 100)) : null;
  return { label, percent };
}

export function describeRefresh(result: RefreshResult): { text: string; tone: 'ok' | 'changed' | 'muted' | 'error' } {
  const catalog =
    result.imported === 'created'
      ? ' · ajoutée au catalogue'
      : result.imported === 'updated'
        ? ' · catalogue mis à jour'
        : '';
  switch (result.status) {
    case 'new':
      return { text: `Collectée${catalog}`, tone: 'changed' };
    case 'updated':
      return { text: `Modifiée : ${result.changes.join(', ')}${catalog}`, tone: 'changed' };
    case 'unchanged':
      return {
        text: `À jour${result.stats.length ? ` (${result.stats.join(', ')} actualisées)` : ''}`,
        tone: 'ok',
      };
    case 'gone':
      return { text: 'Disparue de la source', tone: 'muted' };
    default:
      return { text: `Échec : ${result.error ?? 'erreur inconnue'}`, tone: 'error' };
  }
}
