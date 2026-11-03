import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from './storage';
import type { SongSummary } from './types';

/** Chansons consultées récemment, gardées dans ce navigateur (rubrique « Reprendre la lecture »). */
export const HISTORY_KEY = 'tononkira-history';
export const HISTORY_SIZE = 12;

export type HistoryEntry = Pick<SongSummary, 'artistSlug' | 'slug' | 'title' | 'artists'> & {
  viewedAt: string;
};

const keyOf = (song: Pick<SongSummary, 'artistSlug' | 'slug'>) => `${song.artistSlug}/${song.slug}`;

function load(): HistoryEntry[] {
  const value = readStorage<unknown>(HISTORY_KEY, []);
  return Array.isArray(value) ? (value as HistoryEntry[]) : [];
}

let entries: HistoryEntry[] = load();
const listeners = new Set<() => void>();

function save(next: HistoryEntry[]) {
  entries = next;
  writeStorage(HISTORY_KEY, next);
  listeners.forEach((listener) => listener());
}

/** La chanson consultée passe en tête ; la liste est bornée à HISTORY_SIZE. */
export function recordView(
  song: Pick<SongSummary, 'artistSlug' | 'slug' | 'title' | 'artists'>,
  now = new Date(),
): void {
  const { artistSlug, slug, title, artists } = song;
  const rest = entries.filter((entry) => keyOf(entry) !== keyOf(song));
  save(
    [{ artistSlug, slug, title, artists, viewedAt: now.toISOString() }, ...rest].slice(
      0,
      HISTORY_SIZE,
    ),
  );
}

export function clearHistory(): void {
  save([]);
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => entries,
    () => entries,
  );
}

/** Réservé aux tests. */
export function resetHistoryStore(): void {
  entries = load();
}
