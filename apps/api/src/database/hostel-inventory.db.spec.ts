import { fixtures } from '../../test/db/fixtures';
import { createTestPrisma, truncateAll } from '../../test/db/test-prisma';

const prisma = createTestPrisma();
const make = fixtures(prisma);

beforeEach(() => truncateAll(prisma));
afterAll(() => prisma.$disconnect());

async function setup() {
  const org = await make.organization();
  const hostel = await make.hostel(org.id);
  return { org, hostel };
}

describe('hostel inventory', () => {
  describe('rooms and beds', () => {
    it('rejects a duplicate room number in the same hostel', async () => {
      const { hostel } = await setup();
      await make.room(hostel, { number: '101' });
      await expect(make.room(hostel, { number: '101' })).rejects.toThrow();
    });

    it('allows the same room number in different hostels', async () => {
      const { org, hostel } = await setup();
      const other = await make.hostel(org.id);
      await make.room(hostel, { number: '101' });
      await expect(make.room(other, { number: '101' })).resolves.toBeTruthy();
    });

    it('creates beds as VACANT by default', async () => {
      const { hostel } = await setup();
      const bed = await make.bed(await make.room(hostel));
      expect(bed.status).toBe('VACANT');
    });

    it('rejects a duplicate bed label in a room', async () => {
      const { hostel } = await setup();
      const room = await make.room(hostel);
      await make.bed(room, 'A');
      await expect(make.bed(room, 'A')).rejects.toThrow();
    });

    it('rejects a room with zero capacity', async () => {
      const { hostel } = await setup();
      await expect(make.room(hostel, { capacity: 0 })).rejects.toThrow();
    });
  });

  describe('one active resident per bed', () => {
    it('rejects a second ACTIVE resident on the same bed', async () => {
      const { hostel } = await setup();
      const bed = await make.bed(await make.room(hostel));
      await make.resident(hostel, { bedId: bed.id, status: 'ACTIVE' });
      await expect(make.resident(hostel, { bedId: bed.id, status: 'ACTIVE' })).rejects.toThrow();
    });

    it('allows a MOVED_OUT and an ACTIVE resident on the same bed', async () => {
      const { hostel } = await setup();
      const bed = await make.bed(await make.room(hostel));
      await make.resident(hostel, { bedId: bed.id, status: 'MOVED_OUT' });
      await expect(
        make.resident(hostel, { bedId: bed.id, status: 'ACTIVE' }),
      ).resolves.toBeTruthy();
    });
  });

  describe('hostel billing settings', () => {
    it('applies the defaults', async () => {
      const { hostel } = await setup();
      expect(hostel).toMatchObject({
        billingMode: 'CHECKIN_ANNIVERSARY',
        graceDays: 5,
        invoiceLeadDays: 7,
        lateFeeType: 'NONE',
        allowPartialPayments: false,
      });
    });

    it('accepts FIXED_DAY with a due day of 28', async () => {
      const { org } = await setup();
      await expect(
        make.hostel(org.id, { billingMode: 'FIXED_DAY', fixedDueDay: 28 }),
      ).resolves.toBeTruthy();
    });

    it.each([31, 0])('rejects FIXED_DAY with due day %i', async (day) => {
      const { org } = await setup();
      await expect(
        make.hostel(org.id, { billingMode: 'FIXED_DAY', fixedDueDay: day }),
      ).rejects.toThrow();
    });

    it('rejects FIXED_DAY without a due day', async () => {
      const { org } = await setup();
      await expect(make.hostel(org.id, { billingMode: 'FIXED_DAY' })).rejects.toThrow();
    });
  });

  describe('amounts in paise', () => {
    it('rejects a negative room rent', async () => {
      const { hostel } = await setup();
      await expect(make.room(hostel, { monthlyRentPaise: -1n })).rejects.toThrow();
    });

    it('round-trips large paise values exactly', async () => {
      const { hostel } = await setup();
      const room = await make.room(hostel, { monthlyRentPaise: 9_007_199_254_740_993n });
      expect(room.monthlyRentPaise).toBe(9_007_199_254_740_993n);
    });

    it('rejects a negative invoice amount', async () => {
      const { hostel } = await setup();
      const resident = await make.resident(hostel);
      await expect(make.invoice(resident, '2026-04-15', { amountPaise: -100n })).rejects.toThrow();
    });
  });

  describe('next rent due date is derived', () => {
    const nextDue = async (residentId: string) => {
      const [row] = await prisma.$queryRaw<{ next_due_date: Date | null }[]>`
        SELECT next_due_date FROM resident_billing_status WHERE resident_id = ${residentId}::uuid`;
      return row?.next_due_date?.toISOString().slice(0, 10) ?? null;
    };

    it('reads the earliest open invoice', async () => {
      const { hostel } = await setup();
      const resident = await make.resident(hostel);
      await make.invoice(resident, '2026-05-15');
      await make.invoice(resident, '2026-04-15', { status: 'OVERDUE' });
      await make.invoice(resident, '2026-03-15', { status: 'PAID' });
      expect(await nextDue(resident.id)).toBe('2026-04-15');
    });

    it('is empty when everything is paid or cancelled', async () => {
      const { hostel } = await setup();
      const resident = await make.resident(hostel);
      await make.invoice(resident, '2026-04-15', { status: 'PAID' });
      await make.invoice(resident, '2026-05-15', { status: 'CANCELLED' });
      expect(await nextDue(resident.id)).toBeNull();
    });
  });
});
