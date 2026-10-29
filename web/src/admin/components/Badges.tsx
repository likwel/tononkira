import { cx } from '../../components/ui';
import { CRAWL_STATUS_LABEL, JOB_STATUS_LABEL } from '../format';
import type { CrawlStatus, JobStatus } from '../types';

export type Tone = 'ok' | 'changed' | 'muted' | 'error' | 'running';

const TONE: Record<Tone, string> = {
  ok: 'bg-leaf-soft text-leaf',
  changed: 'bg-accent-soft text-accent',
  muted: 'bg-surface-2 text-muted',
  error: 'bg-danger-soft text-danger',
  running: 'bg-accent-soft text-accent',
};

export function Badge({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string | undefined }) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

const CRAWL_TONE: Record<CrawlStatus, Tone> = { done: 'ok', pending: 'muted', error: 'error', gone: 'muted' };

export function CrawlStatusBadge({ status, error }: { status: CrawlStatus; error?: string | null }) {
  return (
    <Badge tone={CRAWL_TONE[status]} title={error ?? undefined}>
      {CRAWL_STATUS_LABEL[status]}
    </Badge>
  );
}

const JOB_TONE: Record<JobStatus, Tone> = {
  running: 'running',
  succeeded: 'ok',
  failed: 'error',
  cancelled: 'muted',
  interrupted: 'error',
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge tone={JOB_TONE[status]}>
      {status === 'running' && (
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      )}
      {JOB_STATUS_LABEL[status]}
    </Badge>
  );
}
