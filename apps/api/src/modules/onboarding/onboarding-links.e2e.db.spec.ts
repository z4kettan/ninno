import { fixtures } from '../../../test/db/fixtures';
import { memberWith } from '../../../test/db/sign-in';
import { createTestApp, type TestApp } from '../../../test/db/test-app';
import { truncateAll } from '../../../test/db/test-prisma';

let t: TestApp;
let make: ReturnType<typeof fixtures>;

beforeAll(async () => {
  t = await createTestApp({ env: { APP_URL: 'https://app.ninno.test' } });
  make = fixtures(t.prisma);
});
afterAll(() => t.app.close());
beforeEach(async () => {
  await truncateAll(t.prisma);
  t.sender.reset();
});

async function hostelWithOwner() {
  const org = await make.organization();
  const hostel = await make.hostel(org.id, {
    name: 'Kayal House',
    amenities: ['wifi', 'food'],
    rulesText: 'Gate closes at 10 pm.',
    upiVpa: 'kayal@upi',
  });
  const owner = await memberWith(t, make, [{ organizationId: org.id, role: 'OWNER' }]);
  return { org, hostel, owner };
}

const linkPath = (hostelId: string) => `/api/v1/hostels/${hostelId}/onboarding-link`;

describe('onboarding links', () => {
  it('creates the active link on the first visit and returns the same one afterwards', async () => {
    const { hostel, owner } = await hostelWithOwner();

    const first = await t.http
      .get(linkPath(hostel.id))
      .set('Authorization', owner.auth)
      .expect(200);
    expect(first.body).toMatchObject({
      hostelId: hostel.id,
      hostelName: 'Kayal House',
      maxUses: null,
      expiresAt: null,
      useCount: 0,
    });
    expect(first.body.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(first.body.url).toBe(`https://app.ninno.test/join/${first.body.token as string}`);

    const again = await t.http
      .get(linkPath(hostel.id))
      .set('Authorization', owner.auth)
      .expect(200);
    expect(again.body.token).toBe(first.body.token);
    expect(await t.prisma.onboardingLink.count()).toBe(1);
    expect(await t.prisma.auditLog.count({ where: { action: 'onboarding_link.created' } })).toBe(1);
  });

  it('never leaves two active links when the screen is opened concurrently', async () => {
    const { hostel, owner } = await hostelWithOwner();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        t.http.get(linkPath(hostel.id)).set('Authorization', owner.auth),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(responses.map((r) => r.body.token as string)).size).toBe(1);
    expect(await t.prisma.onboardingLink.count({ where: { isActive: true } })).toBe(1);
  });

  it('rotating kills the old token and issues a new one', async () => {
    const { hostel, owner } = await hostelWithOwner();
    const old = await t.http.get(linkPath(hostel.id)).set('Authorization', owner.auth).expect(200);

    const rotated = await t.http
      .post(`${linkPath(hostel.id)}/rotate`)
      .set('Authorization', owner.auth)
      .expect(200);
    expect(rotated.body.token).not.toBe(old.body.token);

    const gone = await t.http.get(`/api/v1/onboarding/${old.body.token as string}`).expect(404);
    expect(gone.body.code).toBe('LINK_INVALID');
    await t.http.get(`/api/v1/onboarding/${rotated.body.token as string}`).expect(200);

    const current = await t.http.get(linkPath(hostel.id)).set('Authorization', owner.auth);
    expect(current.body.token).toBe(rotated.body.token);
    expect(await t.prisma.onboardingLink.count({ where: { isActive: true } })).toBe(1);
    expect(await t.prisma.auditLog.count({ where: { action: 'onboarding_link.rotated' } })).toBe(1);
  });

  it('lets managers manage the link, but not staff', async () => {
    const { org, hostel } = await hostelWithOwner();
    const manager = await memberWith(t, make, [
      { organizationId: org.id, hostelId: hostel.id, role: 'MANAGER' },
    ]);
    const staff = await memberWith(t, make, [
      { organizationId: org.id, hostelId: hostel.id, role: 'STAFF' },
    ]);

    await t.http
      .post(`${linkPath(hostel.id)}/rotate`)
      .set('Authorization', manager.auth)
      .expect(200);
    const denied = await t.http
      .post(`${linkPath(hostel.id)}/rotate`)
      .set('Authorization', staff.auth)
      .expect(403);
    expect(denied.body.code).toBe('FORBIDDEN');
    await t.http.get(linkPath(hostel.id)).set('Authorization', staff.auth).expect(403);
  });

  it('hides links of other organisations and of hostels outside a manager’s scope', async () => {
    const { org, hostel } = await hostelWithOwner();
    const otherHostel = await make.hostel(org.id, { name: 'Second House' });
    const managerOfOther = await memberWith(t, make, [
      { organizationId: org.id, hostelId: otherHostel.id, role: 'MANAGER' },
    ]);
    const stranger = await hostelWithOwner();

    for (const auth of [managerOfOther.auth, stranger.owner.auth]) {
      const res = await t.http.get(linkPath(hostel.id)).set('Authorization', auth).expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
      await t.http
        .post(`${linkPath(hostel.id)}/rotate`)
        .set('Authorization', auth)
        .expect(404);
    }
    expect(await t.prisma.onboardingLink.count()).toBe(0);
  });

  it('requires sign-in', async () => {
    const { hostel } = await hostelWithOwner();
    await t.http.get(linkPath(hostel.id)).expect(401);
  });
});

