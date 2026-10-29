import { fixtures } from '../../../test/db/fixtures';
import { memberWith, type SignedInUser, signIn } from '../../../test/db/sign-in';
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

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

/** A hostel with two vacant beds in room 101 (₹6,500 per bed) and its team, signed in. */
async function hostelWithTeam(hostelOverrides: Record<string, unknown> = {}) {
  const org = await make.organization();
  const hostel = await make.hostel(org.id, {
    name: 'Kayal House',
    defaultSecurityDepositPaise: 500000n,
    ...hostelOverrides,
  });
  const room = await make.room(hostel, { number: '101', monthlyRentPaise: 650000n });
  const bedA = await make.bed(room, 'A');
  const bedB = await make.bed(room, 'B');
  const owner = await memberWith(t, make, [{ organizationId: org.id, role: 'OWNER' }]);
  const manager = await memberWith(t, make, [
    { organizationId: org.id, hostelId: hostel.id, role: 'MANAGER' },
  ]);
  const staff = await memberWith(t, make, [
    { organizationId: org.id, hostelId: hostel.id, role: 'STAFF' },
  ]);
  return { org, hostel, room, bedA, bedB, owner, manager, staff };
}

/** A pending application with its selfie and ID front stored. */
async function applicant(
  hostel: { id: string; organizationId: string },
  overrides: Record<string, unknown> = {},
) {
  const resident = await make.resident(hostel, overrides);
  const photoKey = `residents/${resident.id}/selfie-test.jpg`;
  const frontKey = `residents/${resident.id}/id-front-test.jpg`;
  await storage.write(photoKey, jpeg, 'image/jpeg');
  await storage.write(frontKey, jpeg, 'image/jpeg');
  await t.prisma.resident.update({ where: { id: resident.id }, data: { photoKey } });
  await t.prisma.identityDocument.create({
    data: {
      organizationId: hostel.organizationId,
      residentId: resident.id,
      type: 'PAN',
      numberMasked: 'XXXXXX234F',
      frontKey,
    },
  });
  return resident;
}

const get = (path: string, who: SignedInUser) =>
  t.http.get(`/api/v1${path}`).set('Authorization', who.auth);
const post = (path: string, who: SignedInUser, body: object = {}) =>
  t.http.post(`/api/v1${path}`).set('Authorization', who.auth).send(body);

const approval = (bedId: string) => ({
  bedId,
  checkInDate: '2026-03-10',
  monthlyRentPaise: '650000',
  securityDepositPaise: '500000',
});

