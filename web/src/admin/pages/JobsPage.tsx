import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Pagination } from '../../components/Pagination';
import { EmptyState, ErrorState } from '../../components/States';
import { cx } from '../../components/ui';
import { plural } from '../../lib/format';
import { toPage, withParams } from '../../lib/params';
import { AdminHeading } from '../AdminLayout';
import { JobStatusBadge } from '../components/Badges';
import { LogConsole } from '../components/JobPanel';
import {
  describeOptions,
  describeSummary,
  formatDateTime,
  formatDuration,
  JOB_LABEL,
  timeAgo,
} from '../format';
import { useJob, useJobs } from '../queries';
import type { JobRecord } from '../types';

function JobLog({ id }: { id: number }) {
  const { data, isPending } = useJob(id);
  if (isPending) return <p className="text-sm text-muted">Chargement du journal…</p>;
  const lines = data && 'logs' in data ? data.logs : (data?.log ?? '').split('\n').filter(Boolean);
  return lines.length ? <LogConsole lines={lines} className="max-h-96" /> : <p className="text-sm text-muted">Journal vide.</p>;
}

function JobRow({ job, open, onToggle }: { job: JobRecord; open: boolean; onToggle: () => void }) {
  const options = describeOptions(job.type, job.options);
  const summary = describeSummary(job.summary);
  return (
    <li className="py-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 text-left"
      >
        <span className="font-medium text-ink">
          {JOB_LABEL[job.type]} <span className="text-muted">#{job.id}</span>
        </span>
        <JobStatusBadge status={job.status} />
        {options && <span className="text-sm text-muted">{options}</span>}
        <span className="ml-auto flex items-center gap-3 text-xs text-muted">
          <time dateTime={job.startedAt} title={formatDateTime(job.startedAt)}>
            {timeAgo(job.startedAt)}
          </time>
          <span className="tabular-nums">{formatDuration(job.startedAt, job.finishedAt)}</span>
          <ChevronDown className={cx('size-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>
      {(summary.length > 0 || job.summary.error) && (
        <p className="mt-1.5 text-sm text-ink-soft">
          {summary.join(' · ')}
          {job.summary.error && <span className="text-danger"> {job.summary.error}</span>}
        </p>
      )}
      {open && (
        <div className="mt-3">
          <JobLog id={job.id} />
        </div>
      )}
    </li>
  );
}

export function JobsPage() {
  const [params] = useSearchParams();
  const page = toPage(params.get('page'));
  const jobs = useJobs(page);
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <>
      <AdminHeading title="Historique des tâches">
        {jobs.data && <p className="text-sm text-muted">{plural(jobs.data.meta.total, 'tâche')}</p>}
      </AdminHeading>
      {jobs.isError ? (
        <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} />
      ) : jobs.data && jobs.data.data.length === 0 ? (
        <EmptyState title="Aucune tâche">Les collectes et imports lancés ici apparaîtront dans cette liste.</EmptyState>
      ) : (
        <div className="rounded-3xl border border-line bg-surface px-4 shadow-soft sm:px-6">
          <ul className="divide-y divide-line/70">
            {jobs.data?.data.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                open={openId === job.id}
                onToggle={() => setOpenId((current) => (current === job.id ? null : job.id))}
              />
            ))}
          </ul>
        </div>
      )}
      {jobs.data && (
        <Pagination
          page={jobs.data.meta.page}
          totalPages={jobs.data.meta.totalPages}
          hrefFor={(target) => withParams(params, { page: target })}
        />
      )}
    </>
  );
}
