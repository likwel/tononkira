/**
 * Contrat entre les routes HTTP et l'accès aux données. Les routes ne connaissent
 * que cette interface : les tests l'implémentent en mémoire, la prod avec Prisma.
 * Les types `*Dto` sont aussi la forme des réponses JSON (miroir côté web : web/src/lib/types.ts).
 */

export interface ArtistRefDto {
  slug: string;
  name: string;
}

export interface SongSummaryDto {
  artistSlug: string;
  slug: string;
  title: string;
  artists: ArtistRefDto[];
  views: number;
  likes: number;
  publishedAt: string | null;
  /** Ligne des paroles qui contient la recherche (résultats de recherche seulement). */
  excerpt?: string | null;
}

export interface SongDetailDto extends SongSummaryDto {
  lyrics: string;
  contributor: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  source: string;
  sourceUrl: string;
  related: SongSummaryDto[];
}

export interface ArtistSummaryDto {
  slug: string;
  name: string;
  songCount: number;
}

export interface ArtistDetailDto extends ArtistSummaryDto {
  totalViews: number;
  songs: SongSummaryDto[];
}

export interface StatsDto {
  songs: number;
  artists: number;
  lastPublishedAt: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export type SongSort = 'recent' | 'popular' | 'title';
export type ArtistSort = 'name' | 'songs';

export interface PageQuery {
  page: number;
  limit: number;
}

export interface SongListQuery extends PageQuery {
  sort: SongSort;
  letter?: string | undefined;
}

export interface ArtistListQuery extends PageQuery {
  sort: ArtistSort;
  letter?: string | undefined;
  q?: string | undefined;
}

export interface SearchQuery extends PageQuery {
  q: string;
}

export interface Catalog {
  ping(): Promise<void>;
  stats(): Promise<StatsDto>;
  listSongs(query: SongListQuery): Promise<Page<SongSummaryDto>>;
  getSong(artistSlug: string, slug: string): Promise<SongDetailDto | null>;
  randomSong(): Promise<SongSummaryDto | null>;
  listArtists(query: ArtistListQuery): Promise<Page<ArtistSummaryDto>>;
  getArtist(slug: string): Promise<ArtistDetailDto | null>;
  searchSongs(query: SearchQuery): Promise<Page<SongSummaryDto>>;
  searchArtists(q: string, limit: number): Promise<ArtistSummaryDto[]>;
}
