/**
 * Prépare la base de test : `tononkira_test` sur le PostgreSQL du docker-compose.
 * Refuse toute base dont le nom ne finit pas par `_test` (jamais la base de travail).
 */
import { execFileSync } from 'node:child_process';
import { createPrisma } from '../../src/db.js';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://tononkira:tononkira@localhost:5434/tononkira_test?schema=public';

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(`Base de test refusée (« ${name} ») : son nom doit finir par _test.`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = createPrisma(adminUrl.toString());
  try {
    const exists = await admin.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (!exists.length) await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
