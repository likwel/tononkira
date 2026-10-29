import { ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Pagination } from '../../components/Pagination';
import { EmptyState, ErrorState } from '../../components/States';
import { buttonSecondary, cx } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { formatNumber, plural } from '../../lib/format';
import { toPage, withParams } from '../../lib/params';
import { AdminHeading } from '../AdminLayout';
import { Badge } from '../components/Badges';
import { formatDateTime, timeAgo } from '../format';
import { useListPages, useRefreshListPage } from '../queries';
import type { ListPage, ListPageRefresh } from '../types';

const SOURCE_LIST = 'https://tononkira.serasera.org/hira?page=';

function refreshText(result: ListPageRefresh): { text: string; tone: 'ok' | 'changed' | 'muted' } {
  if (result.empty) return { text: 'Page vide : au-delà de la dernière page', tone: 'muted' };
  if (result.new === 0) return { text: `À jour (${plural(result.found, 'chanson')})`, tone: 'ok' };
  return { text: `+${plural(result.new, 'nouvelle chanson', 'nouvelles chansons')}`, tone: 'changed' };
}

function useRefresh() {
  const refresh = useRefreshListPage();
  const [result, setResult] = useState<ListPageRefresh | null>(null);
  return {
    run: (page: number) => refresh.mutate(page, { onSuccess: setResult }),
    pending: refresh.isPending,
    result,
    error: refresh.isError
      ? refresh.error instanceof ApiError
        ? refresh.error.message
        : 'Relecture impossible'
      : null,
  };
}

function ResultBadge({ result, error }: { result: ListPageRefresh | null; error: string | null }) {
  if (error) return <Badge tone="error">{error}</Badge>;
  if (!result) return null;
  const { text, tone } = refreshText(result);
  return <Badge tone={tone}>{text}</Badge>;
}

function ListRow({ item }: { item: ListPage }) {
  const refresh = useRefresh();
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
      <a
        href={`${SOURCE_LIST}${item.page}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-24 items-center gap-1.5 font-medium text-ink tabular-nums hover:text-accent"
      >
        Page {formatNumber(item.page)}
        <ExternalLink className="size-3.5 text-muted" aria-hidden="true" />
      </a>
      <span className="w-28 text-sm text-muted">{plural(item.songCount, 'chanson')}</span>
      <time className="text-sm text-muted" dateTime={item.fetchedAt} title={formatDateTime(item.fetchedAt)}>
        lue {timeAgo(item.fetchedAt)}
      </time>
      <div className="ml-auto flex items-center gap-3">
        <ResultBadge result={refresh.result} error={refresh.error} />
        <button
          type="button"
          onClick={() => refresh.run(item.page)}
          disabled={refresh.pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft shadow-soft transition-colors hover:border-accent/50 hover:text-ink disabled:opacity-60"
        >
          {refresh.pending ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden="true" />
          )}
          Relire
        </button>
      </div>
    </li>
  );
}

function ReadAnyPage({ lastPage }: { lastPage: number | null }) {
  const [value, setValue] = useState('');
  const refresh = useRefresh();
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const page = Number(value);
    if (Number.isInteger(page) && page >= 1) refresh.run(page);
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <label htmlFor="list-page" className="text-sm text-muted">
        Lire la page
      </label>
      <input
        id="list-page"
        type="number"
        min={1}
        max={lastPage ?? undefined}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="n°"
        className="h-10 w-24 rounded-full border border-line bg-surface px-3 text-sm tabular-nums shadow-soft focus:border-accent/60 focus:ring-4 focus:ring-accent/15 focus:outline-none"
      />
      <button type="submit" className={buttonSecondary} disabled={refresh.pending || !value}>
        {refresh.pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        Lire
      </button>
      <ResultBadge result={refresh.result} error={refresh.error} />
    </form>
  );
}

export function ListPagesPage() {
  const [params] = useSearchParams();
  const page = toPage(params.get('page'));
  const pages = useListPages(page);
  const lastPage = pages.data?.meta.lastPage ?? null;

  return (
    <>
      <AdminHeading title="Pages de liste">
        {pages.data && (
          <p className="text-sm text-muted">
            {plural(pages.data.meta.total, 'page')} lue{pages.data.meta.total > 1 ? 's' : ''}
            {lastPage ? ` sur ${formatNumber(lastPage)}` : ''}
          </p>
        )}
      </AdminHeading>
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-muted">
        Chaque page de liste du site source annonce une vingtaine de chansons. Relire une page y
        repère les nouvelles chansons, qui passent « en attente » jusqu'à la prochaine collecte.
      </p>
      <div className="mb-6">
        <ReadAnyPage lastPage={lastPage} />
      </div>

      {pages.isError ? (
        <ErrorState error={pages.error} onRetry={() => pages.refetch()} />
      ) : pages.data && pages.data.data.length === 0 ? (
        <EmptyState title="Aucune page de liste lue">
          Lancez une collecte ou lisez une page ci-dessus.
        </EmptyState>
      ) : (
        <div className="rounded-3xl border border-line bg-surface px-4 shadow-soft sm:px-6">
          <ul className={cx('divide-y divide-line/70', pages.isPlaceholderData && 'opacity-60')}>
            {pages.data?.data.map((item) => <ListRow key={item.page} item={item} />)}
          </ul>
        </div>
      )}
      {pages.data && (
        <Pagination
          page={pages.data.meta.page}
          totalPages={pages.data.meta.totalPages}
          hrefFor={(target) => withParams(params, { page: target })}
        />
      )}
    </>
  );
}
