import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Valeur par défaut = base locale du docker-compose, pour que `prisma generate`
    // (lancé au `npm install`) fonctionne même sans fichier .env.
    url:
      process.env.DATABASE_URL ??
      'postgresql://tononkira:tononkira@localhost:5434/tononkira?schema=public',
  },
});