describe('approvals queue', () => {
  it('lists pending applications oldest first, with a count', async () => {
    const { hostel, staff } = await hostelWithTeam();
    const older = await applicant(hostel, {
      fullName: 'Older',
      createdAt: new Date('2026-03-01T10:00:00Z'),
    });
    const newer = await applicant(hostel, {
      fullName: 'Newer',
      createdAt: new Date('2026-03-02T10:00:00Z'),
    });
    await applicant(hostel, { status: 'REJECTED' });

    const list = await get('/approvals', staff).expect(200);
    expect(list.body.items.map((i: { residentId: string }) => i.residentId)).toEqual([
      older.id,
      newer.id,
    ]);
    expect(list.body.items[0]).toMatchObject({
      fullName: 'Older',
      hostelName: 'Kayal House',
      phoneMasked: expect.stringMatching(/^\+91 •+\d{4}$/),
      occupationType: 'STUDENT',
      submittedAt: '2026-03-01T10:00:00.000Z',
    });
    expect((await get('/approvals/count', staff).expect(200)).body).toEqual({ count: 2 });
  });

  it('says there is nothing to review when the queue is empty', async () => {
    const { owner } = await hostelWithTeam();
    expect((await get('/approvals', owner).expect(200)).body).toEqual({ items: [] });
    expect((await get('/approvals/count', owner).expect(200)).body).toEqual({ count: 0 });
  });

  it('shows only applications the caller has access to', async () => {
    const { org, hostel, owner, manager } = await hostelWithTeam();
    const secondHostel = await make.hostel(org.id, { name: 'Second House' });
    await applicant(hostel);
    await applicant(secondHostel);
    const stranger = await hostelWithTeam();
    await applicant(stranger.hostel);

    expect((await get('/approvals/count', manager)).body).toEqual({ count: 1 });
    expect((await get('/approvals/count', stranger.owner)).body).toEqual({ count: 1 });
    expect((await get('/approvals/count', owner)).body).toEqual({ count: 2 });
  });

  it('is not for residents', async () => {
    const { org, hostel } = await hostelWithTeam();
    const resident = await memberWith(t, make, [
      { organizationId: org.id, hostelId: hostel.id, role: 'RESIDENT' },
    ]);
    const res = await get('/approvals', resident).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});

describe('application detail', () => {
  it('shows the application, the vacant beds with their rent and the default deposit', async () => {
    const { hostel, bedA, bedB, staff } = await hostelWithTeam();
    const a = await applicant(hostel);

    const res = await get(`/approvals/${a.id}`, staff).expect(200);
    expect(res.body).toMatchObject({
      residentId: a.id,
      status: 'PENDING_REVIEW',
      fullName: 'Test Resident',
      phone: a.phone,
      idDocument: { type: 'PAN', numberMasked: 'XXXXXX234F', hasBack: false },
      defaultSecurityDepositPaise: '500000',
      billingMode: 'CHECKIN_ANNIVERSARY',
      fixedDueDay: null,
    });
    expect(res.body.vacantBeds).toEqual([
      expect.objectContaining({
        bedId: bedA.id,
        label: 'A',
        roomNumber: '101',
        monthlyRentPaise: '650000',
      }),
      expect.objectContaining({
        bedId: bedB.id,
        label: 'B',
        roomNumber: '101',
        monthlyRentPaise: '650000',
      }),
    ]);
  });

  it("is not found for another organisation's staff", async () => {
    const { hostel } = await hostelWithTeam();
    const a = await applicant(hostel);
    const stranger = await hostelWithTeam();
    const res = await get(`/approvals/${a.id}`, stranger.owner).expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('viewing the selfie and ID', () => {
  it('gives a link of at most 5 minutes and records who viewed which file', async () => {
    const { hostel, staff } = await hostelWithTeam();
    const a = await applicant(hostel);

    for (const file of ['selfie', 'id-front'] as const) {
      const res = await get(`/residents/${a.id}/files/${file}`, staff).expect(200);
      expect(res.body.contentType).toBe('image/jpeg');
      const ttl = new Date(res.body.expiresAt).getTime() - t.clock.now().getTime();
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300_000);
      expect(new URL(res.body.url as string).searchParams.get('X-Amz-Expires')).toBe('300');
      const image = await fetch(res.body.url as string);
      expect(image.status).toBe(200);
      expect(Buffer.from(await image.arrayBuffer())).toEqual(jpeg);
    }

    const audit = await t.prisma.auditLog.findMany({
      where: { entityId: a.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(
      audit.map((e) => [e.action, e.actorUserId, (e.metadata as { file: string }).file]),
    ).toEqual([
      ['photo.viewed', staff.id, 'selfie'],
      ['document.viewed', staff.id, 'id-front'],
    ]);
  });

  it('is not found for a missing file or another organisation', async () => {
    const { hostel, staff } = await hostelWithTeam();
    const a = await applicant(hostel);
    await get(`/residents/${a.id}/files/id-back`, staff).expect(404);
    await get(`/residents/${a.id}/files/passport`, staff).expect(400);

    const stranger = await hostelWithTeam();
    const res = await get(`/residents/${a.id}/files/id-front`, stranger.owner).expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(await t.prisma.auditLog.count({ where: { action: 'document.viewed' } })).toBe(0);
  });
});

describe('approving', () => {
  it('makes the resident active in the bed, with a rent plan from check-in', async () => {
    const { hostel, bedA, manager } = await hostelWithTeam();
    const a = await applicant(hostel);

    const res = await post(`/approvals/${a.id}/approve`, manager, approval(bedA.id)).expect(200);
    expect(res.body).toEqual({ residentId: a.id, status: 'ACTIVE' });

    const resident = await t.prisma.resident.findUniqueOrThrow({
      where: { id: a.id },
      include: { rentPlans: true, identityDocuments: true, bed: true },
    });
    expect(resident).toMatchObject({
      status: 'ACTIVE',
      bedId: bedA.id,
      checkInDate: new Date('2026-03-10'),
      approvedById: manager.id,
    });
    expect(resident.bed?.status).toBe('OCCUPIED');
    expect(resident.rentPlans).toEqual([
      expect.objectContaining({
        monthlyRentPaise: 650000n,
        securityDepositPaise: 500000n,
        billingAnchorDay: 10,
        effectiveFrom: new Date('2026-03-10'),
        createdById: manager.id,
      }),
    ]);
    expect(resident.identityDocuments[0]).toMatchObject({
      verificationStatus: 'VERIFIED',
      verifiedById: manager.id,
    });
    expect(await t.prisma.auditLog.count({ where: { action: 'resident.approved' } })).toBe(1);
    expect((await get('/approvals/count', manager)).body).toEqual({ count: 0 });

    // The resident now sees their room and bed.
    const user = await t.prisma.user.findUniqueOrThrow({ where: { id: a.userId } });
    const me = await get('/residents/me', await signIn(t, user)).expect(200);
    expect(me.body.applications[0]).toMatchObject({
      status: 'ACTIVE',
      roomNumber: '101',
      bedLabel: 'A',
      checkInDate: '2026-03-10',
    });
  });

  it("uses the hostel's fixed due day when it bills on a fixed day", async () => {
    const { hostel, bedA, owner } = await hostelWithTeam({
      billingMode: 'FIXED_DAY',
      fixedDueDay: 5,
    });
    const a = await applicant(hostel);
    await post(`/approvals/${a.id}/approve`, owner, approval(bedA.id)).expect(200);
    const plan = await t.prisma.rentPlan.findFirstOrThrow();
    expect(plan.billingAnchorDay).toBe(5);
  });

  it('keeps a 31st check-in as day 31', async () => {
    const { hostel, bedA, owner } = await hostelWithTeam();
    const a = await applicant(hostel);
    await post(`/approvals/${a.id}/approve`, owner, {
      ...approval(bedA.id),
      checkInDate: '2026-01-31',
    }).expect(200);
    expect((await t.prisma.rentPlan.findFirstOrThrow()).billingAnchorDay).toBe(31);
  });

  it('is not allowed for staff', async () => {
    const { hostel, bedA, staff } = await hostelWithTeam();
    const a = await applicant(hostel);
    const res = await post(`/approvals/${a.id}/approve`, staff, approval(bedA.id)).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
    await post(`/approvals/${a.id}/reject`, staff, { reason: 'Blurry photo' }).expect(403);
  });

  it('fails with BED_UNAVAILABLE and changes nothing when the bed was taken meanwhile', async () => {
    const { hostel, bedA, manager } = await hostelWithTeam();
    const a = await applicant(hostel);
    await t.prisma.bed.update({ where: { id: bedA.id }, data: { status: 'OCCUPIED' } });

    const res = await post(`/approvals/${a.id}/approve`, manager, approval(bedA.id)).expect(409);
    expect(res.body.code).toBe('BED_UNAVAILABLE');
    expect((await t.prisma.resident.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(
      'PENDING_REVIEW',
    );
    expect(await t.prisma.rentPlan.count()).toBe(0);
  });

  it('refuses a bed from another hostel', async () => {
    const { hostel, manager } = await hostelWithTeam();
    const a = await applicant(hostel);
    const elsewhere = await hostelWithTeam();
    const res = await post(
      `/approvals/${a.id}/approve`,
      manager,
      approval(elsewhere.bedA.id),
    ).expect(409);
    expect(res.body.code).toBe('BED_UNAVAILABLE');
    expect(
      (await t.prisma.bed.findUniqueOrThrow({ where: { id: elsewhere.bedA.id } })).status,
    ).toBe('VACANT');
  });

  it('lets only one of two simultaneous approvals win', async () => {
    const { hostel, bedA, bedB, owner, manager } = await hostelWithTeam();
    const a = await applicant(hostel);

    const [first, second] = await Promise.all([
      post(`/approvals/${a.id}/approve`, owner, approval(bedA.id)),
      post(`/approvals/${a.id}/approve`, manager, approval(bedB.id)),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body.code).toBe('NOT_PENDING');
    expect(await t.prisma.bed.count({ where: { status: 'OCCUPIED' } })).toBe(1);
    expect(await t.prisma.rentPlan.count()).toBe(1);
  });

  it('answers NOT_PENDING when the same bed is chosen twice at once', async () => {
    const { hostel, bedA, owner, manager } = await hostelWithTeam();
    const a = await applicant(hostel);
    const results = await Promise.all([
      post(`/approvals/${a.id}/approve`, owner, approval(bedA.id)),
      post(`/approvals/${a.id}/approve`, manager, approval(bedA.id)),
    ]);
    expect(results.map((r) => r.body.code ?? r.body.status).sort()).toEqual(
      ['ACTIVE', 'NOT_PENDING'].sort(),
    );
  });

  it('validates the amounts and date', async () => {
    const { hostel, bedA, manager } = await hostelWithTeam();
    const a = await applicant(hostel);
    const res = await post(`/approvals/${a.id}/approve`, manager, {
      bedId: bedA.id,
      checkInDate: '2026-02-30',
      monthlyRentPaise: '6500.50',
      securityDepositPaise: -1,
    }).expect(400);
    expect(res.body.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'checkInDate',
      'monthlyRentPaise',
      'securityDepositPaise',
    ]);
  });
});

describe('rejecting', () => {
  it('rejects with a reason the applicant will see', async () => {
    const { hostel, manager } = await hostelWithTeam();
    const a = await applicant(hostel);

    await post(`/approvals/${a.id}/reject`, manager, {
      reason: '  ID photo is blurry, please retake it ',
    }).expect(200);
    const resident = await t.prisma.resident.findUniqueOrThrow({
      where: { id: a.id },
      include: { identityDocuments: true },
    });
    expect(resident).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'ID photo is blurry, please retake it',
      bedId: null,
    });
    expect(resident.identityDocuments[0].verificationStatus).toBe('REJECTED');
    expect((await get('/approvals', manager)).body).toEqual({ items: [] });
    expect(await t.prisma.auditLog.count({ where: { action: 'resident.rejected' } })).toBe(1);
  });

  it('needs a reason of 5 to 300 characters', async () => {
    const { hostel, manager } = await hostelWithTeam();
    const a = await applicant(hostel);
    for (const reason of ['no', 'x'.repeat(301), '    ok   ']) {
      const res = await post(`/approvals/${a.id}/reject`, manager, { reason }).expect(400);
      expect(res.body.details[0].field).toBe('reason');
    }
  });

  it('cannot decide an application twice', async () => {
    const { hostel, bedA, manager } = await hostelWithTeam();
    const a = await applicant(hostel);
    await post(`/approvals/${a.id}/reject`, manager, { reason: 'Blurry photo' }).expect(200);

    const again = await post(`/approvals/${a.id}/approve`, manager, approval(bedA.id)).expect(409);
    expect(again.body.code).toBe('NOT_PENDING');
    await post(`/approvals/${a.id}/reject`, manager, { reason: 'Blurry photo' }).expect(409);
  });
});
