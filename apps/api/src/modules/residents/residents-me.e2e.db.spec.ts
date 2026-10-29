import { fixtures } from '../../../test/db/fixtures';
import { signIn } from '../../../test/db/sign-in';
import { createTestApp, type TestApp } from '../../../test/db/test-app';
import { truncateAll } from '../../../test/db/test-prisma';

let t: TestApp;
let make: ReturnType<typeof fixtures>;

beforeAll(async () => {
  t = await createTestApp();
  make = fixtures(t.prisma);
});
afterAll(() => t.app.close());
beforeEach(async () => {
  await truncateAll(t.prisma);
  t.sender.reset();
});

/** A resident user with a RESIDENT membership, signed in. */
async function residentAt(hostel: { id: string; organizationId: string }) {
  const application = await make.resident(hostel);
  await t.prisma.membership.create({
    data: {
      userId: application.userId,
      organizationId: hostel.organizationId,
      hostelId: hostel.id,
      role: 'RESIDENT',
    },
  });
  const user = await t.prisma.user.findUniqueOrThrow({ where: { id: application.userId } });
  return { application, session: await signIn(t, user) };
}

const me = (auth: string) =>
  t.http.get('/api/v1/residents/me').set('Authorization', auth).expect(200);

describe('GET /residents/me', () => {
  it('shows a pending application as waiting', async () => {
    const org = await make.organization();
    const hostel = await make.hostel(org.id, { name: 'Kayal House' });
    const { application, session } = await residentAt(hostel);

    const res = await me(session.auth);
    expect(res.body).toEqual({
      applications: [
        {
          residentId: application.id,
          hostelId: hostel.id,
          hostelName: 'Kayal House',
          status: 'PENDING_REVIEW',
          submittedAt: application.createdAt.toISOString(),
          rejectionReason: null,
          roomNumber: null,
          bedLabel: null,
          checkInDate: null,
        },
      ],
    });
  });

  it('shows the reason for a rejection', async () => {
    const org = await make.organization();
    const hostel = await make.hostel(org.id);
    const { application, session } = await residentAt(hostel);
    await t.prisma.resident.update({
      where: { id: application.id },
      data: { status: 'REJECTED', rejectionReason: 'ID photo is blurry' },
    });

    const [app] = (await me(session.auth)).body.applications;
    expect(app).toMatchObject({ status: 'REJECTED', rejectionReason: 'ID photo is blurry' });
  });

  it('shows room and bed once active', async () => {
    const org = await make.organization();
    const hostel = await make.hostel(org.id);
    const room = await make.room(hostel, { number: '204' });
    const bed = await make.bed(room, 'B');
    const { application, session } = await residentAt(hostel);
    await t.prisma.resident.update({
      where: { id: application.id },
      data: { status: 'ACTIVE', bedId: bed.id, checkInDate: new Date('2026-03-10') },
    });

    const [app] = (await me(session.auth)).body.applications;
    expect(app).toMatchObject({
      status: 'ACTIVE',
      roomNumber: '204',
      bedLabel: 'B',
      checkInDate: '2026-03-10',
    });
  });

  it('reports only the latest application per hostel', async () => {
    const org = await make.organization();
    const hostel = await make.hostel(org.id);
    const { application, session } = await residentAt(hostel);
    await t.prisma.resident.update({
      where: { id: application.id },
      data: { status: 'REJECTED', rejectionReason: 'Blurry' },
    });
    const again = await make.resident(hostel, {
      userId: application.userId,
      phone: application.phone,
      createdAt: new Date(application.createdAt.getTime() + 60_000),
    });

    const res = await me(session.auth);
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.applications[0]).toMatchObject({
      residentId: again.id,
      status: 'PENDING_REVIEW',
      rejectionReason: null,
    });
  });

  it('never shows anyone else’s applications', async () => {
    const org = await make.organization();
    const hostel = await make.hostel(org.id);
    await make.resident(hostel);
    const lonely = await signIn(t, await make.user());

    expect((await me(lonely.auth)).body).toEqual({ applications: [] });
  });

  it('requires sign-in', async () => {
    await t.http.get('/api/v1/residents/me').expect(401);
  });
});
