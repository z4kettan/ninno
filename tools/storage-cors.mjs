// Lets the web app upload to and view from the private bucket directly with signed URLs.
// Browsers need a CORS rule on the bucket for that; reads and writes still require a signature.
//
//   pnpm storage:cors            # uses WEB_ORIGINS and S3_* from the environment or .env
//
// Run once per bucket (local RustFS after `pnpm infra:up`, and the production bucket).
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const env = (key, fallback) => process.env[key] || fallback;
const origins = env('WEB_ORIGINS', '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const bucket = env('S3_BUCKET');
if (origins.length === 0 || !bucket) {
  console.error('WEB_ORIGINS and S3_BUCKET must be set.');
  process.exit(1);
}

const endpoint = env('S3_ENDPOINT');
const client = new S3Client({
  endpoint,
  region: env('S3_REGION', 'ap-south-1'),
  forcePathStyle: env('S3_FORCE_PATH_STYLE', String(Boolean(endpoint))) === 'true',
  credentials: {
    accessKeyId: env('S3_ACCESS_KEY_ID'),
    secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
  },
});

await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: origins,
          AllowedMethods: ['PUT', 'GET'],
          AllowedHeaders: ['content-type'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);
const { CORSRules } = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
console.log(`CORS on ${bucket}: ${JSON.stringify(CORSRules)}`);
client.destroy();
