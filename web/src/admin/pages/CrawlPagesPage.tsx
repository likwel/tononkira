import { ExternalLink, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SegmentedLinks } from '../../components/Filters';
import { Pagination } from '../../components/Pagination';
import { EmptyState, ErrorState } from '../../components/States';
import { cx } from '../../components/ui';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { ApiError, songPath } from '../../lib/api';
import { artistNames, plural } from '../../lib/format';
import { pick, toPage, withParams } from '../../lib/params';
import { AdminHeading } from '../AdminLayout';
import { Badge, CrawlStatusBadge } from '../components/Badges';
import { describeRefresh, formatDateTime, timeAgo } from '../format';
import { useCrawlPages, useRefreshPage } from '../queries';
import type { CrawlSong, RefreshResult } from '../types';

const STATUS_FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'done', label: 'Collectées' },
  { value: 'pending', label: 'En attente' },
  { value: 'error', label: 'Erreurs' },
  { value: 'gone', label: 'Disparues' },
] as const;
const STATUS_VALUES = STATUS_FILTERS.map((filter) => filter.value);
const SORTS = [
  { value: 'recent', label: 'Récemment collectées' },
  { value: 'stale', label: 'À revérifier en premier' },
  { value: 'title', label: 'Titre' },
] as const;
const SORT_VALUES = SORTS.map((sort) => sort.value);

const COLUMNS = 'md:grid-cols-[minmax(0,1fr)_7rem_7.5rem_7.5rem_7.5rem_8rem]';
const smallButton =
  'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft shadow-soft transition-colors hover:border-accent/50 hover:text-ink disabled:opacity-60';

function Dated({ label, iso }: { label: string; iso: string | null }) {
  return (
    <p className="text-xs text-muted md:text-sm">
      <span className="md:hidden">{label} </span>
      {iso ? (
        <time dateTime={iso} title={formatDateTime(iso)}>
          {timeAgo(iso)}
        </time>
      ) : (
        <span className="md:text-muted/60">{iso === null ? 'jamais' : '—'}</span>
      )}
    </p>
  );
}

