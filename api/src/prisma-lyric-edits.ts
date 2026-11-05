import type { Page } from './catalog.js';
import type { PrismaClient } from './generated/prisma/client.js';
import type {
  EditStatus,
  LyricEditDto,
  LyricEditQuery,
  LyricEdits,
  NewLyricEdit,
} from './lyric-edits.js';

const select = {
  id: true,
  status: true,
  lyrics: true,
  baseLyrics: true,
  note: true,
  author: true,
  createdAt: true,
  reviewedAt: true,
  song: { select: { artistSlug: true, slug: true, title: true } },
} as const;

type Row = {
  id: number;
  status: string;
  lyrics: string;
  baseLyrics: string;
  note: string | null;
  author: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  song: { artistSlug: string; slug: string; title: string };
};

function toDto(row: Row): LyricEditDto {
  return {
    id: row.id,
    status: row.status as EditStatus,
    song: row.song,
    lyrics: row.lyrics,
    baseLyrics: row.baseLyrics,
    note: row.note,
    author: row.author,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

export class PrismaLyricEdits implements LyricEdits {
  constructor(private readonly db: PrismaClient) {}

  async submit({ artistSlug, slug, lyrics, note, author }: NewLyricEdit) {
    const song = await this.db.song.findUnique({
      where: { artistSlug_slug: { artistSlug, slug } },
      select: { id: true, lyrics: true },
    });
    if (!song) return 'unknown-song' as const;
    if (song.lyrics.trim() === lyrics.trim()) return 'unchanged' as const;
    const row = await this.db.lyricEdit.create({
      data: {
        songId: song.id,
        lyrics,
        baseLyrics: song.lyrics,
        note: note ?? null,
        author: author ?? null,
      },
      select,
    });
    return toDto(row);
  }

  async list({ page, limit, status }: LyricEditQuery): Promise<Page<LyricEditDto>> {
    const where = status ? { status } : {};
    const [total, rows] = await Promise.all([
      this.db.lyricEdit.count({ where }),
      this.db.lyricEdit.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select,
      }),
    ]);
    return { total, items: rows.map(toDto) };
  }

  countPending() {
    return this.db.lyricEdit.count({ where: { status: 'pending' } });
  }

  async review(id: number, action: 'approve' | 'reject', lyrics?: string | undefined) {
    const current = await this.db.lyricEdit.findUnique({
      where: { id },
      select: { status: true, songId: true, lyrics: true },
    });
    if (!current) return 'not-found' as const;
    if (current.status !== 'pending') return 'already-reviewed' as const;

    const published = lyrics ?? current.lyrics;
    const row = await this.db.$transaction(async (tx) => {
      if (action === 'approve') {
        // `contentHash` n'est pas touché : un import ultérieur de la même page source
        // reste « inchangé » et ne réécrit donc pas la correction validée.
        await tx.song.update({ where: { id: current.songId }, data: { lyrics: published } });
      }
      return tx.lyricEdit.update({
        where: { id },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          lyrics: published,
          reviewedAt: new Date(),
        },
        select,
      });
    });
    return toDto(row);
  }
}
