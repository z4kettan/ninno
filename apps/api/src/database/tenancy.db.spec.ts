import { fixtures } from '../../test/db/fixtures';
import { createTestPrisma, truncateAll } from '../../test/db/test-prisma';

const prisma = createTestPrisma();
const make = fixtures(prisma);

beforeEach(() => truncateAll(prisma));
afterAll(() => prisma.$disconnect());

describe('tenancy', () => {
  describe('every business record belongs to one tenant', () => {
    it('rejects a hostel without an organisation id', async () => {
      await expect(
        prisma.$executeRaw`
          INSERT INTO hostels (id, name, slug, address_line1, city, state, pincode, phone, gender_policy, updated_at)
          VALUES (gen_random_uuid(), 'X', 'x', 'a', 'Kochi', 'Kerala', '682030', '+919000000000', 'MALE', now())`,
      ).rejects.toThrow();
    });

    it('rejects a room without an organisation id', async () => {
      const org = await make.organization();
      const hostel = await make.hostel(org.id);
      await expect(
        prisma.$executeRaw`
          INSERT INTO rooms (id, hostel_id, number, floor, type, capacity, monthly_rent_paise, updated_at)
          VALUES (gen_random_uuid(), ${hostel.id}::uuid, '1', 1, 'SINGLE', 1, 0, now())`,
      ).rejects.toThrow();
    });
  });

  describe('child records cannot cross tenants', () => {
    it('accepts a room under its own organisation’s hostel', async () => {
      const org = await make.organization();
      const hostel = await make.hostel(org.id);
      await expect(make.room(hostel)).resolves.toMatchObject({ hostelId: hostel.id });
    });

    it('rejects a room whose organisation differs from its hostel’s', async () => {
      const orgA = await make.organization();
      const orgB = await make.organization();
      const hostelOfB = await make.hostel(orgB.id);
      await expect(make.room({ id: hostelOfB.id, organizationId: orgA.id })).rejects.toThrow();
    });

    it('rejects an invoice whose hostel differs from its resident’s', async () => {
      const org = await make.organization();
      const hostel1 = await make.hostel(org.id);
      const hostel2 = await make.hostel(org.id);
      const resident = await make.resident(hostel1);
      await expect(make.invoice(resident, '2026-04-15')).resolves.toBeTruthy();
      await expect(
        make.invoice({ ...resident, hostelId: hostel2.id }, '2026-05-15'),
      ).rejects.toThrow();
    });

    it('rejects assigning a resident to another hostel’s bed', async () => {
      const org = await make.organization();
      const hostel1 = await make.hostel(org.id);
      const hostel2 = await make.hostel(org.id);
      const bedInHostel2 = await make.bed(await make.room(hostel2));
      await expect(make.resident(hostel1, { bedId: bedInHostel2.id })).rejects.toThrow();
    });
  });

  describe('phone number is the unique identity', () => {
    it('rejects a second user with the same phone', async () => {
      await make.user('+919876543210');
      await expect(make.user('+919876543210')).rejects.toThrow();
    });

    it('has no password column', async () => {
      const columns = await prisma.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`;
      expect(columns.map((c) => c.column_name)).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/password/)]),
      );
    });
  });

  describe('access through memberships', () => {
    it('rejects a duplicate organisation-wide membership', async () => {
      const org = await make.organization();
      const user = await make.user();
      const data = { userId: user.id, organizationId: org.id, role: 'OWNER' as const };
      await prisma.membership.create({ data });
      await expect(prisma.membership.create({ data })).rejects.toThrow();
    });

    it('rejects a duplicate hostel-scoped membership', async () => {
      const org = await make.organization();
      const hostel = await make.hostel(org.id);
      const user = await make.user();
      const data = {
        userId: user.id,
        organizationId: org.id,
        hostelId: hostel.id,
        role: 'STAFF' as const,
      };
      await prisma.membership.create({ data });
      await expect(prisma.membership.create({ data })).rejects.toThrow();
    });

    it('allows the same user in two organisations', async () => {
      const user = await make.user();
      for (const org of [await make.organization(), await make.organization()]) {
        await prisma.membership.create({
          data: { userId: user.id, organizationId: org.id, role: 'MANAGER' },
        });
      }
      expect(await prisma.membership.count({ where: { userId: user.id } })).toBe(2);
    });

    it('rejects a membership naming a hostel of another organisation', async () => {
      const orgA = await make.organization();
      const orgB = await make.organization();
      const hostelOfB = await make.hostel(orgB.id);
      const user = await make.user();
      await expect(
        prisma.membership.create({
          data: { userId: user.id, organizationId: orgA.id, hostelId: hostelOfB.id, role: 'STAFF' },
        }),
      ).rejects.toThrow();
    });
  });
});
