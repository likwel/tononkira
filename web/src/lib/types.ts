/** Miroir des réponses de l'API (api/src/catalog.ts). */

export interface ArtistRef {
  slug: string;
  name: string;
}

export interface SongSummary {
  artistSlug: string;
  slug: string;
  title: string;
  artists: ArtistRef[];
  views: number;
  likes: number;
  publishedAt: string | null;
  excerpt?: string | null;
}

export interface SongDetail extends SongSummary {
  lyrics: string;
  contributor: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  source: string;
  sourceUrl: string;
  related: SongSummary[];
}

export interface ArtistSummary {
  slug: string;
  name: string;
  songCount: number;
}

export interface ArtistDetail extends ArtistSummary {
  totalViews: number;
  songs: SongSummary[];
}

export interface Stats {
  songs: number;
  artists: number;
  lastPublishedAt: string | null;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface SearchResult {
  data: { songs: SongSummary[]; artists: ArtistSummary[] };
  meta: PageMeta;
}

export type SongSort = 'recent' | 'popular' | 'title';
export type ArtistSort = 'name' | 'songs';
