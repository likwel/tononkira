import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteCrawlState } from '../src/admin/crawl-state.js';

// La base est créée avec le schéma du contrat, celui-là même qu'écrit data/.
const schema = readFileSync(new URL('../../contracts/crawl-state.sql', import.meta.url), 'utf8');

let dir: string;
let file: string;

function song(url: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    url,
    source: 'serasera',
    artist_slug: 'magma',
    slug: url.split('/').at(-1)!,
    title: url.split('/').at(-1)!,
    status,
    attempts: 0,
    error: null,
    data: null,
    discovered_at: '2026-10-29T06:00:00+00:00',
    updated_at: '2026-10-29T06:00:00+00:00',
    checked_at: null,
    changed_at: null,
    ...extra,
  };
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'crawl-state-'));
  file = path.join(dir, 'state.sqlite3');
  const db = new DatabaseSync(file);
  db.exec(schema);
  const insert = db.prepare(
    `INSERT INTO songs VALUES (:url, :source, :artist_slug, :slug, :title, :status, :attempts,
       :error, :data, :discovered_at, :updated_at, :checked_at, :changed_at)`,
  );
  insert.run(
    song('https://x/hira/magma/potika', 'done', {
      data: JSON.stringify({ scraped_at: 'S1', artists: [{ slug: 'magma', name: 'MAGMA' }] }),
      updated_at: '2026-10-29T08:00:00+00:00',
      checked_at: '2026-10-29T08:00:00+00:00',
    }),
  );
  insert.run(song('https://x/hira/magma/anatra-ihany', 'done', { updated_at: '2026-10-29T07:00:00+00:00' }));
  insert.run(song('https://x/hira/naina/100%_fitiavana', 'pending', { artist_slug: 'naina' }));
  insert.run(song('https://x/hira/naina/tsy-hita', 'error', { error: 'HTTP 500', attempts: 2 }));
  db.prepare('INSERT INTO list_pages VALUES (?, ?, ?, ?)').run('serasera', 9, 20, '2026-10-29T06:00:00+00:00');
  db.prepare('INSERT INTO list_pages VALUES (?, ?, ?, ?)').run('serasera', 1, 20, '2026-10-29T05:00:00+00:00');
  db.prepare('INSERT INTO meta VALUES (?, ?)').run('serasera:last_page', '884');
  db.close();
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('SqliteCrawlState', () => {
  it("résume l'avancement de la collecte", () => {
    expect(new SqliteCrawlState(file).stats()).toMatchObject({
      done: 2,
      pending: 1,
      error: 1,
      gone: 0,
      total: 4,
      listPages: 2,
      lastPage: 884,
      lastSongUpdatedAt: '2026-10-29T08:00:00+00:00',
    });
  });

  it('liste les pages collectées, les plus récentes d’abord, avec leurs dates', () => {
    const { items, total } = new SqliteCrawlState(file).songs({ page: 1, limit: 10, sort: 'recent' });
    expect(total).toBe(4);
    expect(items[0]).toMatchObject({
      slug: 'potika',
      status: 'done',
      scrapedAt: 'S1',
      checkedAt: '2026-10-29T08:00:00+00:00',
      artists: [{ slug: 'magma', name: 'MAGMA' }],
    });
  });

  it('filtre par statut et par texte, jokers SQL compris littéralement', () => {
    const state = new SqliteCrawlState(file);
    expect(state.songs({ page: 1, limit: 10, sort: 'recent', status: 'error' }).items[0]).toMatchObject({
      slug: 'tsy-hita',
      error: 'HTTP 500',
      attempts: 2,
    });
    expect(state.songs({ page: 1, limit: 10, sort: 'recent', q: '100%_' }).total).toBe(1);
    expect(state.songs({ page: 1, limit: 10, sort: 'recent', q: '%' }).total).toBe(1);
    expect(state.songs({ page: 1, limit: 10, sort: 'recent', q: 'MAGMA' }).total).toBe(2);
  });

  it('trie « à revérifier » : jamais vérifiées d’abord', () => {
    const { items } = new SqliteCrawlState(file).songs({ page: 1, limit: 10, sort: 'stale', status: 'done' });
    expect(items.map((item) => item.slug)).toEqual(['anatra-ihany', 'potika']);
  });

  it('liste les pages de liste dans l’ordre', () => {
    const { items } = new SqliteCrawlState(file).listPages({ page: 1, limit: 10 });
    expect(items.map((item) => item.page)).toEqual([1, 9]);
  });

  it('répond vide tant que la collecte n’a jamais tourné', () => {
    const state = new SqliteCrawlState(path.join(dir, 'absente.sqlite3'));
    expect(state.stats()).toBeNull();
    expect(state.songs({ page: 1, limit: 10, sort: 'recent' })).toEqual({ items: [], total: 0 });
  });
});
