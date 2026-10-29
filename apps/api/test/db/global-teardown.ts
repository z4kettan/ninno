import { Client } from 'pg';
import {
  databaseName,
  RUN_BUCKET_ENV,
  RUN_DATABASE_ENV,
  RUN_DATABASE_PATTERN,
  testAdminUrl,
  testStorageEnv,
} from './env';
import { dropRunBucket, storageAdmin } from './test-storage';

/** Drops only the throwaway database and bucket this run created. */
export default async function globalTeardown(): Promise<void> {
  const bucket = process.env[RUN_BUCKET_ENV];
  if (bucket) {
    const storage = storageAdmin(testStorageEnv(bucket));
    try {
      await dropRunBucket(storage, bucket);
    } finally {
      storage.destroy();
    }
  }

  const url = process.env[RUN_DATABASE_ENV];
  if (!url) {
    return;
  }
  const name = databaseName(url);
  if (!RUN_DATABASE_PATTERN.test(name)) {
    throw new Error(`Refusing to drop "${name}": not a per-run test database.`);
  }
  const admin = new Client({ connectionString: testAdminUrl() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  } finally {
    await admin.end();
  }
}
