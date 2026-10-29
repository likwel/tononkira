import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from './storage';
import type { SongSummary } from './types';

/**
 * Favoris gardés dans le navigateur (pas de compte). On stocke le résumé de la
 * chanson pour afficher la liste sans appel à l'API.
 */
export const FAVORITES_KEY = 'tononkira-favorites';

export type Favorite = Pick<SongSummary, 'artistSlug' | 'slug' | 'title' | 'artists'> & {
  addedAt: string;
};

const keyOf = (song: Pick<SongSummary, 'artistSlug' | 'slug'>) => `${song.artistSlug}/${song.slug}`;

function load(): Favorite[] {
  const value = readStorage<unknown>(FAVORITES_KEY, []);
  return Array.isArray(value) ? (value as Favorite[]) : [];
}

let favorites: Favorite[] = load();
const listeners = new Set<() => void>();

function save(next: Favorite[]) {
  favorites = next;
  writeStorage(FAVORITES_KEY, next);
  listeners.forEach((listener) => listener());
}

export function isFavorite(song: Pick<SongSummary, 'artistSlug' | 'slug'>): boolean {
  const key = keyOf(song);
  return favorites.some((favorite) => keyOf(favorite) === key);
}

export function toggleFavorite(
  song: Pick<SongSummary, 'artistSlug' | 'slug' | 'title' | 'artists'>,
): boolean {
  const key = keyOf(song);
  if (isFavorite(song)) {
    save(favorites.filter((favorite) => keyOf(favorite) !== key));
    return false;
  }
  const { artistSlug, slug, title, artists } = song;
  save([{ artistSlug, slug, title, artists, addedAt: new Date().toISOString() }, ...favorites]);
  return true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Synchronisation entre onglets.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== FAVORITES_KEY) return;
    favorites = load();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useFavorites(): Favorite[] {
  return useSyncExternalStore(
    subscribe,
    () => favorites,
    () => favorites,
  );
}

/** Réservé aux tests. */
export function resetFavoritesStore(): void {
  favorites = load();
}
