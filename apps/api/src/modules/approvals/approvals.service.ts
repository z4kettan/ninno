import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AddressInput,
  type ApprovalCountResponse,
  type ApprovalDecisionResponse,
  type ApprovalDetailResponse,
  type ApprovalListResponse,
  ErrorCode,
} from '@ninno/contracts';
import { maskPhone } from '@ninno/utils';
import type { TenantContext } from '../../common/auth/auth.decorators';
import { inHostelScope } from '../../common/auth/hostel-scope';
import { type Clock, InjectClock } from '../../common/clock';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { billingAnchorDay } from './billing-anchor';
import type { ApproveDto } from './dto/decision.dto';

const notFound = () =>
  new AppException(ErrorCode.NotFound, HttpStatus.NOT_FOUND, 'Application not found.');

const notPending = () =>
  new AppException(
    ErrorCode.NotPending,
    HttpStatus.CONFLICT,
    'This application has already been decided.',
  );

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Where staff review applications and turn them into residents. */
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @InjectClock() private readonly clock: Clock,
  ) {}

  private pendingWhere(tenant: TenantContext): Prisma.ResidentWhereInput {
    return {
      AND: [
        inHostelScope(tenant),
        { status: 'PENDING_REVIEW', deletedAt: null, hostel: { deletedAt: null } },
      ],
    };
  }

  async list(tenant: TenantContext): Promise<ApprovalListResponse> {
    const rows = await this.prisma.resident.findMany({
      where: this.pendingWhere(tenant),
      orderBy: { createdAt: 'asc' },
      include: { hostel: { select: { name: true } } },
    });
    return {
      items: rows.map((r) => ({
        residentId: r.id,
        hostelId: r.hostelId,
        hostelName: r.hostel.name,
        fullName: r.fullName,
        phoneMasked: maskPhone(r.phone),
        occupationType: r.occupationType,
        institutionOrCompany: r.institutionOrCompany,
        submittedAt: r.createdAt.toISOString(),
      })),
    };
  }

  async count(tenant: TenantContext): Promise<ApprovalCountResponse> {
    return { count: await this.prisma.resident.count({ where: this.pendingWhere(tenant) }) };
  }

  async detail(tenant: TenantContext, residentId: string): Promise<ApprovalDetailResponse> {
    const r = await this.prisma.resident.findFirst({
      where: { AND: [{ id: residentId, deletedAt: null }, inHostelScope(tenant)] },
      include: {
        hostel: true,
        identityDocuments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!r) {
      throw notFound();
    }
    const doc = r.identityDocuments[0];
    const beds = await this.prisma.bed.findMany({
      where: { hostelId: r.hostelId, status: 'VACANT' },
      include: { room: true },
      orderBy: [{ room: { floor: 'asc' } }, { room: { number: 'asc' } }, { label: 'asc' }],
    });
    return {
      residentId: r.id,
      hostelId: r.hostelId,
      hostelName: r.hostel.name,
      status: r.status,
      submittedAt: r.createdAt.toISOString(),
      fullName: r.fullName,
      dob: isoDate(r.dob),
      gender: r.gender,
      phone: r.phone,
      altPhone: r.altPhone,
      email: r.email,
      permanentAddress: r.permanentAddress as unknown as AddressInput,
      occupationType: r.occupationType,
      institutionOrCompany: r.institutionOrCompany,
      emergencyContact: {
        name: r.emergencyContactName,
        phone: r.emergencyContactPhone,
        relation: r.emergencyContactRelation,
      },
      idDocument: {
        type: doc?.type ?? 'OTHER',
        numberMasked: doc?.numberMasked ?? '',
        hasBack: Boolean(doc?.backKey),
      },
      consentVersion: r.consentVersion,
      consentAcceptedAt: r.consentAcceptedAt.toISOString(),
      vacantBeds: beds.map((b) => ({
        bedId: b.id,
        label: b.label,
        roomId: b.roomId,
        roomNumber: b.room.number,
        floor: b.room.floor,
        monthlyRentPaise: b.room.monthlyRentPaise.toString(),
      })),
      defaultSecurityDepositPaise: r.hostel.defaultSecurityDepositPaise.toString(),
      billingMode: r.hostel.billingMode,
      fixedDueDay: r.hostel.fixedDueDay,
    };
  }

  /**
   * In one transaction: the application becomes ACTIVE in the chosen bed, the bed OCCUPIED,
   * the rent plan starts at check-in, and the ID is marked verified. The application row is
   * locked first, so a second approver gets NOT_PENDING rather than a misleading bed error.
   */
  async approve(
    tenant: TenantContext,
    residentId: string,
    dto: ApproveDto,
    actorUserId: string,
  ): Promise<ApprovalDecisionResponse> {
    const now = this.clock.now();
    const resident = await this.prisma.$transaction(async (tx) => {
      const r = await this.lockApplication(tx, tenant, residentId);
      const bed = await tx.bed.updateMany({
        where: { id: dto.bedId, hostelId: r.hostelId, status: 'VACANT' },
        data: { status: 'OCCUPIED' },
      });
      if (bed.count !== 1) {
        throw new AppException(
          ErrorCode.BedUnavailable,
          HttpStatus.CONFLICT,
          'That bed is no longer vacant. Please choose another.',
        );
      }
      const checkIn = new Date(`${dto.checkInDate}T00:00:00Z`);
      await tx.resident.update({
        where: { id: r.id },
        data: {
          status: 'ACTIVE',
          bedId: dto.bedId,
          checkInDate: checkIn,
          approvedById: actorUserId,
          approvedAt: now,
        },
      });
      await tx.rentPlan.create({
        data: {
          organizationId: r.organizationId,
          residentId: r.id,
          monthlyRentPaise: BigInt(dto.monthlyRentPaise),
          securityDepositPaise: BigInt(dto.securityDepositPaise),
          billingAnchorDay: billingAnchorDay(
            r.hostel.billingMode,
            r.hostel.fixedDueDay,
            dto.checkInDate,
          ),
          effectiveFrom: checkIn,
          createdById: actorUserId,
        },
      });
      await tx.identityDocument.updateMany({
        where: { residentId: r.id, deletedAt: null, verificationStatus: 'PENDING' },
        data: { verificationStatus: 'VERIFIED', verifiedById: actorUserId, verifiedAt: now },
      });
      return r;
    });
    await this.audit.log({
      action: 'resident.approved',
      entity: 'resident',
      entityId: resident.id,
      organizationId: resident.organizationId,
      actorUserId,
      metadata: {
        hostelId: resident.hostelId,
        bedId: dto.bedId,
        checkInDate: dto.checkInDate,
        monthlyRentPaise: dto.monthlyRentPaise,
        securityDepositPaise: dto.securityDepositPaise,
      },
    });
    return { residentId: resident.id, status: 'ACTIVE' };
  }

  async reject(
    tenant: TenantContext,
    residentId: string,
    reason: string,
    actorUserId: string,
  ): Promise<ApprovalDecisionResponse> {
    const now = this.clock.now();
    const resident = await this.prisma.$transaction(async (tx) => {
      const r = await this.lockApplication(tx, tenant, residentId);
      await tx.resident.update({
        where: { id: r.id },
        data: { status: 'REJECTED', rejectionReason: reason },
      });
      await tx.identityDocument.updateMany({
        where: { residentId: r.id, deletedAt: null, verificationStatus: 'PENDING' },
        data: {
          verificationStatus: 'REJECTED',
          rejectionReason: reason,
          verifiedById: actorUserId,
          verifiedAt: now,
        },
      });
      return r;
    });
    await this.audit.log({
      action: 'resident.rejected',
      entity: 'resident',
      entityId: resident.id,
      organizationId: resident.organizationId,
      actorUserId,
      metadata: { hostelId: resident.hostelId, reason },
    });
    return { residentId: resident.id, status: 'REJECTED' };
  }

  /** Loads and row-locks an application in scope; it must still be pending. */
  private async lockApplication(tx: Prisma.TransactionClient, tenant: TenantContext, id: string) {
    const found = await tx.resident.findFirst({
      where: { AND: [{ id, deletedAt: null }, inHostelScope(tenant)] },
      select: { id: true },
    });
    if (!found) {
      throw notFound();
    }
    await tx.$executeRaw`SELECT 1 FROM residents WHERE id = ${found.id}::uuid FOR UPDATE`;
    // Re-read after the lock: another approver may have just decided it.
    const r = await tx.resident.findUniqueOrThrow({
      where: { id: found.id },
      include: { hostel: true },
    });
    if (r.status !== 'PENDING_REVIEW') {
      throw notPending();
    }
    return r;
  }
}
