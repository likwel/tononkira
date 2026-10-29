import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSongLine } from '../src/importer/song-line.js';

const contract = readFileSync(
  new URL('../../contracts/song.example.json', import.meta.url),
  'utf8',
);
const example = JSON.parse(contract) as Record<string, unknown>;
const line = (overrides: Record<string, unknown>) => JSON.stringify({ ...example, ...overrides });

describe('parseSongLine (contrat data → api)', () => {
  it("accepte l'exemple du contrat et le convertit", () => {
    const parsed = parseSongLine(JSON.stringify(example));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.song).toMatchObject({
      sourceUrl: example.source_url,
      artistSlug: 'mpihira-santionany',
      slug: 'hira-santionany',
      sortTitle: 'hira santionany',
      views: 209,
      likes: 3,
    });
    expect(parsed.song.publishedAt?.toISOString()).toBe('2026-09-17T09:16:00.000Z');
    expect(parsed.song.artists.map((a) => a.slug)).toEqual(['mpihira-santionany', 'mpiara-mihira']);
  });

  it('dédoublonne les artistes en gardant le premier', () => {
    const parsed = parseSongLine(
      line({
        artists: [
          { slug: 'a', name: 'A' },
          { slug: 'a', name: 'Bis' },
          { slug: 'b', name: 'B' },
        ],
      }),
    );
    expect(parsed.ok && parsed.song.artists.map((a) => a.name)).toEqual(['A', 'B']);
  });

  it('accepte les champs facultatifs absents', () => {
    const { contributor, image_url, audio_url, published_at, views, likes, ...minimal } = example;
    const parsed = parseSongLine(JSON.stringify(minimal));
    expect(parsed.ok && parsed.song).toMatchObject({
      contributor: null,
      imageUrl: null,
      publishedAt: null,
      views: 0,
    });
  });

  it.each([
    ['JSON invalide', '{"title": ', 'JSON invalide'],
    ['sans artiste', line({ artists: [] }), 'artists'],
    ['titre vide', line({ title: '   ' }), 'title'],
    ['slug avec « / »', line({ slug: 'a/b' }), 'slug'],
    ['date sans fuseau', line({ published_at: '17/09/2026 12:16' }), 'published_at'],
    ['vues négatives', line({ views: -1 }), 'views'],
    ['URL source invalide', line({ source_url: 'pas une url' }), 'source_url'],
  ])('refuse une ligne %s', (_label, raw, expected) => {
    const parsed = parseSongLine(raw);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain(expected);
  });
});
