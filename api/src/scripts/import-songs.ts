/**
 * Import du JSONL produit par `data` :
 *   npm run db:import                       (data/output/songs.jsonl par défaut)
 *   npm run db:import -- chemin/vers/songs.jsonl
 *
 * Mise à jour par URL source : les chansons connues sont mises à jour, les nouvelles
 * créées, celles qui n'ont pas changé laissées telles quelles. Rien n'est supprimé.
 */
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { createPrisma } from '../db.js';
import { describeImport, importSongs } from '../importer/import-songs.js';

const DEFAULT_FILE = fileURLToPath(new URL('../../../data/output/songs.jsonl', import.meta.url));

const arg = process.argv[2];
// npm lance le script depuis api/ : un chemin relatif se lit depuis le dossier d'appel.
const file = arg ? path.resolve(process.env.INIT_CWD ?? process.cwd(), arg) : DEFAULT_FILE;

if (!existsSync(file)) {
  console.error(`Fichier introuvable : ${file}\nLancer d'abord la collecte : npm run data:crawl`);
  process.exit(1);
}

const config = loadConfig();
const prisma = createPrisma(config.DATABASE_URL);
const started = Date.now();
console.info(`Import de ${file}`);

try {
  const lines = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  const report = await importSongs(prisma, lines, console);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.info(`Terminé en ${seconds} s : ${describeImport(report)}.`);
  process.exitCode = report.failed > 0 ? 1 : 0;
} finally {
  await prisma.$disconnect();
}
