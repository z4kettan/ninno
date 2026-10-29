import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { RUN_BUCKET_PATTERN } from './env';

/** An admin client for the test storage described by {@link testStorageEnv}. */
export function storageAdmin(env: Record<string, string>): S3Client {
  return new S3Client({
    endpoint: env['S3_ENDPOINT'],
    region: env['S3_REGION'],
    forcePathStyle: true,
    credentials: {
      accessKeyId: env['S3_ACCESS_KEY_ID'],
      secretAccessKey: env['S3_SECRET_ACCESS_KEY'],
    },
  });
}

export async function createRunBucket(client: S3Client, bucket: string): Promise<void> {
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
}

/** Empties and deletes this run's bucket. Refuses any bucket a test run did not create. */
export async function dropRunBucket(client: S3Client, bucket: string): Promise<void> {
  if (!RUN_BUCKET_PATTERN.test(bucket)) {
    throw new Error(`Refusing to delete bucket "${bucket}": not a per-run test bucket.`);
  }
  await emptyBucket(client, bucket);
  await client.send(new DeleteBucketCommand({ Bucket: bucket }));
}

export async function emptyBucket(client: S3Client, bucket: string): Promise<void> {
  if (!RUN_BUCKET_PATTERN.test(bucket)) {
    throw new Error(`Refusing to empty bucket "${bucket}": not a per-run test bucket.`);
  }
  let token: string | undefined;
  do {
    const out = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );
    const keys = (out.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (keys.length > 0) {
      await client.send(
        new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }),
      );
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
}
