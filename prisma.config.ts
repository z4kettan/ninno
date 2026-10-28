import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env by itself. Production gets real env vars instead.
if (process.env['NODE_ENV'] !== 'production' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx --tsconfig prisma/tsconfig.json prisma/seed.ts',
  },
  datasource: {
    // Placeholder keeps `prisma generate` working where no database is configured (e.g. CI install).
    url: process.env['DATABASE_URL'] ?? 'postgresql://unset:unset@localhost:5432/unset',
  },
});
