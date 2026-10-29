import { Link } from 'react-router';
import { artistPath } from '../lib/api';
import { plural } from '../lib/format';
import type { ArtistSummary } from '../lib/types';
import { Avatar } from './Avatar';

export function ArtistCard({ artist }: { artist: ArtistSummary }) {
  return (
    <Link
      to={artistPath(artist)}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-5 text-center shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lift"
    >
      <Avatar name={artist.name} seed={artist.slug} size="lg" />
      <span className="w-full min-w-0">
        <span className="line-clamp-2 font-serif text-base leading-snug text-ink transition-colors group-hover:text-accent">
          {artist.name}
        </span>
        <span className="mt-1 block text-xs text-muted">{plural(artist.songCount, 'chanson')}</span>
      </span>
    </Link>
  );
}
