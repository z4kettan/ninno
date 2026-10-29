import { SchedulerRegistry } from '@nestjs/schedule';
import { createTestApp, type TestApp } from '../../../test/db/test-app';
import { StorageService } from '../storage/storage.service';
import { PENDING_MAX_AGE_MS, PendingSweepService } from './pending-sweep.service';

let t: TestApp;
let storage: StorageService;
let sweeper: PendingSweepService;

beforeAll(async () => {
  t = await createTestApp();
  storage = t.app.get(StorageService);
  sweeper = t.app.get(PendingSweepService);
});
afterAll(() => t.app.close());

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const body = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

describe('pending uploads sweep', () => {
  it('deletes abandoned uploads older than 24 hours and keeps newer ones', async () => {
    const run = Date.now();
    const old = `pending/sweep-${run}-old/selfie.jpg`;
    const fresh = `pending/sweep-${run}-new/selfie.jpg`;
    const filed = `residents/sweep-${run}/selfie.jpg`;

    await storage.write(old, body, 'image/jpeg');
    await storage.write(filed, body, 'image/jpeg');
    await sleep(700);
    const between = Date.now();
    // Storage keeps whole seconds; this gap keeps the fresh file after `between`.
    await sleep(1100);
    await storage.write(fresh, body, 'image/jpeg');

    // "Now" is 24 hours after the moment between the two uploads.
    const clock = t.clock;
    clock.advance(between + PENDING_MAX_AGE_MS - clock.now().getTime());

    expect(await sweeper.sweep()).toBeGreaterThanOrEqual(1);
    expect(await storage.head(old)).toBeNull();
    expect(await storage.head(fresh)).not.toBeNull();
    expect(await storage.head(filed)).not.toBeNull();
  });

  it('runs every day at 03:30 India time', () => {
    const job = t.app.get(SchedulerRegistry).getCronJob('pending-uploads-sweep');
    const next = job.nextDate().setZone('Asia/Kolkata');
    expect([next.hour, next.minute]).toEqual([3, 30]);
  });
});
