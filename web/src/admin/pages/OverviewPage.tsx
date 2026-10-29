import { ChevronRight, History } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState, ErrorState } from '../../components/States';
import { cx } from '../../components/ui';
import { formatNumber } from '../../lib/format';
import { AdminHeading } from '../AdminLayout';
import { JobStatusBadge } from '../components/Badges';
import { JobPanel } from '../components/JobPanel';
import { LaunchForm } from '../components/LaunchForm';
import { describeOptions, formatDateTime, JOB_LABEL, timeAgo } from '../format';
import { useJobs, useOverview } from '../queries';

interface StatProps {
  label: string;
  value: number | string;
  hint?: string;
  to?: string;
  tone?: 'default' | 'danger';
}

function Stat({ label, value, hint, to, tone = 'default' }: StatProps) {
  const body = (
    <>
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <span
        className={cx(
          'mt-2 block font-serif text-3xl font-semibold tracking-tight tabular-nums',
          tone === 'danger' && 'text-danger',
        )}
      >
        {typeof value === 'number' ? formatNumber(value) : value}
      </span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </>
  );
  const className = 'block rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5';
  return to ? (
    <Link to={to} className={cx(className, 'transition hover:border-accent/40 hover:shadow-lift')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function OverviewPage() {
  const overview = useOverview();
  const jobs = useJobs(1, 5);

  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const data = overview.data;
  const running = data?.job?.status === 'running';
  const crawl = data?.crawl;

  return (
    <>
      <AdminHeading title="Vue d'ensemble" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="En base"
          value={data?.db.songs ?? '…'}
          hint={data ? `${formatNumber(data.db.artists)} artistes · catalogue public` : undefined}
        />
        <Stat
          label="Collectées"
          value={crawl?.done ?? (data ? 0 : '…')}
          hint={crawl ? `sur ${formatNumber(crawl.total)} repérées` : undefined}
          to="/admin/pages?status=done"
        />
        <Stat label="En attente" value={crawl?.pending ?? (data ? 0 : '…')} to="/admin/pages?status=pending" />
        <Stat
          label="Erreurs"
          value={crawl?.error ?? (data ? 0 : '…')}
          hint={crawl ? `${formatNumber(crawl.gone)} disparue(s) de la source` : undefined}
          tone={crawl?.error ? 'danger' : 'default'}
          to="/admin/pages?status=error"
        />
        <Stat
          label="Pages de liste"
          value={crawl ? `${formatNumber(crawl.listPages)}${crawl.lastPage ? ` / ${formatNumber(crawl.lastPage)}` : ''}` : data ? 0 : '…'}
          hint={crawl?.lastListFetchedAt ? `dernière lecture ${timeAgo(crawl.lastListFetchedAt)}` : undefined}
          to="/admin/listes"
        />
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {data?.job ? (
            <JobPanel job={data.job} />
          ) : (
            <EmptyState icon={History} title="Aucune tâche en cours" className="bg-surface/50">
              {crawl
                ? 'Lancez une collecte, une recherche de nouveautés ou une revérification.'
                : "La collecte n'a encore jamais tourné : commencez par une collecte de quelques pages."}
            </EmptyState>
          )}

          <section className="rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold tracking-tight">Dernières tâches</h2>
              <Link to="/admin/taches" className="inline-flex items-center gap-0.5 text-sm font-medium text-accent">
                Historique <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            {jobs.data?.data.length ? (
              <ul className="divide-y divide-line/70">
                {jobs.data.data.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
                    <span className="font-medium text-ink">
                      {JOB_LABEL[job.type]} <span className="text-muted">#{job.id}</span>
                    </span>
                    <JobStatusBadge status={job.status} />
                    <span className="text-muted">{describeOptions(job.type, job.options)}</span>
                    <span className="ml-auto text-xs text-muted" title={formatDateTime(job.startedAt)}>
                      {timeAgo(job.startedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-muted">Aucune tâche lancée pour l'instant.</p>
            )}
          </section>
        </div>
        <div className="lg:col-span-2">
          <LaunchForm disabled={running} />
        </div>
      </div>
    </>
  );
}
