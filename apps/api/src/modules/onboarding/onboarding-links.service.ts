import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type OnboardingLinkResponse,
  type PublicHostelResponse,
} from '@ninno/contracts';
import { randomBytes } from 'node:crypto';
import type { TenantContext } from '../../common/auth/auth.decorators';
import { hostelScope } from '../../common/auth/hostel-scope';
import { type Clock, InjectClock } from '../../common/clock';
import { AppException } from '../../common/errors/app.exception';
import { InjectConfig } from '../../config/config.module';
import type { AppConfig } from '../../config/env.schema';
import { PrismaService } from '../../database/prisma.service';
import type { Hostel, OnboardingLink, Prisma } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';

/** 192 random bits, URL-safe: 32 characters. */
const newToken = () => randomBytes(24).toString('base64url');

/** One message for every unusable link, so a token's history can't be probed. */
export const linkInvalid = () =>
  new AppException(
    ErrorCode.LinkInvalid,
    HttpStatus.NOT_FOUND,
    'This join link is not valid any more. Ask the hostel for its current QR code.',
  );

export type UsableLink = OnboardingLink & { hostel: Hostel };

/** The QR join link of each hostel: at most one active at a time. */
@Injectable()
export class OnboardingLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @InjectConfig() private readonly config: AppConfig,
    @InjectClock() private readonly clock: Clock,
  ) {}

  /** The hostel's active link, created on first use. */
  async getOrCreate(
    tenant: TenantContext,
    hostelId: string,
    actorUserId: string,
  ): Promise<OnboardingLinkResponse> {
    const { link, hostel, created } = await this.prisma.$transaction(async (tx) => {
      const hostel = await this.lockHostel(tx, tenant, hostelId);
      const active = await tx.onboardingLink.findFirst({
        where: { hostelId: hostel.id, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (active) {
        return { link: active, hostel, created: false };
      }
      return { link: await this.create(tx, hostel, actorUserId), hostel, created: true };
    });
    if (created) {
      await this.audit.log({
        action: 'onboarding_link.created',
        entity: 'onboarding_link',
        entityId: link.id,
        organizationId: hostel.organizationId,
        actorUserId,
        metadata: { hostelId: hostel.id },
      });
    }
    return this.toResponse(link, hostel);
  }

  /** Switches off the current link (old QR codes stop working) and issues a new one. */
  async rotate(
    tenant: TenantContext,
    hostelId: string,
    actorUserId: string,
  ): Promise<OnboardingLinkResponse> {
    const { link, hostel, deactivated } = await this.prisma.$transaction(async (tx) => {
      const hostel = await this.lockHostel(tx, tenant, hostelId);
      const { count } = await tx.onboardingLink.updateMany({
        where: { hostelId: hostel.id, isActive: true },
        data: { isActive: false },
      });
      return { link: await this.create(tx, hostel, actorUserId), hostel, deactivated: count };
    });
    await this.audit.log({
      action: 'onboarding_link.rotated',
      entity: 'onboarding_link',
      entityId: link.id,
      organizationId: hostel.organizationId,
      actorUserId,
      metadata: { hostelId: hostel.id, deactivated },
    });
    return this.toResponse(link, hostel);
  }

  /** The link behind a token if it can still be used, else LINK_INVALID. */
  async findUsable(token: string): Promise<UsableLink> {
    const link = await this.prisma.onboardingLink.findUnique({
      where: { token },
      include: { hostel: true },
    });
    if (!link || !this.isUsable(link)) {
      throw linkInvalid();
    }
    return link;
  }

  isUsable(link: UsableLink): boolean {
    const now = this.clock.now();
    return (
      link.isActive &&
      link.hostel.deletedAt === null &&
      (link.expiresAt === null || link.expiresAt > now) &&
      (link.maxUses === null || link.useCount < link.maxUses)
    );
  }

  publicHostel(hostel: Hostel): PublicHostelResponse {
    return {
      name: hostel.name,
      addressLine1: hostel.addressLine1,
      addressLine2: hostel.addressLine2,
      city: hostel.city,
      state: hostel.state,
      pincode: hostel.pincode,
      genderPolicy: hostel.genderPolicy,
      amenities: Array.isArray(hostel.amenities)
        ? hostel.amenities.filter((a): a is string => typeof a === 'string')
        : [],
      rulesText: hostel.rulesText,
    };
  }

  /**
   * Loads the hostel within the caller's scope and locks its row, so concurrent
   * get-or-create and rotate calls can't leave two active links.
   */
  private async lockHostel(
    tx: Prisma.TransactionClient,
    tenant: TenantContext,
    hostelId: string,
  ): Promise<Hostel> {
    const hostel = await tx.hostel.findFirst({
      where: { AND: [{ id: hostelId }, hostelScope(tenant)] },
    });
    if (!hostel) {
      throw new AppException(ErrorCode.NotFound, HttpStatus.NOT_FOUND, 'Hostel not found.');
    }
    await tx.$executeRaw`SELECT 1 FROM hostels WHERE id = ${hostel.id}::uuid FOR UPDATE`;
    return hostel;
  }

  private create(tx: Prisma.TransactionClient, hostel: Hostel, actorUserId: string) {
    return tx.onboardingLink.create({
      data: {
        organizationId: hostel.organizationId,
        hostelId: hostel.id,
        token: newToken(),
        createdById: actorUserId,
      },
    });
  }

  private toResponse(link: OnboardingLink, hostel: Hostel): OnboardingLinkResponse {
    return {
      hostelId: hostel.id,
      hostelName: hostel.name,
      token: link.token,
      url: `${this.config.appUrl}/join/${link.token}`,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      maxUses: link.maxUses,
      useCount: link.useCount,
      createdAt: link.createdAt.toISOString(),
    };
  }
}
