import { createHash } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';
import { parseSongLine, type SongInput } from './song-line.js';

export type UpsertOutcome = 'created' | 'updated' | 'unchanged';

export interface ImportReport {
  lines: number;
  created: number;
  updated: number;
  unchanged: number;
  invalid: number;
  failed: number;
}

export interface ImportLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface ImportOptions {
  progressEvery?: number;
  onProgress?: (report: ImportReport) => void;
  signal?: AbortSignal;
}

/**
 * Empreinte du contenu d'une chanson (hors date de collecte) : si elle n'a pas changé
 * depuis le dernier import, la chanson n'est pas réécrite.
 */
export function songHash(song: SongInput): string {
  const { scrapedAt: _scrapedAt, ...content } = song;
  const canonical = JSON.stringify(content, (_key, value: unknown) =>
    value instanceof Date ? value.toISOString() : value,
  );
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Enregistre les chansons dans la base. Règles :
 * - une chanson est identifiée par son URL source (`source_url`), un artiste par son slug ;
 * - chanson connue : ses champs sont mis à jour (même identifiant, mêmes liens) ;
 * - chanson inconnue : elle est créée ;
 * - rien n'est jamais supprimé : une chanson absente du fichier reste en base.
 */
export class SongImporter {
  /** slug → identifiant, complété seulement après validation d'une transaction. */
  private readonly artistIds = new Map<string, { id: number; name: string }>();

  constructor(private readonly db: PrismaClient) {}

  async upsert(song: SongInput): Promise<UpsertOutcome> {
    const contentHash = songHash(song);
    const existing = await this.db.song.findUnique({
      where: { sourceUrl: song.sourceUrl },
      select: { id: true, contentHash: true },
    });
    if (existing?.contentHash === contentHash) return 'unchanged';

    const { artists, ...fields } = song;
    const data = { ...fields, contentHash };
    const created = new Map<string, { id: number; name: string }>();

    await this.db.$transaction(async (tx) => {
      const ids: number[] = [];
      for (const artist of artists) {
        const cached = this.artistIds.get(artist.slug);
        if (cached && cached.name === artist.name) {
          ids.push(cached.id);
          continue;
        }
        const { id } = await tx.artist.upsert({
          where: { slug: artist.slug },
          create: artist,
          update: { name: artist.name, sortName: artist.sortName },
          select: { id: true },
        });
        created.set(artist.slug, { id, name: artist.name });
        ids.push(id);
      }

      const { id: songId } = existing
        ? await tx.song.update({ where: { id: existing.id }, data, select: { id: true } })
        : await tx.song.create({ data, select: { id: true } });
      await tx.songArtist.deleteMany({ where: { songId } });
      await tx.songArtist.createMany({
        data: ids.map((artistId, position) => ({ songId, artistId, position })),
      });
    });
    for (const [slug, artist] of created) this.artistIds.set(slug, artist);
    return existing ? 'updated' : 'created';
  }
}

/** Importe un JSONL ligne par ligne (voir `SongImporter` pour les règles de mise à jour). */
export async function importSongs(
  db: PrismaClient,
  lines: AsyncIterable<string>,
  logger: ImportLogger,
  { progressEvery = 500, onProgress, signal }: ImportOptions = {},
): Promise<ImportReport> {
  const report: ImportReport = {
    lines: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    invalid: 0,
    failed: 0,
  };
  const importer = new SongImporter(db);

  for await (const raw of lines) {
    signal?.throwIfAborted();
    if (!raw.trim()) continue;
    report.lines += 1;
    const parsed = parseSongLine(raw);
    if (!parsed.ok) {
      report.invalid += 1;
      logger.warn(`Ligne ${report.lines} ignorée — ${parsed.error}`);
      continue;
    }
    try {
      report[await importer.upsert(parsed.song)] += 1;
    } catch (error) {
      report.failed += 1;
      logger.warn(`Ligne ${report.lines} (${parsed.song.sourceUrl}) en échec — ${String(error)}`);
    }
    if (report.lines % progressEvery === 0) {
      logger.info(
        `${report.lines} lignes lues : ${report.created} créées, ${report.updated} mises à jour, ` +
          `${report.unchanged} inchangées…`,
      );
      onProgress?.({ ...report });
    }
  }
  onProgress?.({ ...report });
  return report;
}

export function describeImport(report: ImportReport): string {
  return (
    `${report.created} créées, ${report.updated} mises à jour, ${report.unchanged} inchangées, ` +
    `${report.invalid} invalides, ${report.failed} en échec (${report.lines} lignes)`
  );
}
