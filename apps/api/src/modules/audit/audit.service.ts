import { Injectable } from '@nestjs/common';
import { isValidIndianPhone, maskPhone } from '@ninno/utils';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  organizationId?: string | null;
  actorUserId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}

const PHONE_KEYS = new Set(['phone', 'mobile', 'altPhone']);

/** Masks phone numbers at any depth, whatever the caller passed. */
function sanitize(value: unknown, key?: string): unknown {
  if (typeof value === 'string' && key && PHONE_KEYS.has(key)) {
    return isValidIndianPhone(value) ? maskPhone(value) : '[REDACTED]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v, k)]));
  }
  return value;
}

/** Append-only record of who did what. Phone numbers are always stored masked. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        organizationId: entry.organizationId ?? null,
        actorUserId: entry.actorUserId ?? null,
        ip: entry.ip ?? null,
        metadata: sanitize(entry.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
