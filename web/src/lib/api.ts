import type {
  ArtistDetail,
  ArtistSort,
  ArtistSummary,
  Paginated,
  SearchResult,
  SongDetail,
  SongSort,
  SongSummary,
  Stats,
} from './types';

export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Params = Record<string, string | number | null | undefined>;

export function buildQuery(params: Params = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function get<T>(path: string, params?: Params, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQuery(params)}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'Impossible de joindre le serveur. Vérifiez votre connexion.');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new ApiError(response.status, body?.error?.message ?? `Erreur ${response.status}`);
  }
  return (await response.json()) as T;
}

const segment = encodeURIComponent;

export const api = {
  stats: (signal?: AbortSignal) =>
    get<{ data: Stats }>('/stats', undefined, signal).then((r) => r.data),

  songs: (
    params: { page?: number; limit?: number; sort?: SongSort; letter?: string },
    signal?: AbortSignal,
  ) => get<Paginated<SongSummary>>('/songs', params, signal),

  song: (artistSlug: string, slug: string, signal?: AbortSignal) =>
    get<{ data: SongDetail }>(
      `/songs/${segment(artistSlug)}/${segment(slug)}`,
      undefined,
      signal,
    ).then((r) => r.data),

  randomSong: () => get<{ data: SongSummary }>('/songs/random').then((r) => r.data),

  artists: (
    params: { page?: number; limit?: number; sort?: ArtistSort; letter?: string; q?: string },
    signal?: AbortSignal,
  ) => get<Paginated<ArtistSummary>>('/artists', params, signal),

  artist: (slug: string, signal?: AbortSignal) =>
    get<{ data: ArtistDetail }>(`/artists/${segment(slug)}`, undefined, signal).then((r) => r.data),

  search: (params: { q: string; page?: number; limit?: number }, signal?: AbortSignal) =>
    get<SearchResult>('/search', params, signal),
};

export function songPath(song: Pick<SongSummary, 'artistSlug' | 'slug'>): string {
  return `/hira/${segment(song.artistSlug)}/${segment(song.slug)}`;
}

export function artistPath(artist: Pick<ArtistSummary, 'slug'>): string {
  return `/mpihira/${segment(artist.slug)}`;
}
