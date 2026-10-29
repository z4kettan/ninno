import { Injectable } from '@nestjs/common';
import type { MyApplication, MyApplicationsResponse } from '@ninno/contracts';
import { PrismaService } from '../../database/prisma.service';

const isoDate = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

@Injectable()
export class ResidentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The caller's latest application at each hostel, newest first. */
  async myApplications(userId: string): Promise<MyApplicationsResponse> {
    const rows = await this.prisma.resident.findMany({
      where: { userId, deletedAt: null, hostel: { deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      include: {
        hostel: { select: { name: true } },
        bed: { select: { label: true, room: { select: { number: true } } } },
      },
    });
    const latest = new Map<string, MyApplication>();
    for (const r of rows) {
      if (latest.has(r.hostelId)) {
        continue;
      }
      const active = r.status === 'ACTIVE';
      latest.set(r.hostelId, {
        residentId: r.id,
        hostelId: r.hostelId,
        hostelName: r.hostel.name,
        status: r.status,
        submittedAt: r.createdAt.toISOString(),
        rejectionReason: r.status === 'REJECTED' ? r.rejectionReason : null,
        roomNumber: active ? (r.bed?.room.number ?? null) : null,
        bedLabel: active ? (r.bed?.label ?? null) : null,
        checkInDate: active ? isoDate(r.checkInDate) : null,
      });
    }
    return { applications: [...latest.values()] };
  }
}
