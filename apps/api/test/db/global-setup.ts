import { execSync } from 'node:child_process';
import { Client } from 'pg';
import {
  RUN_BUCKET_ENV,
  RUN_DATABASE_ENV,
  testAdminUrl,
  testStorageEnv,
  withDatabase,
  WORKSPACE_ROOT,
} from './env';
import { createRunBucket, storageAdmin } from './test-storage';

/**
 * Creates a fresh database and storage bucket for this run and applies the committed migrations with
 * the non-destructive `prisma migrate deploy`. No existing database is ever reset.
 */
export default async function globalSetup(): Promise<void> {
  const adminUrl = testAdminUrl();
  const name = `ninno_test_${Date.now()}_${process.pid}`;

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  const url = withDatabase(adminUrl, name);
  execSync('pnpm exec prisma migrate deploy', {
    cwd: WORKSPACE_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  process.env[RUN_DATABASE_ENV] = url;

  const bucket = `ninno-test-${Date.now()}-${process.pid}`;
  const storage = storageAdmin(testStorageEnv(bucket));
  try {
    await createRunBucket(storage, bucket);
  } finally {
    storage.destroy();
  }
  process.env[RUN_BUCKET_ENV] = bucket;
}
