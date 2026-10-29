import { Search, SearchX } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '../components/PageParts';
import { Pagination } from '../components/Pagination';
import { SearchBox } from '../components/SearchBox';
import { LoadingLabel, Repeat, RowSkeleton } from '../components/Skeletons';
import { SongRow } from '../components/SongCard';
import { EmptyState, ErrorState } from '../components/States';
import { Avatar } from '../components/Avatar';
import { useSearch } from '../hooks/queries';
import { artistPath } from '../lib/api';
import { plural } from '../lib/format';
import { toPage, withParams } from '../lib/params';

export function SearchPage() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const page = toPage(params.get('page'));
  const ready = q.length >= 2;
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useSearch(
    q,
    page,
    20,
    ready,
  );

  return (
    <>
      <title>{q ? `« ${q} » · Recherche · Tononkira` : 'Recherche · Tononkira'}</title>
      <PageHeader
        eyebrow="Karoka"
        title={
          ready ? (
            <>
              Résultats pour <span className="text-accent">« {q} »</span>
            </>
          ) : (
            'Rechercher'
          )
        }
      >
        <SearchBox size="lg" initialValue={q} autoFocus={!q} className="mt-6 max-w-2xl" />
      </PageHeader>

      <div className="container-page">
        <div className="max-w-4xl">
          {!ready ? (
            <EmptyState icon={Search} title="Que cherchez-vous ?">
              Un titre, un nom d'artiste ou quelques mots des paroles : au moins deux lettres. La
              recherche ignore les majuscules et les accents.
            </EmptyState>
          ) : isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : isPending ? (
            <>
              <LoadingLabel />
              <Repeat count={6}>
                <RowSkeleton />
              </Repeat>
            </>
          ) : data.meta.total === 0 && data.data.artists.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Aucun résultat"
              action={
                <Link
                  to="/hira"
                  className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                >
                  Parcourir toutes les chansons
                </Link>
              }
            >
              Rien ne correspond à « {q} ». Essayez un autre mot, ou une partie seulement du titre.
            </EmptyState>
          ) : (
            <div
              className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}
            >
              {data.data.artists.length > 0 && (
                <section aria-labelledby="artists-title" className="mb-10">
                  <h2
                    id="artists-title"
                    className="mb-3 text-xs font-semibold tracking-[0.18em] text-muted uppercase"
                  >
                    Artistes
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {data.data.artists.map((artist) => (
                      <li key={artist.slug}>
                        <Link
                          to={artistPath(artist)}
                          className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1 pr-4 pl-1 shadow-soft transition hover:border-accent/50"
                        >
                          <Avatar name={artist.name} seed={artist.slug} size="sm" />
                          <span>
                            <span className="block text-sm font-medium text-ink">
                              {artist.name}
                            </span>
                            <span className="block text-xs text-muted">
                              {plural(artist.songCount, 'chanson')}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section aria-labelledby="songs-title">
                <h2
                  id="songs-title"
                  className="mb-1 text-xs font-semibold tracking-[0.18em] text-muted uppercase"
                >
                  {plural(data.meta.total, 'chanson')}
                </h2>
                <ol>
                  {data.data.songs.map((song) => (
                    <li key={`${song.artistSlug}/${song.slug}`} className="border-b border-line/70">
                      <SongRow song={song} query={q} />
                    </li>
                  ))}
                </ol>
                <Pagination
                  page={data.meta.page}
                  totalPages={data.meta.totalPages}
                  hrefFor={(target) => withParams(params, { page: target })}
                />
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
