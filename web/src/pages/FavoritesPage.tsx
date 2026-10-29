import { Heart, X } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { PageHeader } from '../components/PageParts';
import { EmptyState } from '../components/States';
import { buttonPrimary, iconButton } from '../components/ui';
import { songPath } from '../lib/api';
import { toggleFavorite, useFavorites } from '../lib/favorites';
import { artistNames, plural } from '../lib/format';

export function FavoritesPage() {
  const favorites = useFavorites();

  return (
    <>
      <title>Favoris · Tononkira</title>
      <PageHeader
        eyebrow="Ankafizina"
        title="Vos favoris"
        description={
          favorites.length
            ? `${plural(favorites.length, 'chanson')}, ${favorites.length > 1 ? 'enregistrées' : 'enregistrée'} sur cet appareil.`
            : 'Gardez sous la main les chansons que vous aimez chanter.'
        }
      />
      <div className="container-page">
        <div className="max-w-4xl">
          {favorites.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Aucun favori pour l'instant"
              action={
                <Link to="/hira" className={buttonPrimary}>
                  Découvrir des chansons
                </Link>
              }
            >
              Sur la page d'une chanson, touchez « Ajouter aux favoris ». Vos favoris restent dans
              ce navigateur, sans compte.
            </EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {favorites.map((favorite) => (
                <li
                  key={`${favorite.artistSlug}/${favorite.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 shadow-soft transition hover:border-accent/40"
                >
                  <Avatar
                    name={favorite.artists[0]?.name ?? favorite.title}
                    seed={favorite.artistSlug}
                    shape="square"
                  />
                  <Link to={songPath(favorite)} className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-lg leading-snug text-ink group-hover:text-accent">
                      {favorite.title}
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {artistNames(favorite.artists)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(favorite)}
                    className={iconButton}
                    aria-label={`Retirer « ${favorite.title} » des favoris`}
                    title="Retirer des favoris"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
