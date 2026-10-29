import { pino } from 'pino';
import { SqliteCrawlState } from './admin/crawl-state.js';
import { JobRunner } from './admin/jobs.js';
import {
  PrismaFileImporter,
  PrismaJobStore,
  PrismaSongLibrary,
} from './admin/prisma-adapters.js';
import { ProcessPythonRunner } from './admin/python.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPrisma } from './db.js';
import { PrismaCatalog } from './prisma-catalog.js';

const config = loadConfig();
const logger = pino({
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
    : {}),
});

const prisma = createPrisma(config.DATABASE_URL);
const catalog = new PrismaCatalog(prisma);
const python = new ProcessPythonRunner(config.pythonBin, config.dataDir);
const jobStore = new PrismaJobStore(prisma);
const jobs = new JobRunner({
  store: jobStore,
  python,
  importer: new PrismaFileImporter(prisma),
  exportPath: config.exportPath,
});

const interrupted = await jobStore.interruptRunning();
if (interrupted) logger.warn(`${interrupted} tâche(s) coupée(s) par le dernier arrêt du serveur.`);
if (!config.ADMIN_TOKEN) {
  logger.warn('ADMIN_TOKEN absent : l’administration (/api/admin) est désactivée.');
}

const app = createApp({
  catalog,
  corsOrigins: config.corsOrigins,
  logger,
  admin: {
    token: config.ADMIN_TOKEN,
    catalog,
    crawl: new SqliteCrawlState(config.crawlStatePath),
    jobs,
    jobStore,
    python,
    library: new PrismaSongLibrary(prisma),
  },
});

const server = app.listen(config.PORT, config.HOST, () => {
  logger.info(`API Tononkira prête sur http://localhost:${config.PORT}/api`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} reçu, arrêt en cours…`);
  server.close();
  // Une collecte en cours enregistre son état avant de s'arrêter.
  const current = jobs.current();
  if (current?.status === 'running') {
    jobs.cancel(current.id);
    await Promise.race([jobs.idle(), new Promise((resolve) => setTimeout(resolve, 10_000))]);
  }
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
