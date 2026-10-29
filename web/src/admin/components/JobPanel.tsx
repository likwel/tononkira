import { LoaderCircle, Square, TerminalSquare } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { buttonSecondary } from '../../components/ui';
import {
  describeOptions,
  describeProgress,
  describeSummary,
  formatDateTime,
  formatDuration,
  JOB_LABEL,
  timeAgo,
} from '../format';
import { useCancelJob } from '../queries';
import type { JobSnapshot } from '../types';
import { JobStatusBadge } from './Badges';

export function ProgressBar({ percent }: { percent: number | null }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="presentation">
      {percent === null ? (
        <div className="h-full w-1/3 animate-pulse rounded-full bg-accent/70" />
      ) : (
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      )}
    </div>
  );
}

/** Journal défilant : suit les nouvelles lignes tant qu'on est en bas. */
export function LogConsole({ lines, className = 'max-h-72' }: { lines: string[]; className?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const element = ref.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [lines.length]);

  if (!lines.length) return null;
  return (
    <pre
      ref={ref}
      onScroll={(event) => {
        const element = event.currentTarget;
        stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
      }}
      className={`${className} overflow-auto rounded-xl border border-line bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-ink-soft`}
      aria-label="Journal de la tâche"
    >
      {lines.join('\n')}
    </pre>
  );
}

export function JobPanel({ job }: { job: JobSnapshot }) {
  const cancel = useCancelJob();
  const running = job.status === 'running';
  const progress = job.progress ? describeProgress(job.progress) : null;
  const options = describeOptions(job.type, job.options);
  const summary = describeSummary(job.summary);

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-6" aria-live="polite">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl font-semibold tracking-tight">
              {JOB_LABEL[job.type]} <span className="text-muted">#{job.id}</span>
            </h2>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-sm text-muted" title={formatDateTime(job.startedAt)}>
            Lancée {timeAgo(job.startedAt)} · {formatDuration(job.startedAt, job.finishedAt)}
            {options && ` · ${options}`}
          </p>
        </div>
        {running && (
          <button
            type="button"
            className={buttonSecondary}
            onClick={() => cancel.mutate(job.id)}
            disabled={cancel.isPending}
          >
            {cancel.isPending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Square className="size-3.5 fill-current" aria-hidden="true" />
            )}
            Arrêter
          </button>
        )}
      </div>

      {running && progress && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-ink-soft">{progress.label}</span>
            {progress.percent !== null && <span className="text-muted tabular-nums">{progress.percent} %</span>}
          </div>
          <ProgressBar percent={progress.percent} />
        </div>
      )}

      {summary.length > 0 && (
        <ul className="mt-5 space-y-1 text-sm text-ink-soft">
          {summary.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent/70" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
      )}
      {job.summary.error && (
        <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{job.summary.error}</p>
      )}

      {job.logs.length > 0 && (
        <details className="group mt-5" open={running}>
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted select-none hover:text-ink">
            <TerminalSquare className="size-4" aria-hidden="true" />
            Journal ({job.logs.length} lignes)
          </summary>
          <LogConsole lines={job.logs} className="mt-3 max-h-72" />
        </details>
      )}
    </section>
  );
}
