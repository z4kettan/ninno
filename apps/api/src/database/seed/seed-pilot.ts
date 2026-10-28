import type { PrismaClient } from '../../generated/prisma/client';
import type { PilotHostel } from './pilot-hostel.schema';

/** Bed labels A, B, C… within a room. */
export function bedLabels(capacity: number): string[] {
  return Array.from({ length: capacity }, (_, i) => String.fromCharCode(65 + i));
}

export interface SeedResult {
  organizationId: string;
  hostelId: string;
  ownerUserId: string;
}

/**
 * Creates or updates the pilot hostel in one transaction. Matching is by natural
 * keys (org slug, hostel slug, room number, bed label, owner phone), so running it
 * again updates values and adds new rooms or beds, but never deletes anything.
 */
export async function seedPilot(prisma: PrismaClient, data: PilotHostel): Promise<SeedResult> {
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.upsert({
      where: { slug: data.organization.slug },
      create: {
        name: data.organization.name,
        slug: data.organization.slug,
        gstin: data.organization.gstin ?? null,
      },
      update: { name: data.organization.name, gstin: data.organization.gstin ?? null },
    });

    const h = data.hostel;
    const hostelFields = {
      name: h.name,
      addressLine1: h.address_line1,
      addressLine2: h.address_line2 ?? null,
      city: h.city,
      state: h.state,
      pincode: h.pincode,
      latitude: h.latitude ?? null,
      longitude: h.longitude ?? null,
      phone: h.phone,
      genderPolicy: h.gender_policy,
      amenities: h.amenities,
      upiVpa: h.upi_vpa ?? null,
      rulesText: h.rules_text,
      billingMode: data.billing.mode,
      fixedDueDay: data.billing.fixed_due_day ?? null,
      graceDays: data.billing.grace_days,
      invoiceLeadDays: data.billing.invoice_lead_days,
      defaultSecurityDepositPaise: data.billing.security_deposit,
    };
    const hostel = await tx.hostel.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: h.slug } },
      create: { organizationId: org.id, slug: h.slug, ...hostelFields },
      update: hostelFields,
    });

    for (const r of data.rooms) {
      const roomFields = {
        floor: r.floor,
        type: r.type,
        capacity: r.capacity,
        monthlyRentPaise: r.monthly_rent,
      };
      const room = await tx.room.upsert({
        where: { hostelId_number: { hostelId: hostel.id, number: r.number } },
        create: {
          organizationId: org.id,
          hostelId: hostel.id,
          number: r.number,
          ...roomFields,
        },
        update: roomFields,
      });
      for (const label of bedLabels(r.capacity)) {
        await tx.bed.upsert({
          where: { roomId_label: { roomId: room.id, label } },
          create: { organizationId: org.id, hostelId: hostel.id, roomId: room.id, label },
          update: {},
        });
      }
    }

    const owner = await tx.user.upsert({
      where: { phone: data.owner.phone },
      create: { phone: data.owner.phone, name: data.owner.name, email: data.owner.email ?? null },
      update: { name: data.owner.name, email: data.owner.email ?? null },
    });
    const membership = await tx.membership.findFirst({
      where: { userId: owner.id, organizationId: org.id, hostelId: null },
    });
    if (!membership) {
      await tx.membership.create({
        data: { userId: owner.id, organizationId: org.id, role: 'OWNER' },
      });
    } else if (membership.role !== 'OWNER' || membership.deletedAt) {
      await tx.membership.update({
        where: { id: membership.id },
        data: { role: 'OWNER', deletedAt: null },
      });
    }

    return { organizationId: org.id, hostelId: hostel.id, ownerUserId: owner.id };
  });
}
