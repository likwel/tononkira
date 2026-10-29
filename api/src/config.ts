import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** Dossier data/ du monorepo (depuis src/ ou dist/, il est deux niveaux au-dessus). */
const DEFAULT_DATA_DIR = fileURLToPath(new URL('../../data', import.meta.url));

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire (voir api/.env.example)'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  /** Jeton de l'administration ; sans lui, les routes /api/admin répondent 503. */
  ADMIN_TOKEN: optional(z.string().min(24, 'ADMIN_TOKEN : au moins 24 caractères')),
  DATA_DIR: optional(z.string()),
  PYTHON_BIN: optional(z.string()),
  CRAWL_STATE_PATH: optional(z.string()),
  EXPORT_PATH: optional(z.string()),
});

export type Config = z.infer<typeof schema> & {
  corsOrigins: string[];
  dataDir: string;
  pythonBin: string;
  crawlStatePath: string;
  exportPath: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuration invalide :\n${details.join('\n')}`);
  }
  const values = parsed.data;
  const corsOrigins = values.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const dataDir = path.resolve(values.DATA_DIR ?? DEFAULT_DATA_DIR);
  return {
    ...values,
    corsOrigins,
    dataDir,
    pythonBin: values.PYTHON_BIN ?? path.join(dataDir, '.venv', 'bin', 'python'),
    crawlStatePath: values.CRAWL_STATE_PATH ?? path.join(dataDir, 'output', 'state.sqlite3'),
    exportPath: values.EXPORT_PATH ?? path.join(dataDir, 'output', 'songs.jsonl'),
  };
}
