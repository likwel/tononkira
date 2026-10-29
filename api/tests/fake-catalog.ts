import type {
  ArtistDetailDto,
  ArtistListQuery,
  ArtistSummaryDto,
  Catalog,
  Page,
  SearchQuery,
  SongDetailDto,
  SongListQuery,
  SongSummaryDto,
  StatsDto,
} from '../src/catalog.js';

export const SONG: SongSummaryDto = {
  artistSlug: 'mpihira',
  slug: 'hira',
  title: 'Hira',
  artists: [{ slug: 'mpihira', name: 'Mpihira' }],
  views: 10,
  likes: 1,
  publishedAt: '2026-09-17T09:16:00.000Z',
};

export const ARTIST: ArtistSummaryDto = { slug: 'mpihira', name: 'Mpihira', songCount: 1 };

/** Catalogue en mémoire qui enregistre les requêtes reçues. */
export class FakeCatalog implements Catalog {
  calls: { method: string; args: unknown[] }[] = [];
  healthy = true;
  failWith: Error | null = null;

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args });
    if (this.failWith) throw this.failWith;
  }

  lastCall(method: string) {
    return this.calls.filter((call) => call.method === method).at(-1)?.args;
  }

  async ping(): Promise<void> {
    if (!this.healthy) throw new Error('base indisponible');
  }

  async stats(): Promise<StatsDto> {
    this.record('stats');
    return { songs: 1, artists: 1, lastPublishedAt: SONG.publishedAt };
  }

  async listSongs(query: SongListQuery): Promise<Page<SongSummaryDto>> {
    this.record('listSongs', query);
    return { items: [SONG], total: 50 };
  }

  async getSong(artistSlug: string, slug: string): Promise<SongDetailDto | null> {
    this.record('getSong', artistSlug, slug);
    if (artistSlug !== SONG.artistSlug || slug !== SONG.slug) return null;
    return {
      ...SONG,
      lyrics: 'Andalana',
      contributor: null,
      imageUrl: null,
      audioUrl: null,
      source: 'serasera',
      sourceUrl: 'https://tononkira.serasera.org/hira/mpihira/hira',
      related: [],
    };
  }

  songs: SongSummaryDto[] = [SONG];

  async randomSong(): Promise<SongSummaryDto | null> {
    this.record('randomSong');
    return this.songs[0] ?? null;
  }

  async listArtists(query: ArtistListQuery): Promise<Page<ArtistSummaryDto>> {
    this.record('listArtists', query);
    return { items: [ARTIST], total: 1 };
  }

  async getArtist(slug: string): Promise<ArtistDetailDto | null> {
    this.record('getArtist', slug);
    return slug === ARTIST.slug ? { ...ARTIST, totalViews: 10, songs: [SONG] } : null;
  }

  async searchSongs(query: SearchQuery): Promise<Page<SongSummaryDto>> {
    this.record('searchSongs', query);
    return { items: [{ ...SONG, excerpt: 'Andalana' }], total: 1 };
  }

  async searchArtists(q: string, limit: number): Promise<ArtistSummaryDto[]> {
    this.record('searchArtists', q, limit);
    return [ARTIST];
  }
}
