import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client.js';

export function createPrisma(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Modèles déclarés dans prisma/schema.prisma (même chemin depuis src/ et dist/). */
export function schemaModels(
  schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8'),
): string[] {
  return [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]!);
}

/**
 * Le client Prisma est généré (dossier ignoré par git) : après un `git pull` qui ajoute
 * un modèle, il faut le régénérer, sinon `prisma.nouveauModele` vaut undefined et chaque
 * route concernée répond 500. On le détecte au démarrage avec un message clair.
 */
export function staleClientModels(
  declared = schemaModels(),
  generated: string[] = Object.values(Prisma.ModelName),
): string[] {
  return declared.filter((model) => !generated.includes(model));
}

export type { PrismaClient };
