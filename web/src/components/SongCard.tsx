import { Eye } from 'lucide-react';
import { Link, useViewTransitionState } from 'react-router';
import { songPath } from '../lib/api';
import { artistNames, formatCount } from '../lib/format';
import type { SongSummary } from '../lib/types';
import { Avatar } from './Avatar';
import { Highlight } from './Highlight';

/**
 * Pendant la navigation vers la chanson, le titre cliqué porte le nom de transition
 * « song-title » : il glisse jusqu'au titre de la page. Désactivé (`morph={false}`) là où
 * la page affiche déjà un titre de ce nom (chansons liées sur une page de chanson).
 */
function useTitleMorph(to: string, morph: boolean) {
  const transitioning = useViewTransitionState(to);
  return morph && transitioning ? { viewTransitionName: 'song-title' } : undefined;
}

export function SongCard({ song, morph = true }: { song: SongSummary; morph?: boolean }) {
  const to = songPath(song);
  const titleStyle = useTitleMorph(to, morph);
  return (
    <Link
      to={to}
      viewTransition
      className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 pr-4 shadow-soft transition duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-accent/40 hover:shadow-lift"
    >
      <span className="transition duration-300 ease-[var(--ease-spring)] group-hover:scale-105 group-hover:-rotate-3">
        <Avatar name={song.artists[0]?.name ?? song.title} seed={song.artistSlug} shape="square" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          style={titleStyle}
          className="block w-fit max-w-full truncate font-display text-[1.05rem] font-semibold leading-snug tracking-tight text-ink transition-colors group-hover:text-accent"
        >
          {song.title}
        </span>
        <span className="block truncate text-sm text-muted">{artistNames(song.artists)}</span>
      </span>
      <span
        className="flex shrink-0 items-center gap-1 text-xs text-muted tabular-nums"
        title="Consultations"
      >
        <Eye className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Consultations :</span>
        {formatCount(song.views)}
      </span>
    </Link>
  );
}

interface SongRowProps {
  song: SongSummary;
  /** Numéro affiché à gauche (classement, position dans la liste). */
  index?: number;
  /** Recherche à surligner dans le titre et l'extrait. */
  query?: string;
  showArtist?: boolean;
  morph?: boolean;
}

export function SongRow({
  song,
  index,
  query = '',
  showArtist = true,
  morph = true,
}: SongRowProps) {
  const to = songPath(song);
  const titleStyle = useTitleMorph(to, morph);
  return (
    <Link
      to={to}
      viewTransition
      className="group -mx-3 flex items-start gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-surface"
    >
      {index !== undefined && (
        <span className="w-8 shrink-0 pt-0.5 text-right font-display text-2xl leading-none text-accent/80 tabular-nums">
          {String(index).padStart(2, '0')}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          style={titleStyle}
          className="block w-fit font-display text-[1.05rem] font-semibold leading-snug tracking-tight text-ink transition-colors group-hover:text-accent"
        >
          <Highlight text={song.title} query={query} />
        </span>
        {showArtist && (
          <span className="mt-0.5 block truncate text-sm text-muted">
            <Highlight text={artistNames(song.artists)} query={query} />
          </span>
        )}
        {song.excerpt && (
          <span className="mt-1.5 block font-serif text-[1rem] leading-relaxed text-ink-soft italic">
            « <Highlight text={song.excerpt} query={query} /> »
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1 pt-1 text-xs text-muted tabular-nums">
        <Eye className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Consultations :</span>
        {formatCount(song.views)}
      </span>
    </Link>
  );
}
