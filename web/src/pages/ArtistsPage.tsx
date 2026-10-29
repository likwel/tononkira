import { MicVocal, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArtistCard } from '../components/ArtistCard';
import { LetterFilter, SegmentedLinks } from '../components/Filters';
import { PageHeader } from '../components/PageParts';
import { Pagination } from '../components/Pagination';
import { ArtistCardSkeleton, LoadingLabel, Repeat } from '../components/Skeletons';
import { EmptyState, ErrorState } from '../components/States';
import { useArtists } from '../hooks/queries';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { plural } from '../lib/format';
import { pick, toLetter, toPage, withParams } from '../lib/params';
import type { ArtistSort } from '../lib/types';

const SORTS: { value: ArtistSort; label: string }[] = [
  { value: 'name', label: 'A–Z' },
  { value: 'songs', label: 'Les plus présents' },
];
const SORT_VALUES = SORTS.map((sort) => sort.value);

export function ArtistsPage() {
  const [params, setParams] = useSearchParams();
  const page = toPage(params.get('page'));
  const sort = pick(params.get('sort'), SORT_VALUES, 'name');
  const letter = toLetter(params.get('letter'));
  const q = params.get('q') ?? '';

  // Le champ de filtre met l'URL à jour après une courte pause de frappe.
  const [filter, setFilter] = useState(q);
  const debouncedFilter = useDebouncedValue(filter.trim(), 300);
  useEffect(() => setFilter(q), [q]);
  useEffect(() => {
    if (debouncedFilter !== q.trim()) {
      setParams(withParams(params, { q: debouncedFilter || null }), { replace: true });
    }
    // Seule la saisie déclenche la mise à jour (pas les autres changements d'URL).
  }, [debouncedFilter]);

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useArtists({
    page,
    limit: 48,
    sort,
    letter,
    q: q.trim() || undefined,
  });

  return (
    <>
      <title>Artistes · Tononkira</title>
      <PageHeader
        eyebrow="Mpihira"
        title="Les artistes"
        description={data ? `${plural(data.meta.total, 'artiste')}.` : ' '}
      >
        <div className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:w-72">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <label htmlFor="artist-filter" className="sr-only">
                Filtrer les artistes par nom
              </label>
              <input
                id="artist-filter"
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filtrer par nom…"
                autoComplete="off"
                className="h-10 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-sm shadow-soft placeholder:text-muted/80 focus:border-accent/60 focus:ring-4 focus:ring-accent/15 focus:outline-none"
              />
            </div>
            <SegmentedLinks
              label="Trier les artistes"
              value={sort}
              options={SORTS}
              hrefFor={(value) => withParams(params, { sort: value === 'name' ? null : value })}
            />
          </div>
          <LetterFilter
            active={letter}
            hrefFor={(value) => withParams(params, { letter: value })}
          />
        </div>
      </PageHeader>

      <div className="container-page">
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            <LoadingLabel />
            <Repeat count={12}>
              <ArtistCardSkeleton />
            </Repeat>
          </div>
        ) : data.data.length === 0 ? (
          <EmptyState icon={MicVocal} title="Aucun artiste">
            Aucun artiste ne correspond à ces critères.
          </EmptyState>
        ) : (
          <>
            <div
              className={`grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 ${isPlaceholderData ? 'opacity-60' : ''}`}
            >
              {data.data.map((artist) => (
                <ArtistCard key={artist.slug} artist={artist} />
              ))}
            </div>
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              hrefFor={(target) => withParams(params, { page: target })}
            />
          </>
        )}
      </div>
    </>
  );
}
