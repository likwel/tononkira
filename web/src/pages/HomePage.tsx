import { MicVocal, Shuffle, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { ArtistCard } from '../components/ArtistCard';
import { Section } from '../components/PageParts';
import { SearchBox } from '../components/SearchBox';
import { ArtistCardSkeleton, Repeat, RowSkeleton, SongCardSkeleton } from '../components/Skeletons';
import { SongCard, SongRow } from '../components/SongCard';
import { EmptyState, ErrorState } from '../components/States';
import { buttonGhost } from '../components/ui';
import { useArtists, useSongs, useStats } from '../hooks/queries';
import { useRandomSong } from '../hooks/useRandomSong';
import { formatNumber } from '../lib/format';

export function HomePage() {
  const stats = useStats();
  const popular = useSongs({ sort: 'popular', limit: 8 });
  const recent = useSongs({ sort: 'recent', limit: 6 });
  const artists = useArtists({ sort: 'songs', limit: 12 });
  const random = useRandomSong();
  const empty = stats.data?.songs === 0;

  return (
    <>
      <title>Tononkira — Paroles de chansons malagasy</title>

      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 h-[30rem] w-[52rem] -translate-x-1/2 rounded-full bg-accent-soft opacity-80 blur-3xl" />
          <div className="absolute top-32 -right-24 size-80 rounded-full bg-leaf-soft opacity-90 blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-line to-transparent" />
        </div>

        <div className="container-page flex flex-col items-center py-16 text-center sm:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1 text-xs font-medium text-ink-soft backdrop-blur">
            <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
            {stats.data
              ? `${formatNumber(stats.data.songs)} chansons · ${formatNumber(stats.data.artists)} artistes`
              : 'Hira malagasy'}
          </p>
          <h1 className="mt-6 max-w-3xl font-serif text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Les paroles des chansons <em className="font-medium text-accent">malagasy</em>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted text-pretty sm:text-lg">
            Retrouvez un titre, un artiste ou simplement le vers qui vous trotte dans la tête.
          </p>
          <SearchBox size="lg" className="mt-8 w-full max-w-xl" />
          <div className="mt-5 flex flex-wrap items-center justify-center gap-1">
            <button
              type="button"
              onClick={random.go}
              disabled={random.loading || empty}
              className={buttonGhost}
            >
              <Shuffle className="size-4" aria-hidden="true" />
              Une chanson au hasard
            </button>
            <Link to="/mpihira" className={buttonGhost}>
              <MicVocal className="size-4" aria-hidden="true" />
              Parcourir les artistes
            </Link>
          </div>
        </div>
      </section>

      {empty ? (
        <div className="container-page mt-16">
          <EmptyState title="Le catalogue est vide">
            Lancez la collecte (<code>npm run data:crawl</code>) puis l'import (
            <code>npm run db:import</code>) pour remplir la base.
          </EmptyState>
        </div>
      ) : (
        <>
          <Section
            title="Les plus consultées"
            subtitle="Le palmarès des lecteurs"
            to="/hira?sort=popular"
          >
            {popular.isError ? (
              <ErrorState error={popular.error} onRetry={() => popular.refetch()} />
            ) : (
              <ol className="grid gap-x-10 sm:grid-cols-2">
                {popular.data
                  ? popular.data.data.map((song, index) => (
                      <li
                        key={`${song.artistSlug}/${song.slug}`}
                        className="border-b border-line/70"
                      >
                        <SongRow song={song} index={index + 1} />
                      </li>
                    ))
                  : Array.from({ length: 8 }, (_, index) => (
                      <li key={index} className="border-b border-line/70">
                        <RowSkeleton />
                      </li>
                    ))}
              </ol>
            )}
          </Section>

          <Section title="Ajouts récents" subtitle="Les dernières paroles publiées" to="/hira">
            {recent.isError ? (
              <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recent.data ? (
                  recent.data.data.map((song) => (
                    <SongCard key={`${song.artistSlug}/${song.slug}`} song={song} />
                  ))
                ) : (
                  <Repeat count={6}>
                    <SongCardSkeleton />
                  </Repeat>
                )}
              </div>
            )}
          </Section>

          <Section
            title="Artistes à découvrir"
            subtitle="Les plus riches en chansons"
            to="/mpihira?sort=songs"
          >
            {artists.isError ? (
              <ErrorState error={artists.error} onRetry={() => artists.refetch()} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {artists.data ? (
                  artists.data.data.map((artist) => (
                    <ArtistCard key={artist.slug} artist={artist} />
                  ))
                ) : (
                  <Repeat count={12}>
                    <ArtistCardSkeleton />
                  </Repeat>
                )}
              </div>
            )}
          </Section>
        </>
      )}
    </>
  );
}
