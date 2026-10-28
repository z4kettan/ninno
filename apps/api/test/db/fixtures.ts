import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../src/generated/prisma/client';

/** Small builders so DB tests state only what they're about. */
export function fixtures(prisma: PrismaClient) {
  let phoneSeq = 0;
  const nextPhone = () =>
    `+9198${String(Date.now()).slice(-6)}${String(phoneSeq++).padStart(2, '0')}`;

  const organization = (slug = `org-${randomUUID().slice(0, 8)}`) =>
    prisma.organization.create({ data: { name: slug, slug } });

  const hostel = (organizationId: string, overrides: Record<string, unknown> = {}) =>
    prisma.hostel.create({
      data: {
        organizationId,
        name: 'Test Hostel',
        slug: `hostel-${randomUUID().slice(0, 8)}`,
        addressLine1: '1 Test Road',
        city: 'Kochi',
        state: 'Kerala',
        pincode: '682030',
        phone: '+919000000000',
        genderPolicy: 'MALE',
        ...overrides,
      },
    });

  const room = (
    hostel: { id: string; organizationId: string },
    overrides: Record<string, unknown> = {},
  ) =>
    prisma.room.create({
      data: {
        organizationId: hostel.organizationId,
        hostelId: hostel.id,
        number: '101',
        floor: 1,
        type: 'DOUBLE',
        capacity: 2,
        monthlyRentPaise: 650000n,
        ...overrides,
      },
    });

  const bed = (room: { id: string; hostelId: string; organizationId: string }, label = 'A') =>
    prisma.bed.create({
      data: {
        organizationId: room.organizationId,
        hostelId: room.hostelId,
        roomId: room.id,
        label,
      },
    });

  const user = (phone = nextPhone()) => prisma.user.create({ data: { phone, name: 'Test User' } });

  const resident = async (
    hostel: { id: string; organizationId: string },
    overrides: Record<string, unknown> = {},
  ) => {
    const u = await user();
    return prisma.resident.create({
      data: {
        organizationId: hostel.organizationId,
        hostelId: hostel.id,
        userId: u.id,
        fullName: 'Test Resident',
        dob: new Date('2000-01-01'),
        gender: 'MALE',
        phone: u.phone,
        permanentAddress: { line1: 'x', city: 'Kochi', state: 'Kerala', pincode: '682030' },
        occupationType: 'STUDENT',
        emergencyContactName: 'Parent',
        emergencyContactPhone: '+919000000009',
        emergencyContactRelation: 'Father',
        consentAcceptedAt: new Date(),
        consentVersion: 'v1',
        ...overrides,
      },
    });
  };

  const invoice = (
    resident: { id: string; hostelId: string; organizationId: string },
    dueDate: string,
    overrides: Record<string, unknown> = {},
  ) =>
    prisma.invoice.create({
      data: {
        organizationId: resident.organizationId,
        hostelId: resident.hostelId,
        residentId: resident.id,
        periodStart: new Date(dueDate),
        periodEnd: new Date(dueDate),
        dueDate: new Date(dueDate),
        amountPaise: 650000n,
        ...overrides,
      },
    });

  return { organization, hostel, room, bed, user, resident, invoice };
}
