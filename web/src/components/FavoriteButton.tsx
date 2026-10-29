import { Heart } from 'lucide-react';
import { toggleFavorite, useFavorites } from '../lib/favorites';
import type { SongSummary } from '../lib/types';
import { cx } from './ui';

export function FavoriteButton({ song }: { song: SongSummary }) {
  const favorites = useFavorites();
  const active = favorites.some(
    (favorite) => favorite.artistSlug === song.artistSlug && favorite.slug === song.slug,
  );

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => toggleFavorite(song)}
      className={cx(
        // Pas de surcharge de couleur sur buttonSecondary : l'ordre des classes CSS déciderait.
        'inline-flex items-center justify-center gap-2 rounded-full border bg-surface px-4 py-2 text-sm font-medium whitespace-nowrap shadow-soft transition-colors',
        active
          ? 'border-accent/50 text-accent'
          : 'border-line text-ink-soft hover:border-accent/50 hover:text-ink',
      )}
    >
      <Heart className={cx('size-4 transition', active && 'fill-current')} aria-hidden="true" />
      {/* Libellé court sur mobile : la barre d'outils partage la largeur avec 4 boutons. */}
      <span className="sm:hidden">Favori</span>
      <span className="max-sm:hidden">{active ? 'Dans vos favoris' : 'Ajouter aux favoris'}</span>
    </button>
  );
}
