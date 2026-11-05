import { Link, useViewTransitionState } from 'react-router';
import { artistPath } from '../lib/api';
import { plural } from '../lib/format';
import type { ArtistSummary } from '../lib/types';
import { Avatar } from './Avatar';

export function ArtistCard({ artist }: { artist: ArtistSummary }) {
  const to = artistPath(artist);
  // La vignette cliquée rejoint celle de la fiche artiste pendant la transition.
  const morph = useViewTransitionState(to);
  return (
    <Link
      to={to}
      viewTransition
      className="group flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-5 text-center shadow-soft transition duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-accent/40 hover:shadow-lift"
    >
      <span
        style={morph ? { viewTransitionName: 'artist-avatar' } : undefined}
        className="rounded-full transition duration-300 ease-[var(--ease-spring)] group-hover:scale-110"
      >
        <Avatar name={artist.name} seed={artist.slug} size="lg" />
      </span>
      <span className="w-full min-w-0">
        <span className="line-clamp-2 font-display text-[0.98rem] font-semibold leading-snug tracking-tight text-ink transition-colors group-hover:text-accent">
          {artist.name}
        </span>
        <span className="mt-1 block text-xs text-muted">{plural(artist.songCount, 'chanson')}</span>
      </span>
    </Link>
  );
}
