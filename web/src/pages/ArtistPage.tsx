import { ArrowLeft, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { LoadingLabel, Repeat, RowSkeleton } from '../components/Skeletons';
import { SongRow } from '../components/SongCard';
import { EmptyState, ErrorState, isNotFound } from '../components/States';
import { buttonSecondary } from '../components/ui';
import { useArtist } from '../hooks/queries';
import { matchRanges } from '../lib/highlight';
import { formatCount, plural } from '../lib/format';

export function ArtistPage() {
  const { slug = '' } = useParams();
  const { data: artist, isPending, isError, error, refetch } = useArtist(slug);
  const [filter, setFilter] = useState('');

  const songs = useMemo(() => {
    if (!artist) return [];
    const q = filter.trim();
    return q ? artist.songs.filter((song) => matchRanges(song.title, q).length > 0) : artist.songs;
  }, [artist, filter]);

  if (isError) {
    return (
      <div className="container-page py-16">
        {isNotFound(error) ? (
          <EmptyState
            title="Artiste introuvable"
            action={
              <Link to="/mpihira" className={buttonSecondary}>
                Voir tous les artistes
              </Link>
            }
          >
            Cet artiste n'existe pas ou a été retiré du catalogue.
          </EmptyState>
        ) : (
          <ErrorState error={error} onRetry={() => refetch()} />
        )}
      </div>
    );
  }

  return (
    <div className="container-page max-w-4xl pt-8">
      <Link
        to="/mpihira"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Artistes
      </Link>

      {isPending ? (
        <div className="mt-8">
          <LoadingLabel />
          <Repeat count={8}>
            <RowSkeleton />
          </Repeat>
        </div>
      ) : (
        <>
          <title>{`${artist.name} — paroles · Tononkira`}</title>
          <header className="mt-6 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <Avatar name={artist.name} seed={artist.slug} size="xl" />
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
                Mpihira
              </p>
              <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                {artist.name}
              </h1>
              <p className="mt-2 text-muted">
                {plural(artist.songCount, 'chanson')} · {formatCount(artist.totalViews)}{' '}
                consultations
              </p>
            </div>
          </header>

          <section className="mt-10" aria-labelledby="songs-title">
            <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 id="songs-title" className="font-serif text-2xl font-semibold tracking-tight">
                Chansons
              </h2>
              {artist.songs.length > 10 && (
                <div className="relative sm:w-64">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <label htmlFor="song-filter" className="sr-only">
                    Filtrer les chansons de {artist.name}
                  </label>
                  <input
                    id="song-filter"
                    type="search"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder="Filtrer les titres…"
                    className="h-10 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-sm shadow-soft placeholder:text-muted/80 focus:border-accent/60 focus:ring-4 focus:ring-accent/15 focus:outline-none"
                  />
                </div>
              )}
            </div>
            {songs.length === 0 ? (
              <p className="py-10 text-center text-muted">Aucun titre ne correspond.</p>
            ) : (
              <ol>
                {songs.map((song, index) => (
                  <li key={song.slug} className="border-b border-line/70">
                    <SongRow
                      song={song}
                      index={index + 1}
                      query={filter}
                      showArtist={song.artists.length > 1}
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
