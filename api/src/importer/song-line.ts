/**
 * Validation d'une ligne du JSONL produit par `data` (contrat : contracts/song.example.json).
 */
import { z } from 'zod';
import { sortKey } from '../lib/text.js';

const slug = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[^\s/]+$/, 'slug sans espace ni « / »');
const count = z.number().int().nonnegative().default(0);
const nullableUrl = z.url().nullable().default(null);

export const songLineSchema = z.object({
  source: z.string().min(1),
  source_url: z.url(),
  artist_slug: slug,
  slug,
  title: z.string().trim().min(1),
  artists: z
    .array(z.object({ slug, name: z.string().trim().min(1) }))
    .min(1, 'au moins un artiste'),
  lyrics: z.string(),
  views: count,
  likes: count,
  contributor: z.string().trim().min(1).nullable().default(null),
  published_at: z.iso.datetime({ offset: true }).nullable().default(null),
  image_url: nullableUrl,
  audio_url: nullableUrl,
  scraped_at: z.iso.datetime({ offset: true }).nullable().default(null),
});

export type SongLine = z.infer<typeof songLineSchema>;

export interface SongInput {
  source: string;
  sourceUrl: string;
  artistSlug: string;
  slug: string;
  title: string;
  sortTitle: string;
  lyrics: string;
  views: number;
  likes: number;
  contributor: string | null;
  publishedAt: Date | null;
  imageUrl: string | null;
  audioUrl: string | null;
  scrapedAt: Date | null;
  artists: { slug: string; name: string; sortName: string }[];
}

export type ParsedLine = { ok: true; song: SongInput } | { ok: false; error: string };

export function parseSongLine(line: string): ParsedLine {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return { ok: false, error: 'JSON invalide' };
  }
  const result = songLineSchema.safeParse(json);
  if (!result.success) {
    const error = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`)
      .join(' ; ');
    return { ok: false, error };
  }
  return { ok: true, song: toSongInput(result.data) };
}

export function toSongInput(line: SongLine): SongInput {
  const seen = new Set<string>();
  const artists = line.artists
    .filter((artist) => !seen.has(artist.slug) && seen.add(artist.slug))
    .map((artist) => ({ ...artist, sortName: sortKey(artist.name) }));
  return {
    source: line.source,
    sourceUrl: line.source_url,
    artistSlug: line.artist_slug,
    slug: line.slug,
    title: line.title,
    sortTitle: sortKey(line.title),
    lyrics: line.lyrics,
    views: line.views,
    likes: line.likes,
    contributor: line.contributor,
    publishedAt: line.published_at ? new Date(line.published_at) : null,
    imageUrl: line.image_url,
    audioUrl: line.audio_url,
    scrapedAt: line.scraped_at ? new Date(line.scraped_at) : null,
    artists,
  };
}
