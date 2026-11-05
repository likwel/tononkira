import { MicVocal, Shuffle } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { Link } from 'react-router';
import { ArtistCard } from '../components/ArtistCard';
import { Equalizer } from '../components/Equalizer';
import { Section } from '../components/PageParts';
import { SearchBox } from '../components/SearchBox';
import { ArtistCardSkeleton, Repeat, RowSkeleton, SongCardSkeleton } from '../components/Skeletons';
import { SongCard, SongRow } from '../components/SongCard';
import { EmptyState, ErrorState } from '../components/States';
import { buttonGhost } from '../components/ui';
import { useArtists, useSongs, useStats } from '../hooks/queries';
import { useRandomSong } from '../hooks/useRandomSong';
import { artistPath, songPath } from '../lib/api';
import { artistNames, formatNumber } from '../lib/format';
import { clearHistory, useHistory } from '../lib/history';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function HomePage() {
  const stats = useStats();
  const popular = useSongs({ sort: 'popular', limit: 8 });
  const recent = useSongs({ sort: 'recent', limit: 6 });
  const artists = useArtists({ sort: 'songs', limit: 12 });
  const random = useRandomSong();
  const history = useHistory();
  const empty = stats.data?.songs === 0;
  const topArtists = artists.data?.data.slice(0, 5) ?? [];

  return (
    <>
      <title>Tononkira — Paroles de chansons malagasy</title>

      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          {/* Aurore : trois halos aux couleurs de la marque qui dérivent lentement. */}
          <div className="absolute -top-56 left-[8%] size-[34rem] animate-drift rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute -top-32 right-[4%] size-[28rem] animate-drift rounded-full bg-sun/25 blur-3xl [animation-delay:-8s] dark:bg-sun/10" />
          <div className="absolute top-48 left-[38%] size-[26rem] animate-drift rounded-full bg-lagoon/15 blur-3xl [animation-delay:-15s]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-line to-transparent" />
        </div>

        <div className="container-page flex flex-col items-center pt-16 pb-14 text-center sm:pt-28 sm:pb-20">
          <p className="inline-flex animate-fade-up items-center gap-2.5 rounded-full border border-line/80 bg-surface/70 px-3.5 py-1.5 text-xs font-semibold text-ink-soft shadow-soft backdrop-blur">
            <Equalizer className="text-accent" />
            {stats.data
              ? `${formatNumber(stats.data.songs)} chansons · ${formatNumber(stats.data.artists)} artistes`
              : 'Hira malagasy'}
          </p>
          <h1 className="mt-7 max-w-4xl animate-fade-up font-display text-[2.8rem] leading-[0.98] font-bold tracking-[-0.035em] [animation-delay:80ms] sm:text-7xl lg:text-[5.4rem]">
            Les paroles des chansons{' '}
            <em className="text-gradient pr-[0.08em] font-serif font-medium tracking-[-0.01em] italic [box-decoration-break:clone]">
              malagasy
            </em>
          </h1>
          <p className="mt-6 max-w-xl animate-fade-up text-base text-muted text-pretty [animation-delay:160ms] sm:text-lg">
            Retrouvez un titre, un artiste ou simplement le vers qui vous trotte dans la tête.
          </p>
          <SearchBox
            size="lg"
            className="mt-9 w-full max-w-xl animate-fade-up [animation-delay:240ms]"
          />
          {topArtists.length > 0 && (
            <div className="mt-5 flex max-w-2xl animate-fade-up flex-wrap items-center justify-center gap-2 [animation-delay:320ms]">
              <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                Populaires
              </span>
              {topArtists.map((artist) => (
                <Link
                  key={artist.slug}
                  to={artistPath(artist)}
                  viewTransition
                  className="rounded-full border border-line bg-surface/70 px-3 py-1 text-xs font-medium text-ink-soft backdrop-blur transition duration-200 hover:-translate-y-px hover:border-accent/50 hover:text-accent"
                >
                  {artist.name}
                </Link>
              ))}
            </div>
          )}
          <div className="mt-6 flex animate-fade-up flex-wrap items-center justify-center gap-1 [animation-delay:400ms]">
            <button
              type="button"
              onClick={random.go}
              disabled={random.loading || empty}
              className={buttonGhost}
            >
              <Shuffle className="size-4" aria-hidden="true" />
              Une chanson au hasard
            </button>
            <Link to="/mpihira" viewTransition className={buttonGhost}>
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
          {history.length > 0 && (
            <Section
              title="Reprendre la lecture"
              subtitle="Vos dernières chansons, sur cet appareil"
              action={
                <button
                  type="button"
                  onClick={clearHistory}
                  className="shrink-0 text-sm text-muted transition-colors hover:text-accent"
                >
                  Effacer
                </button>
              }
            >
              <ul className="stagger no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
                {history.slice(0, 6).map((entry) => (
                  <li
                    key={`${entry.artistSlug}/${entry.slug}`}
                    className="w-40 shrink-0 snap-start sm:w-auto"
                  >
                    <Link
                      to={songPath(entry)}
                      viewTransition
                      className="group flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-3 shadow-soft transition duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-accent/40 hover:shadow-lift"
                    >
                      <Avatar
                        name={entry.artists[0]?.name ?? entry.title}
                        seed={entry.artistSlug}
                        shape="square"
                      />
                      <span className="min-w-0">
                        <span className="line-clamp-2 font-display text-base font-semibold leading-snug tracking-tight text-ink transition-colors group-hover:text-accent">
                          {entry.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {artistNames(entry.artists)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            title="Les plus consultées"
            subtitle="Le palmarès des lecteurs"
            to="/hira?sort=popular"
          >
            {popular.isError ? (
              <ErrorState error={popular.error} onRetry={() => popular.refetch()} />
            ) : (
              <ol className="stagger grid gap-x-10 sm:grid-cols-2">
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

          <Section
            title="Parcourir de A à Z"
            subtitle="Toutes les chansons, rangées par titre"
            to="/hira?sort=title"
            linkLabel="Liste complète"
          >
            <ul className="stagger grid grid-cols-7 gap-2 sm:grid-cols-9 lg:grid-cols-13">
              {LETTERS.map((letter) => (
                <li key={letter}>
                  <Link
                    to={`/hira?sort=title&letter=${letter.toLowerCase()}`}
                    aria-label={`Chansons commençant par ${letter}`}
                    className="grid aspect-square place-items-center rounded-xl border border-line bg-surface font-display text-xl font-bold text-ink-soft shadow-soft transition duration-300 ease-[var(--ease-spring)] hover:-translate-y-1 hover:rotate-[-4deg] hover:border-accent hover:bg-accent hover:text-accent-ink hover:shadow-glow sm:text-2xl"
                  >
                    {letter}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Ajouts récents" subtitle="Les dernières paroles publiées" to="/hira">
            {recent.isError ? (
              <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
            ) : (
              <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
