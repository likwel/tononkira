import {
  AArrowDown,
  AArrowUp,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  Eye,
  Heart,
  Printer,
  Share2,
  Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { FavoriteButton } from '../components/FavoriteButton';
import { LyricsView } from '../components/LyricsView';
import { LoadingLabel } from '../components/Skeletons';
import { SongCard } from '../components/SongCard';
import { EmptyState, ErrorState, isNotFound } from '../components/States';
import { buttonSecondary, cx, iconButton } from '../components/ui';
import { useSong } from '../hooks/queries';
import { artistPath } from '../lib/api';
import { artistNames, formatDate, formatNumber } from '../lib/format';
import { readStorage, writeStorage } from '../lib/storage';
import type { SongDetail } from '../lib/types';

const SIZE_KEY = 'tononkira-lyrics-size';
const SIZES = [0.95, 1.05, 1.125, 1.25, 1.4, 1.6];
const DEFAULT_SIZE_INDEX = 2;

function useLyricsSize() {
  const [index, setIndex] = useState(() => {
    const stored = readStorage<number>(SIZE_KEY, DEFAULT_SIZE_INDEX, Number);
    return Number.isInteger(stored) && stored >= 0 && stored < SIZES.length
      ? stored
      : DEFAULT_SIZE_INDEX;
  });
  useEffect(() => writeStorage(SIZE_KEY, String(index)), [index]);
  return {
    size: SIZES[index]!,
    canDecrease: index > 0,
    canIncrease: index < SIZES.length - 1,
    decrease: () => setIndex((value) => Math.max(0, value - 1)),
    increase: () => setIndex((value) => Math.min(SIZES.length - 1, value + 1)),
  };
}

/** Affiche « Copié » quelques secondes après une action. */
function useFlash(): [string | null, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [message]);
  return [message, setMessage];
}

export function SongPage() {
  const { artistSlug = '', slug = '' } = useParams();
  const { data: song, isPending, isError, error, refetch } = useSong(artistSlug, slug);

  if (isError) {
    return (
      <div className="container-page py-16">
        {isNotFound(error) ? (
          <EmptyState
            title="Chanson introuvable"
            action={
              <Link
                to={`/karoka?q=${encodeURIComponent(slug.replace(/-/g, ' '))}`}
                className={buttonSecondary}
              >
                Chercher un titre proche
              </Link>
            }
          >
            Cette chanson n'existe pas ou a été retirée du catalogue.
          </EmptyState>
        ) : (
          <ErrorState error={error} onRetry={() => refetch()} />
        )}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="container-page max-w-3xl pt-10" aria-busy="true">
        <LoadingLabel />
        <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
        <div className="mt-6 h-12 w-3/4 animate-pulse rounded-lg bg-surface-2" />
        <div className="mt-4 h-5 w-1/3 animate-pulse rounded bg-surface-2" />
        <div className="mt-10 h-96 animate-pulse rounded-3xl bg-surface-2" />
      </div>
    );
  }

  return <SongView song={song} />;
}