function CrawlRow({ song }: { song: CrawlSong }) {
  const refresh = useRefreshPage();
  const [result, setResult] = useState<RefreshResult | null>(null);
  const catalog = result?.catalog ?? song.catalog;
  const described = result ? describeRefresh(result) : null;
  const collected = song.status === 'done' || song.status === 'gone';

  return (
    <li className={cx('grid gap-x-4 gap-y-2 py-4 md:items-center', COLUMNS)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {catalog ? (
            <Link
              to={songPath(catalog)}
              className="truncate font-serif text-[17px] text-ink transition-colors hover:text-accent"
              title="Voir sur le site"
            >
              {song.title}
            </Link>
          ) : (
            <span className="truncate font-serif text-[17px] text-ink">{song.title}</span>
          )}
          <a
            href={song.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted transition-colors hover:text-accent"
            aria-label={`Page d'origine de « ${song.title} »`}
            title="Page d'origine"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
        <p className="truncate text-xs text-muted">
          {song.artists.length ? artistNames(song.artists) : song.artistSlug}
          {song.status === 'done' && !catalog && ' · pas encore dans le catalogue'}
        </p>
        {song.status === 'error' && song.error && (
          <p className="mt-1 truncate text-xs text-danger" title={song.error}>
            {song.error} ({plural(song.attempts, 'tentative')})
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:contents">
        <div>
          <CrawlStatusBadge status={song.status} error={song.error} />
        </div>
        <Dated label="Collectée" iso={collected ? (song.scrapedAt ?? song.updatedAt) : null} />
        <Dated label="· vérifiée" iso={song.checkedAt} />
        <Dated label="· modifiée" iso={song.changedAt} />
      </div>
      <div className="md:text-right">
        <button
          type="button"
          className={smallButton}
          onClick={() => refresh.mutate(song.url, { onSuccess: setResult })}
          disabled={refresh.isPending}
          title={collected ? 'Relire la page et détecter une mise à jour' : 'Collecter cette page maintenant'}
        >
          {refresh.isPending ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden="true" />
          )}
          {collected ? 'Vérifier' : 'Collecter'}
        </button>
      </div>
      {(described || refresh.isError) && (
        <div className="md:col-span-6 md:text-right" role="status">
          {described ? (
            <Badge tone={described.tone}>{described.text}</Badge>
          ) : (
            <Badge tone="error">
              {refresh.error instanceof ApiError ? refresh.error.message : 'Vérification impossible'}
            </Badge>
          )}
        </div>
      )}
    </li>
  );
}

export function CrawlPagesPage() {
  const [params, setParams] = useSearchParams();
  const page = toPage(params.get('page'));
  const status = pick(params.get('status'), STATUS_VALUES, 'all');
  const sort = pick(params.get('sort'), SORT_VALUES, 'recent');
  const q = params.get('q') ?? '';

  const [filter, setFilter] = useState(q);
  const debounced = useDebouncedValue(filter.trim(), 300);
  useEffect(() => setFilter(q), [q]);
  useEffect(() => {
    if (debounced !== q.trim()) setParams(withParams(params, { q: debounced || null }), { replace: true });
    // Seule la saisie déclenche la mise à jour de l'URL.
  }, [debounced]);

  const pages = useCrawlPages({
    page,
    status: status === 'all' ? undefined : status,
    q: q.trim() || undefined,
    sort,
  });

  return (
    <>
      <AdminHeading title="Pages collectées">
        {pages.data && <p className="text-sm text-muted">{plural(pages.data.meta.total, 'page')}</p>}
      </AdminHeading>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative sm:w-80">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <label htmlFor="crawl-filter" className="sr-only">
              Rechercher un titre, un artiste ou une URL
            </label>
            <input
              id="crawl-filter"
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Titre, artiste ou URL…"
              className="h-10 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-sm shadow-soft placeholder:text-muted/80 focus:border-accent/60 focus:ring-4 focus:ring-accent/15 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="shrink-0">Trier :</span>
            <select
              value={sort}
              onChange={(event) =>
                setParams(withParams(params, { sort: event.target.value === 'recent' ? null : event.target.value }))
              }
              className="h-10 rounded-full border border-line bg-surface px-3 text-sm text-ink shadow-soft focus:border-accent/60 focus:outline-none"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <SegmentedLinks
            label="Filtrer par statut"
            value={status}
            options={[...STATUS_FILTERS]}
            hrefFor={(value) => withParams(params, { status: value === 'all' ? null : value })}
          />
        </div>
      </div>

      {pages.isError ? (
        <ErrorState error={pages.error} onRetry={() => pages.refetch()} />
      ) : pages.data && pages.data.data.length === 0 ? (
        <EmptyState title="Aucune page">
          {q || status !== 'all'
            ? 'Aucune page ne correspond à ces filtres.'
            : "Aucune page collectée : lancez une collecte depuis la vue d'ensemble."}
        </EmptyState>
      ) : (
        <div className="rounded-3xl border border-line bg-surface px-4 shadow-soft sm:px-6">
          <div
            className={cx(
              'hidden gap-x-4 border-b border-line py-3 text-xs font-medium tracking-wide text-muted uppercase md:grid',
              COLUMNS,
            )}
          >
            <span>Chanson</span>
            <span>Statut</span>
            <span>Collectée</span>
            <span>Vérifiée</span>
            <span>Modifiée</span>
            <span className="text-right">Mise à jour</span>
          </div>
          {pages.data ? (
            <ul className={cx('divide-y divide-line/70', pages.isPlaceholderData && 'opacity-60')}>
              {pages.data.data.map((song) => (
                <CrawlRow key={song.url} song={song} />
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-muted" role="status">
              Chargement…
            </p>
          )}
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