describe('opening a join link', () => {
  it('shows only the hostel’s public details', async () => {
    const { hostel, owner } = await hostelWithOwner();
    const link = await t.http.get(linkPath(hostel.id)).set('Authorization', owner.auth);

    const res = await t.http.get(`/api/v1/onboarding/${link.body.token as string}`).expect(200);
    expect(res.body).toEqual({
      name: 'Kayal House',
      addressLine1: '1 Test Road',
      addressLine2: null,
      city: 'Kochi',
      state: 'Kerala',
      pincode: '682030',
      genderPolicy: 'MALE',
      amenities: ['wifi', 'food'],
      rulesText: 'Gate closes at 10 pm.',
    });
  });

  it('answers every unusable link identically', async () => {
    const { org, hostel, owner } = await hostelWithOwner();
    const first = await t.http.get(linkPath(hostel.id)).set('Authorization', owner.auth);
    const rotatedAway = first.body.token as string;
    await t.http.post(`${linkPath(hostel.id)}/rotate`).set('Authorization', owner.auth);

    const base = { organizationId: org.id, hostelId: hostel.id, isActive: false };
    const expired = await t.prisma.onboardingLink.create({
      data: {
        ...base,
        token: 'expired-token-000000000000000000',
        isActive: true,
        expiresAt: new Date(t.clock.now().getTime() - 1000),
      },
    });
    const usedUp = await t.prisma.onboardingLink.create({
      data: {
        ...base,
        token: 'used-up-token-000000000000000000',
        isActive: true,
        maxUses: 1,
        useCount: 1,
      },
    });
    const closedHostel = await make.hostel(org.id, { deletedAt: new Date() });
    const ofClosedHostel = await t.prisma.onboardingLink.create({
      data: {
        organizationId: org.id,
        hostelId: closedHostel.id,
        token: 'closed-hostel-token-000000000000',
      },
    });

    const tokens = [
      'unknown-token-000000000000000000',
      rotatedAway,
      expired.token,
      usedUp.token,
      ofClosedHostel.token,
    ];
    const bodies: Record<string, unknown>[] = [];
    for (const token of tokens) {
      const res = await t.http.get(`/api/v1/onboarding/${token}`).expect(404);
      const { requestId: _id, ...body } = res.body as Record<string, unknown>;
      bodies.push(body);
    }
    expect(bodies[0]).toMatchObject({ code: 'LINK_INVALID' });
    for (const body of bodies) {
      expect(body).toEqual(bodies[0]);
    }
  });
});

describe('hostel list', () => {
  it('lists the hostels in the caller’s scope', async () => {
    const { org, hostel, owner } = await hostelWithOwner();
    const second = await make.hostel(org.id, { name: 'Another House' });
    await hostelWithOwner(); // another organisation's hostel

    const all = await t.http.get('/api/v1/hostels').set('Authorization', owner.auth).expect(200);
    expect(all.body).toEqual([
      { id: second.id, name: 'Another House', city: 'Kochi' },
      { id: hostel.id, name: 'Kayal House', city: 'Kochi' },
    ]);

    const manager = await memberWith(t, make, [
      { organizationId: org.id, hostelId: hostel.id, role: 'MANAGER' },
    ]);
    const scoped = await t.http.get('/api/v1/hostels').set('Authorization', manager.auth);
    expect(scoped.body).toEqual([{ id: hostel.id, name: 'Kayal House', city: 'Kochi' }]);
  });
});
