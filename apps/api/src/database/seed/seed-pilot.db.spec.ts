import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { createTestPrisma, truncateAll } from '../../../test/db/test-prisma';
import { parsePilotHostel } from './pilot-hostel.schema';
import { seedPilot } from './seed-pilot';

const prisma = createTestPrisma();
const rawFile = () =>
  parse(readFileSync(resolve(__dirname, '../../../../../prisma/pilot-hostel.yaml'), 'utf8'));

beforeEach(() => truncateAll(prisma));
afterAll(() => prisma.$disconnect());

async function counts() {
  const [organizations, hostels, rooms, beds, users, memberships] = await Promise.all([
    prisma.organization.count(),
    prisma.hostel.count(),
    prisma.room.count(),
    prisma.bed.count(),
    prisma.user.count(),
    prisma.membership.count(),
  ]);
  return { organizations, hostels, rooms, beds, users, memberships };
}

describe('pilot seed', () => {
  it('creates the hostel, rooms, beds and owner on a fresh database', async () => {
    await seedPilot(prisma, parsePilotHostel(rawFile()));

    const room101 = await prisma.room.findFirstOrThrow({
      where: { number: '101' },
      include: { beds: { orderBy: { label: 'asc' } } },
    });
    expect(room101.capacity).toBe(2);
    expect(room101.monthlyRentPaise).toBe(650000n);
    expect(room101.beds.map((b) => [b.label, b.status])).toEqual([
      ['A', 'VACANT'],
      ['B', 'VACANT'],
    ]);
    // 2 + 3 + 1 + 6 beds across the four placeholder rooms.
    expect(await counts()).toEqual({
      organizations: 1,
      hostels: 1,
      rooms: 4,
      beds: 12,
      users: 1,
      memberships: 1,
    });
  });

  it('gives the owner an organisation-wide OWNER membership', async () => {
    const { organizationId } = await seedPilot(prisma, parsePilotHostel(rawFile()));
    const owner = await prisma.user.findUniqueOrThrow({
      where: { phone: '+919000000002' },
      include: { memberships: true },
    });
    expect(owner.memberships).toEqual([
      expect.objectContaining({ organizationId, hostelId: null, role: 'OWNER' }),
    ]);
  });

  it('is repeatable without creating duplicates', async () => {
    const data = parsePilotHostel(rawFile());
    await seedPilot(prisma, data);
    const first = await counts();
    await seedPilot(prisma, data);
    expect(await counts()).toEqual(first);
  });

  it('updates a changed rent without creating a new room', async () => {
    await seedPilot(prisma, parsePilotHostel(rawFile()));
    const raw = rawFile();
    raw.rooms[0].monthly_rent = 7000;
    await seedPilot(prisma, parsePilotHostel(raw));

    const rooms = await prisma.room.findMany({ where: { number: '101' } });
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.monthlyRentPaise).toBe(700000n);
  });

  it('adds beds when capacity grows and never deletes beds', async () => {
    await seedPilot(prisma, parsePilotHostel(rawFile()));
    const raw = rawFile();
    raw.rooms[3].capacity = 8;
    await seedPilot(prisma, parsePilotHostel(raw));
    expect(await prisma.bed.count({ where: { room: { number: '202' } } })).toBe(8);

    raw.rooms[3].capacity = 4;
    await seedPilot(prisma, parsePilotHostel(raw));
    expect(await prisma.bed.count({ where: { room: { number: '202' } } })).toBe(8);
  });

  it('uses SEED_OWNER_PHONE for the owner', async () => {
    await seedPilot(prisma, parsePilotHostel(rawFile(), { SEED_OWNER_PHONE: '9876543210' }));
    const owner = await prisma.user.findUniqueOrThrow({ where: { phone: '+919876543210' } });
    expect(owner.name).toBe('Demo Owner');
  });

  it('writes nothing when the file is invalid', async () => {
    const raw = rawFile();
    raw.owner.phone = '12345';
    await expect(async () => seedPilot(prisma, parsePilotHostel(raw))).rejects.toThrow(
      /owner\.phone/,
    );
    expect(await counts()).toEqual({
      organizations: 0,
      hostels: 0,
      rooms: 0,
      beds: 0,
      users: 0,
      memberships: 0,
    });
  });
});
