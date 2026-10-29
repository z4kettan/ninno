import { DRAFT_TOKEN_HEADER } from '@ninno/contracts';
import { randomBytes } from 'node:crypto';
import { fixtures } from '../../../test/db/fixtures';
import { memberWith } from '../../../test/db/sign-in';
import { createTestApp, type TestApp } from '../../../test/db/test-app';
import { truncateAll } from '../../../test/db/test-prisma';
import { StorageService } from '../storage/storage.service';

let t: TestApp;
let make: ReturnType<typeof fixtures>;
let storage: StorageService;

beforeAll(async () => {
  t = await createTestApp();
  make = fixtures(t.prisma);
  storage = t.app.get(StorageService);
});
afterAll(() => t.app.close());
beforeEach(async () => {
  await truncateAll(t.prisma);
  t.sender.reset();
});

async function joinLink() {
  const org = await make.organization();
  const hostel = await make.hostel(org.id);
  const link = await t.prisma.onboardingLink.create({
    data: {
      organizationId: org.id,
      hostelId: hostel.id,
      token: randomBytes(24).toString('base64url'),
    },
  });
  return { org, hostel, token: link.token };
}

async function startDraft(token: string) {
  const res = await t.http.post(`/api/v1/onboarding/${token}/drafts`).expect(201);
  return res.body as { draftId: string; draftToken: string; expiresAt: string };
}

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4092, 1)]);

describe('drafts', () => {
  it('issues a draft token valid for 24 hours', async () => {
    const { token } = await joinLink();
    const draft = await startDraft(token);
    expect(draft.draftId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(draft.expiresAt).getTime() - t.clock.now().getTime()).toBeGreaterThan(
      23.9 * 3600_000,
    );
  });

  it('refuses to start a form through an invalid link', async () => {
    const res = await t.http.post('/api/v1/onboarding/no-such-token/drafts').expect(404);
    expect(res.body.code).toBe('LINK_INVALID');
  });

  it('can never be used as a session', async () => {
    const { token } = await joinLink();
    const { draftToken } = await startDraft(token);
    await t.http.get('/api/v1/auth/me').set('Authorization', `Bearer ${draftToken}`).expect(401);
  });
});

describe('upload URLs', () => {
  const requestUpload = (token: string, draftToken: string | undefined, body: object) => {
    const req = t.http.post(`/api/v1/onboarding/${token}/uploads`);
    if (draftToken) {
      req.set(DRAFT_TOKEN_HEADER, draftToken);
    }
    return req.send(body);
  };

  it('returns a signed URL that really uploads into the draft folder', async () => {
    const { token } = await joinLink();
    const { draftId, draftToken } = await startDraft(token);

    const res = await requestUpload(token, draftToken, {
      kind: 'selfie',
      contentType: 'image/jpeg',
      size: jpeg.length,
    }).expect(200);
    expect(res.body.key).toMatch(new RegExp(`^pending/${draftId}/selfie-[0-9a-f-]{36}\\.jpg$`));
    expect(new Date(res.body.expiresAt).getTime() - t.clock.now().getTime()).toBeLessThanOrEqual(
      600_000,
    );

    const put = await fetch(res.body.url as string, {
      method: 'PUT',
      body: new Uint8Array(jpeg),
      headers: res.body.headers as Record<string, string>,
    });
    expect(put.status).toBe(200);
    expect(await storage.head(res.body.key as string)).toMatchObject({ size: jpeg.length });
  });

  it('refuses files over 5 MB', async () => {
    const { token } = await joinLink();
    const { draftToken } = await startDraft(token);
    const res = await requestUpload(token, draftToken, {
      kind: 'id-front',
      contentType: 'image/jpeg',
      size: 6 * 1024 * 1024,
    }).expect(400);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  it('allows PDFs for IDs but not for the selfie', async () => {
    const { token } = await joinLink();
    const { draftToken } = await startDraft(token);
    await requestUpload(token, draftToken, {
      kind: 'id-back',
      contentType: 'application/pdf',
      size: 1000,
    }).expect(200);
    const res = await requestUpload(token, draftToken, {
      kind: 'selfie',
      contentType: 'application/pdf',
      size: 1000,
    }).expect(400);
    expect(res.body.code).toBe('FILE_INVALID');
  });

  it('validates the request', async () => {
    const { token } = await joinLink();
    const { draftToken } = await startDraft(token);
    const res = await requestUpload(token, draftToken, {
      kind: 'passport-scan',
      contentType: 'image/gif',
      size: 0,
    }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'contentType',
      'kind',
      'size',
    ]);
  });

  it('needs the draft token of the same hostel', async () => {
    const a = await joinLink();
    const b = await joinLink();
    const draftOfA = await startDraft(a.token);
    const body = { kind: 'selfie', contentType: 'image/jpeg', size: 1000 };

    await requestUpload(a.token, undefined, body).expect(401);
    await requestUpload(a.token, 'not-a-token', body).expect(401);
    const wrongHostel = await requestUpload(b.token, draftOfA.draftToken, body).expect(401);
    expect(wrongHostel.body.code).toBe('UNAUTHORIZED');
  });

  it('refuses a session token in place of a draft token', async () => {
    const { org, token } = await joinLink();
    const owner = await memberWith(t, make, [{ organizationId: org.id, role: 'OWNER' }]);
    await requestUpload(token, owner.auth.replace('Bearer ', ''), {
      kind: 'selfie',
      contentType: 'image/jpeg',
      size: 1000,
    }).expect(401);
  });

  it('refuses an expired draft token', async () => {
    const { token } = await joinLink();
    const { draftToken } = await startDraft(token);
    const body = { kind: 'selfie', contentType: 'image/jpeg', size: 1000 };

    t.clock.advance(23 * 3600_000);
    await requestUpload(token, draftToken, body).expect(200);
    t.clock.advance(3600_000 + 1000);
    const res = await requestUpload(token, draftToken, body).expect(401);
    expect(res.body.message).toMatch(/expired/);
  });

  it('stops working once the link is rotated away', async () => {
    const { hostel, token } = await joinLink();
    const { draftToken } = await startDraft(token);
    await t.prisma.onboardingLink.updateMany({
      where: { hostelId: hostel.id },
      data: { isActive: false },
    });
    const res = await requestUpload(token, draftToken, {
      kind: 'selfie',
      contentType: 'image/jpeg',
      size: 1000,
    }).expect(404);
    expect(res.body.code).toBe('LINK_INVALID');
  });
});
