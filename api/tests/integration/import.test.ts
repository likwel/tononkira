import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrisma } from '../../src/db.js';
import { importSongs } from '../../src/importer/import-songs.js';
import { PrismaLyricEdits } from '../../src/prisma-lyric-edits.js';
import { TEST_DATABASE_URL } from './global-setup.js';

const db = createPrisma(TEST_DATABASE_URL);
const silent = { info: () => {}, warn: () => {} };

function line(slug: string, fields: Record<string, unknown> = {}) {
  return JSON.stringify({
    source: 'serasera',
    source_url: `https://tononkira.serasera.org/hira/magma/${slug}`,
    artist_slug: 'magma',
    slug,
    title: slug,
    artists: [{ slug: 'magma', name: 'MAGMA' }],
    lyrics: 'Andalana 1\nAndalana 2',
    views: 1,
    likes: 0,
    contributor: null,
    published_at: '2026-09-17T12:16:00+03:00',
    image_url: null,
    audio_url: null,
    scraped_at: '2026-10-29T08:00:00+00:00',
    ...fields,
  });
}

async function* lines(...values: string[]) {
  yield* values;
}

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE song_artists, songs, artists, crawl_jobs RESTART IDENTITY CASCADE',
  );
});

afterAll(() => db.$disconnect());

describe('import JSONL (mise à jour par URL source)', () => {
  it('crée, met à jour, saute l’inchangé et ne supprime jamais rien', async () => {
    const first = await importSongs(db, lines(line('potika'), line('anatra-ihany')), silent);
    expect(first).toMatchObject({ created: 2, updated: 0, unchanged: 0 });
    const before = await db.song.findUniqueOrThrow({
      where: { sourceUrl: 'https://tononkira.serasera.org/hira/magma/anatra-ihany' },
    });

    // Deuxième fichier : potika absente, anatra-ihany modifiée, niserana nouvelle.
    const second = await importSongs(
      db,
      lines(
        line('anatra-ihany', {
          title: 'Anatra ihany',
          views: 9,
          artists: [
            { slug: 'magma', name: 'MAGMA' },
            { slug: 'naina', name: 'NAINA' },
          ],
        }),
        line('niserana'),
      ),
      silent,
    );
    expect(second).toMatchObject({ created: 1, updated: 1, unchanged: 0, failed: 0 });

    const songs = await db.song.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, slug: true, title: true, views: true },
    });
    expect(songs.map((song) => song.slug)).toEqual(['potika', 'anatra-ihany', 'niserana']);
    const updated = songs.find((song) => song.slug === 'anatra-ihany')!;
    expect(updated).toMatchObject({ id: before.id, title: 'Anatra ihany', views: 9 });
    const links = await db.songArtist.findMany({
      where: { songId: before.id },
      orderBy: { position: 'asc' },
      include: { artist: true },
    });
    expect(links.map((link) => link.artist.slug)).toEqual(['magma', 'naina']);

    const third = await importSongs(db, lines(line('niserana')), silent);
    expect(third).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(await db.song.count()).toBe(3);
  });

  it('réimport forcé : réécrit les chansons inchangées, sans rien supprimer', async () => {
    await importSongs(db, lines(line('potika'), line('niserana')), silent);
    const forced = await importSongs(db, lines(line('potika')), silent, { force: true });
    expect(forced).toMatchObject({ created: 0, updated: 1, unchanged: 0 });
    expect(await db.song.count()).toBe(2);
  });

  it('signale une ligne invalide sans bloquer les autres', async () => {
    const report = await importSongs(db, lines('{"title": ', line('potika')), silent);
    expect(report).toMatchObject({ invalid: 1, created: 1 });
  });
});

describe('corrections approuvées et imports', () => {
  const url = 'https://tononkira.serasera.org/hira/magma/potika';
  const corrected = 'Andalana voalohany voahitsy\nAndalana 2';

  async function approveCorrection() {
    const edits = new PrismaLyricEdits(db);
    const edit = await edits.submit({ artistSlug: 'magma', slug: 'potika', lyrics: corrected });
    if (typeof edit === 'string') throw new Error(edit);
    await edits.review(edit.id, 'approve');
  }

  const lyricsInDb = async () =>
    (await db.song.findUniqueOrThrow({ where: { sourceUrl: url }, select: { lyrics: true } }))
      .lyrics;

  it('survit à un import où la page source a changé (vues, titre…)', async () => {
    await importSongs(db, lines(line('potika')), silent);
    await approveCorrection();

    const report = await importSongs(db, lines(line('potika', { views: 999 })), silent);

    expect(report.updated).toBe(1);
    expect(await lyricsInDb()).toBe(corrected);
    const { views } = await db.song.findUniqueOrThrow({ where: { sourceUrl: url } });
    expect(views).toBe(999);
  });

  it('survit à un réimport complet', async () => {
    await importSongs(db, lines(line('potika')), silent);
    await approveCorrection();

    await importSongs(db, lines(line('potika')), silent, { force: true });

    expect(await lyricsInDb()).toBe(corrected);
  });

  it('est rétablie si un ancien import l’avait écrasée', async () => {
    await importSongs(db, lines(line('potika')), silent);
    await approveCorrection();
    // Ce que faisaient les imports avant la correction du bug : paroles de la source réécrites.
    await db.song.update({ where: { sourceUrl: url }, data: { lyrics: 'Andalana 1\nAndalana 2' } });

    const report = await importSongs(db, lines(line('potika')), silent);

    expect(report.updated).toBe(1);
    expect(await lyricsInDb()).toBe(corrected);
  });
});
