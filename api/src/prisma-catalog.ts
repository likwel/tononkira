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
} from './catalog.js';
import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import { escapeLike, findExcerpt } from './lib/text.js';

const songSummarySelect = {
  id: true,
  artistSlug: true,
  slug: true,
  title: true,
  views: true,
  likes: true,
  publishedAt: true,
  artists: {
    orderBy: { position: 'asc' },
    select: { artist: { select: { slug: true, name: true } } },
  },
} satisfies Prisma.SongSelect;

type SongSummaryRow = Prisma.SongGetPayload<{ select: typeof songSummarySelect }>;

const artistSummarySelect = {
  slug: true,
  name: true,
  _count: { select: { songs: true } },
} satisfies Prisma.ArtistSelect;

type ArtistSummaryRow = Prisma.ArtistGetPayload<{ select: typeof artistSummarySelect }>;

function toSongSummary(row: SongSummaryRow): SongSummaryDto {
  return {
    artistSlug: row.artistSlug,
    slug: row.slug,
    title: row.title,
    artists: row.artists.map(({ artist }) => ({ slug: artist.slug, name: artist.name })),
    views: row.views,
    likes: row.likes,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

function toArtistSummary(row: ArtistSummaryRow): ArtistSummaryDto {
  return { slug: row.slug, name: row.name, songCount: row._count.songs };
}

const SONG_ORDER: Record<SongListQuery['sort'], Prisma.SongOrderByWithRelationInput[]> = {
  recent: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
  popular: [{ views: 'desc' }, { id: 'asc' }],
  title: [{ sortTitle: 'asc' }, { id: 'asc' }],
};

const ARTIST_ORDER: Record<ArtistListQuery['sort'], Prisma.ArtistOrderByWithRelationInput[]> = {
  name: [{ sortName: 'asc' }, { id: 'asc' }],
  songs: [{ songs: { _count: 'desc' } }, { sortName: 'asc' }],
};

export class PrismaCatalog implements Catalog {
  constructor(private readonly db: PrismaClient) {}

  async ping(): Promise<void> {
    await this.db.$queryRaw`SELECT 1`;
  }

  async stats(): Promise<StatsDto> {
    const [songs, artists, latest] = await Promise.all([
      this.db.song.count(),
      this.db.artist.count(),
      this.db.song.aggregate({ _max: { publishedAt: true } }),
    ]);
    return { songs, artists, lastPublishedAt: latest._max.publishedAt?.toISOString() ?? null };
  }

  async listSongs({ page, limit, sort, letter }: SongListQuery): Promise<Page<SongSummaryDto>> {
    const where: Prisma.SongWhereInput = letter ? { sortTitle: { startsWith: letter } } : {};
    const [total, rows] = await Promise.all([
      this.db.song.count({ where }),
      this.db.song.findMany({
        where,
        orderBy: SONG_ORDER[sort],
        skip: (page - 1) * limit,
        take: limit,
        select: songSummarySelect,
      }),
    ]);
    return { items: rows.map(toSongSummary), total };
  }

  async getSong(artistSlug: string, slug: string): Promise<SongDetailDto | null> {
    const row = await this.db.song.findUnique({
      where: { artistSlug_slug: { artistSlug, slug } },
      select: {
        ...songSummarySelect,
        lyrics: true,
        contributor: true,
        imageUrl: true,
        audioUrl: true,
        source: true,
        sourceUrl: true,
      },
    });
    if (!row) return null;

    const artistSlugs = row.artists.map(({ artist }) => artist.slug);
    const related = await this.db.song.findMany({
      where: {
        id: { not: row.id },
        artists: { some: { artist: { slug: { in: artistSlugs } } } },
      },
      orderBy: [{ views: 'desc' }, { id: 'asc' }],
      take: 8,
      select: songSummarySelect,
    });

    return {
      ...toSongSummary(row),
      lyrics: row.lyrics,
      contributor: row.contributor,
      imageUrl: row.imageUrl,
      audioUrl: row.audioUrl,
      source: row.source,
      sourceUrl: row.sourceUrl,
      related: related.map(toSongSummary),
    };
  }

  async randomSong(): Promise<SongSummaryDto | null> {
    const total = await this.db.song.count();
    if (total === 0) return null;
    const row = await this.db.song.findFirst({
      orderBy: { id: 'asc' },
      skip: Math.floor(Math.random() * total),
      select: songSummarySelect,
    });
    return row ? toSongSummary(row) : null;
  }

  async listArtists({
    page,
    limit,
    sort,
    letter,
    q,
  }: ArtistListQuery): Promise<Page<ArtistSummaryDto>> {
    const where: Prisma.ArtistWhereInput = {
      ...(letter ? { sortName: { startsWith: letter } } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.db.artist.count({ where }),
      this.db.artist.findMany({
        where,
        orderBy: ARTIST_ORDER[sort],
        skip: (page - 1) * limit,
        take: limit,
        select: artistSummarySelect,
      }),
    ]);
    return { items: rows.map(toArtistSummary), total };
  }

  async getArtist(slug: string): Promise<ArtistDetailDto | null> {
    const artist = await this.db.artist.findUnique({
      where: { slug },
      select: {
        ...artistSummarySelect,
        songs: {
          orderBy: { song: { sortTitle: 'asc' } },
          select: { song: { select: songSummarySelect } },
        },
      },
    });
    if (!artist) return null;
    const songs = artist.songs.map(({ song }) => toSongSummary(song));
    return {
      ...toArtistSummary(artist),
      totalViews: songs.reduce((sum, song) => sum + song.views, 0),
      songs,
    };
  }

  /**
   * Recherche dans les titres, les noms d'artistes et les paroles. Classement : titre qui
   * commence par la recherche, puis titre qui la contient, puis ressemblance du titre
   * (pg_trgm), puis popularité. Les index GIN trigrammes accélèrent les ILIKE '%…%'.
   */
  async searchSongs({ q, page, limit }: SearchQuery): Promise<Page<SongSummaryDto>> {
    const contains = `%${escapeLike(q)}%`;
    const prefix = `${escapeLike(q)}%`;
    const matches = Prisma.sql`(
      s.title ILIKE ${contains}
      OR s.lyrics ILIKE ${contains}
      OR EXISTS (
        SELECT 1 FROM song_artists sa JOIN artists a ON a.id = sa.artist_id
        WHERE sa.song_id = s.id AND a.name ILIKE ${contains}
      )
    )`;

    const [countRows, idRows] = await Promise.all([
      this.db.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM songs s WHERE ${matches}`,
      this.db.$queryRaw<{ id: number }[]>`
        SELECT s.id FROM songs s WHERE ${matches}
        ORDER BY (s.title ILIKE ${prefix}) DESC,
                 (s.title ILIKE ${contains}) DESC,
                 similarity(s.title, ${q}) DESC,
                 s.views DESC,
                 s.id
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    ]);

    const ids = idRows.map((row) => row.id);
    const rows = ids.length
      ? await this.db.song.findMany({
          where: { id: { in: ids } },
          select: { ...songSummarySelect, lyrics: true },
        })
      : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [{ ...toSongSummary(row), excerpt: findExcerpt(row.lyrics, q) }] : [];
    });
    return { items, total: countRows[0]?.total ?? 0 };
  }

  async searchArtists(q: string, limit: number): Promise<ArtistSummaryDto[]> {
    const rows = await this.db.artist.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: [{ songs: { _count: 'desc' } }, { sortName: 'asc' }],
      take: limit,
      select: artistSummarySelect,
    });
    return rows.map(toArtistSummary);
  }
}
