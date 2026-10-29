import { testStorageEnv } from '../../../test/db/env';
import { testConfig } from '../../../test/test-config';
import { StorageService } from './storage.service';

/** Runs against the per-run bucket on the test storage (RustFS locally and in CI). */
describe('StorageService (real storage)', () => {
  const env = testStorageEnv();
  const storage = new StorageService(testConfig(env));
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2044, 7)]);

  afterAll(() => storage.onModuleDestroy());

  const put = (url: string, body: Buffer, contentType: string) =>
    fetch(url, {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: { 'Content-Type': contentType },
    });

  it('accepts an upload with exactly the signed type and size', async () => {
    const key = `pending/storage-test/ok-${Date.now()}.jpg`;
    const signed = await storage.signUpload(key, 'image/jpeg', jpeg.length, 600, new Date());

    const res = await put(signed.url, jpeg, signed.headers['Content-Type']);
    expect(res.status).toBe(200);
    expect(await storage.head(key)).toEqual({ size: jpeg.length, contentType: 'image/jpeg' });
    expect(Buffer.from(await storage.readHead(key, 4))).toEqual(jpeg.subarray(0, 4));
  });

  it('refuses a different content type', async () => {
    const key = `pending/storage-test/type-${Date.now()}.jpg`;
    const signed = await storage.signUpload(key, 'image/jpeg', jpeg.length, 600, new Date());

    const res = await put(signed.url, jpeg, 'text/html');
    expect(res.status).toBe(403);
    expect(await storage.head(key)).toBeNull();
  });

  it('refuses a different size', async () => {
    const key = `pending/storage-test/size-${Date.now()}.jpg`;
    const signed = await storage.signUpload(key, 'image/jpeg', jpeg.length, 600, new Date());

    const res = await put(signed.url, Buffer.concat([jpeg, Buffer.alloc(10)]), 'image/jpeg');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await storage.head(key)).toBeNull();
  });

  it('refuses an expired upload URL', async () => {
    const key = `pending/storage-test/late-${Date.now()}.jpg`;
    const signedAt = new Date(Date.now() - 11 * 60_000);
    const signed = await storage.signUpload(key, 'image/jpeg', jpeg.length, 600, signedAt);

    expect((await put(signed.url, jpeg, 'image/jpeg')).status).toBe(403);
  });

  it('denies anonymous reads and serves signed ones until they expire', async () => {
    const key = `residents/storage-test/selfie-${Date.now()}.jpg`;
    await storage.write(key, jpeg, 'image/jpeg');

    const anonymous = await fetch(`${env['S3_ENDPOINT']}/${env['S3_BUCKET']}/${key}`);
    expect(anonymous.status).toBe(403);

    const view = await storage.signView(key, 'image/jpeg', 300, new Date());
    const ok = await fetch(view.url);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await ok.arrayBuffer())).toEqual(jpeg);

    const stale = await storage.signView(key, 'image/jpeg', 300, new Date(Date.now() - 6 * 60_000));
    expect((await fetch(stale.url)).status).toBe(403);
  });

  it('lists objects older than a cutoff and removes them', async () => {
    const prefix = `pending/sweep-${Date.now()}/`;
    await storage.write(`${prefix}a.jpg`, jpeg, 'image/jpeg');
    await storage.write(`${prefix}b.jpg`, jpeg, 'image/jpeg');

    expect(await storage.listOlderThan(prefix, new Date(Date.now() - 60_000))).toEqual([]);
    const old = await storage.listOlderThan(prefix, new Date(Date.now() + 60_000));
    expect(old.sort()).toEqual([`${prefix}a.jpg`, `${prefix}b.jpg`]);

    await storage.remove(old);
    expect(await storage.head(`${prefix}a.jpg`)).toBeNull();
    expect(await storage.listOlderThan(prefix, new Date(Date.now() + 60_000))).toEqual([]);
  });
});
