import { keepPreviousData, QueryClient, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import type { ArtistSort, SongSort } from '../lib/types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // Inutile de réessayer une 404 ou une 400.
      retry: (failures, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 2,
    },
  },
});

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: ({ signal }) => api.stats(signal),
    staleTime: 5 * 60_000,
  });
}

export function useSongs(params: {
  page?: number;
  limit?: number;
  sort?: SongSort;
  letter?: string;
}) {
  return useQuery({
    queryKey: ['songs', params],
    queryFn: ({ signal }) => api.songs(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSong(artistSlug: string, slug: string) {
  return useQuery({
    queryKey: ['song', artistSlug, slug],
    queryFn: ({ signal }) => api.song(artistSlug, slug, signal),
    staleTime: 5 * 60_000,
  });
}

export function useArtists(params: {
  page?: number;
  limit?: number;
  sort?: ArtistSort;
  letter?: string;
  q?: string;
}) {
  return useQuery({
    queryKey: ['artists', params],
    queryFn: ({ signal }) => api.artists(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useArtist(slug: string) {
  return useQuery({
    queryKey: ['artist', slug],
    queryFn: ({ signal }) => api.artist(slug, signal),
    staleTime: 5 * 60_000,
  });
}

export function useSearch(q: string, page = 1, limit = 20, enabled = true) {
  const query = q.trim();
  return useQuery({
    queryKey: ['search', query, page, limit],
    queryFn: ({ signal }) => api.search({ q: query, page, limit }, signal),
    enabled: enabled && query.length >= 2,
    placeholderData: keepPreviousData,
  });
}