function SongView({ song }: { song: SongDetail }) {
  const lyricsSize = useLyricsSize();
  const [flash, setFlash] = useFlash();
  const mainArtist = song.artists[0];
  const date = formatDate(song.publishedAt);

  async function copyLyrics() {
    const text = `${song.title} — ${artistNames(song.artists)}\n\n${song.lyrics}\n\n${window.location.href}`;
    try {
      await navigator.clipboard.writeText(text);
      setFlash('Paroles copiées');
    } catch {
      setFlash('Copie impossible');
    }
  }

  async function share() {
    const data = {
      title: `${song.title} — ${artistNames(song.artists)}`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        // Partage annulé.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(data.url);
      setFlash('Lien copié');
    } catch {
      setFlash('Copie impossible');
    }
  }

  return (
    <article className="container-page max-w-3xl pt-8">
      <title>{`${song.title} — ${artistNames(song.artists)} · Tononkira`}</title>
      <meta
        name="description"
        content={`Paroles de « ${song.title} » de ${artistNames(song.artists)}.`}
      />

      <nav aria-label="Fil d'Ariane" className="print:hidden">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
          <li>
            <Link to="/hira" className="transition-colors hover:text-accent">
              Chansons
            </Link>
          </li>
          {mainArtist && (
            <>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <li>
                <Link to={artistPath(mainArtist)} className="transition-colors hover:text-accent">
                  {mainArtist.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <header className="mt-6">
        <h1 className="font-serif text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          {song.title}
        </h1>
        <p className="mt-3 text-lg">
          {song.artists.map((artist, index) => (
            <span key={artist.slug}>
              {index > 0 && <span className="text-muted">, </span>}
              <Link
                to={artistPath(artist)}
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                {artist.name}
              </Link>
            </span>
          ))}
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <div className="flex items-center gap-1.5">
            <Eye className="size-4" aria-hidden="true" />
            <dt className="sr-only">Consultations</dt>
            <dd>{formatNumber(song.views)} consultations</dd>
          </div>
          {song.likes > 0 && (
            <div className="flex items-center gap-1.5">
              <Heart className="size-4" aria-hidden="true" />
              <dt className="sr-only">Mentions j'aime</dt>
              <dd>{formatNumber(song.likes)}</dd>
            </div>
          )}
          {date && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" />
              <dt className="sr-only">Publiée le</dt>
              <dd>{date}</dd>
            </div>
          )}
        </dl>
      </header>

      <div className="sticky top-16 z-30 -mx-4 mt-6 flex items-center gap-1 border-y border-line/70 bg-canvas/85 px-4 py-2 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none print:hidden">
        <FavoriteButton song={song} />
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            className={cx(iconButton, 'disabled:opacity-40')}
            onClick={lyricsSize.decrease}
            disabled={!lyricsSize.canDecrease}
            aria-label="Réduire la taille du texte"
            title="Réduire le texte"
          >
            <AArrowDown className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={cx(iconButton, 'disabled:opacity-40')}
            onClick={lyricsSize.increase}
            disabled={!lyricsSize.canIncrease}
            aria-label="Agrandir la taille du texte"
            title="Agrandir le texte"
          >
            <AArrowUp className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={copyLyrics}
            aria-label="Copier les paroles"
            title="Copier les paroles"
          >
            {flash === 'Paroles copiées' ? (
              <Check className="size-5 text-leaf" aria-hidden="true" />
            ) : (
              <Copy className="size-5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={share}
            aria-label="Partager"
            title="Partager"
          >
            <Share2 className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={cx(iconButton, 'max-sm:hidden')}
            onClick={() => window.print()}
            aria-label="Imprimer"
            title="Imprimer"
          >
            <Printer className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {flash ?? ''}
      </p>
      {flash && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center md:bottom-8 print:hidden">
          <span className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-canvas shadow-lift">
            {flash}
          </span>
        </div>
      )}

      <div className="mt-6 rounded-3xl border border-line bg-surface px-5 py-7 shadow-soft sm:px-12 sm:py-12 print:border-0 print:px-0 print:shadow-none">
        <LyricsView lyrics={song.lyrics} size={lyricsSize.size} />
      </div>

      {song.audioUrl && (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-soft print:hidden">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <Volume2 className="size-4 text-accent" aria-hidden="true" />
            Extrait audio
          </h2>
          <audio controls preload="none" src={song.audioUrl} className="mt-3 w-full">
            Votre navigateur ne lit pas l'audio.
          </audio>
        </section>
      )}


      {song.related.length > 0 && (
        <section className="mt-16 print:hidden" aria-labelledby="related-title">
          <h2 id="related-title" className="mb-5 font-serif text-2xl font-semibold tracking-tight">
            Du même artiste
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {song.related.map((related) => (
              <SongCard key={`${related.artistSlug}/${related.slug}`} song={related} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
