import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { InjectConfig } from '../../config/config.module';
import type { AppConfig } from '../../config/env.schema';

export interface ObjectInfo {
  size: number;
  contentType: string | undefined;
}

export interface SignedUrl {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

/** The private bucket. Nothing in it is public; phones only ever see short-lived signed URLs. */
@Injectable()
export class StorageService implements OnModuleDestroy {
  /** Talks to storage from the API host. */
  private readonly client: S3Client;
  /** Signs URLs with the host phones use, which may differ inside Docker. */
  private readonly signer: S3Client;
  readonly bucket: string;

  constructor(@InjectConfig() config: AppConfig) {
    const { storage } = config;
    const base: S3ClientConfig = {
      region: storage.region,
      forcePathStyle: storage.forcePathStyle,
      credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
      // No checksum headers the browser would have to reproduce on a presigned PUT.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    };
    this.client = new S3Client({ ...base, endpoint: storage.endpoint });
    this.signer = new S3Client({ ...base, endpoint: storage.publicEndpoint });
    this.bucket = storage.bucket;
  }

  /** A PUT URL that only accepts exactly this content type and size. */
  async signUpload(
    key: string,
    contentType: string,
    size: number,
    ttlSeconds: number,
    now: Date,
  ): Promise<SignedUrl> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });
    const url = await getSignedUrl(this.signer, command, {
      expiresIn: ttlSeconds,
      signableHeaders: new Set(['content-type', 'content-length']),
      signingDate: now,
    });
    return {
      url,
      // Browsers set Content-Length themselves from the body.
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
    };
  }

  /** A GET URL for viewing a file in the browser. */
  async signView(
    key: string,
    contentType: string,
    ttlSeconds: number,
    now: Date,
  ): Promise<SignedUrl> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: 'inline',
      ResponseContentType: contentType,
      ResponseCacheControl: 'private, no-store',
    });
    const url = await getSignedUrl(this.signer, command, {
      expiresIn: ttlSeconds,
      signingDate: now,
    });
    return { url, headers: {}, expiresAt: new Date(now.getTime() + ttlSeconds * 1000) };
  }

  /** Size and type of an object, or null when it does not exist. */
  async head(key: string): Promise<ObjectInfo | null> {
    try {
      const out = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: out.ContentLength ?? 0, contentType: out.ContentType };
    } catch (error) {
      if (error instanceof NotFound || httpStatus(error) === 404) {
        return null;
      }
      throw error;
    }
  }

  /** The first `length` bytes of an object (fewer if it is shorter). */
  async readHead(key: string, length: number): Promise<Uint8Array> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${length - 1}` }),
    );
    return out.Body ? out.Body.transformToByteArray() : new Uint8Array();
  }

  async read(key: string): Promise<Buffer> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(out.Body ? await out.Body.transformToByteArray() : []);
  }

  async write(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  /** Deletes keys in batches of 1000 (the S3 limit). Missing keys are not an error. */
  async remove(keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      const out = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      // Per-key failures come back inside a 200 response; surface them.
      const failed = (out.Errors ?? []).filter((e) => e.Code !== 'NoSuchKey');
      if (failed.length > 0) {
        throw new Error(
          `could not delete ${failed.length} object(s): ${failed[0].Code ?? 'unknown'}`,
        );
      }
    }
  }

  /** Keys under `prefix` last modified before `cutoff`. */
  async listOlderThan(prefix: string, cutoff: Date): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const out = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const object of out.Contents ?? []) {
        if (object.Key && object.LastModified && object.LastModified < cutoff) {
          keys.push(object.Key);
        }
      }
      token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }

  onModuleDestroy(): void {
    this.client.destroy();
    this.signer.destroy();
  }
}

function httpStatus(error: unknown): number | undefined {
  return (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}
