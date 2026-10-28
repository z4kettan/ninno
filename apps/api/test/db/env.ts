import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const WORKSPACE_ROOT = resolve(__dirname, '../../../..');

/** Set by the global setup to the throwaway database created for this run. */
export const RUN_DATABASE_ENV = 'NINNO_TEST_RUN_DATABASE_URL';

/** Throwaway databases look like `ninno_test_<epoch ms>_<pid>`; nothing else is ever dropped. */
export const RUN_DATABASE_PATTERN = /^ninno_test_\d+_\d+$/;

/**
 * DATABASE_URL_TEST points at an existing database used only to issue
 * CREATE/DROP DATABASE for per-run throwaway databases. Its name must end in `_test`.
 */
export function testAdminUrl(): string {
  const envFile = resolve(WORKSPACE_ROOT, '.env');
  if (!process.env['DATABASE_URL_TEST'] && existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  const url = process.env['DATABASE_URL_TEST'];
  if (!url) {
    throw new Error('DATABASE_URL_TEST is not set. Copy it from .env.example.');
  }
  const database = databaseName(url);
  if (!database.endsWith('_test')) {
    throw new Error(`DATABASE_URL_TEST must name a database ending in _test, got "${database}".`);
  }
  return url;
}

/** The throwaway database for the current run (available inside tests). */
export function runDatabaseUrl(): string {
  const url = process.env[RUN_DATABASE_ENV];
  if (!url) {
    throw new Error(`${RUN_DATABASE_ENV} is not set; run DB tests via \`nx run api:test-db\`.`);
  }
  return url;
}

export function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

export function withDatabase(url: string, database: string): string {
  const next = new URL(url);
  next.pathname = `/${database}`;
  return next.toString();
}
