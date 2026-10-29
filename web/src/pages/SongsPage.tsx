import { Music } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { LetterFilter, SegmentedLinks } from '../components/Filters';
import { PageHeader } from '../components/PageParts';
import { Pagination } from '../components/Pagination';
import { LoadingLabel, Repeat, SongCardSkeleton } from '../components/Skeletons';
import { SongCard } from '../components/SongCard';
import { EmptyState, ErrorState } from '../components/States';
import { useSongs } from '../hooks/queries';
import { plural } from '../lib/format';
import { pick, toLetter, toPage, withParams } from '../lib/params';
import type { SongSort } from '../lib/types';

const SORTS: { value: SongSort; label: string }[] = [
  { value: 'recent', label: 'Récentes' },
  { value: 'popular', label: 'Populaires' },
  { value: 'title', label: 'A–Z' },
];
const SORT_VALUES = SORTS.map((sort) => sort.value);

export function SongsPage() {
  const [params] = useSearchParams();
  const page = toPage(params.get('page'));
  const sort = pick(params.get('sort'), SORT_VALUES, 'recent');
  const letter = toLetter(params.get('letter'));
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useSongs({
    page,
    limit: 24,
    sort,
    letter,
  });

  return (
    <>
      <title>{`Chansons${letter ? ` — ${letter.toUpperCase()}` : ''} · Tononkira`}</title>
      <PageHeader
        eyebrow="Hira"
        title="Toutes les chansons"
        description={
          data
            ? `${plural(data.meta.total, 'chanson')}${letter ? ` commençant par « ${letter.toUpperCase()} »` : ''}.`
            : ' '
        }
      >
        <div className="mt-8 flex flex-col gap-4">
          <SegmentedLinks
            label="Trier les chansons"
            value={sort}
            options={SORTS}
            hrefFor={(value) => withParams(params, { sort: value === 'recent' ? null : value })}
          />
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <LoadingLabel />
            <Repeat count={12}>
              <SongCardSkeleton />
            </Repeat>
          </div>
        ) : data.data.length === 0 ? (
          <EmptyState icon={Music} title="Aucune chanson">
            Aucune chanson ne correspond à ce filtre.
          </EmptyState>
        ) : (
          <>
            <div
              className={`grid gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${isPlaceholderData ? 'opacity-60' : ''}`}
            >
              {data.data.map((song) => (
                <SongCard key={`${song.artistSlug}/${song.slug}`} song={song} />
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
