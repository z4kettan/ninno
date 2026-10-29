import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ErrorCode } from '@ninno/contracts';
import { type Clock, InjectClock } from '../../../common/clock';
import { AppException } from '../../../common/errors/app.exception';
import { InjectConfig } from '../../../config/config.module';
import type { AppConfig } from '../../../config/env.schema';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';

export const SESSION_RULES = {
  accessTtlSeconds: 15 * 60,
  /** Same for every role (owner decision, 2026-10-29). */
  refreshTtlMs: 30 * 24 * 60 * 60_000,
} as const;

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

interface AccessClaims {
  sub: string;
  typ: 'access';
}

const unauthorized = () =>
  new AppException(ErrorCode.Unauthorized, HttpStatus.UNAUTHORIZED, 'Please sign in again.');

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/**
 * Access tokens are short-lived JWTs that name only the user. Refresh tokens are opaque,
 * stored as SHA-256, rotated on every use, and grouped in families so that replaying an
 * already-rotated token revokes the whole login.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @InjectConfig() private readonly config: AppConfig,
    @InjectClock() private readonly clock: Clock,
  ) {}

  issueAccessToken(userId: string): string {
    const claims: AccessClaims = { sub: userId, typ: 'access' };
    return this.jwt.sign(claims, {
      secret: this.config.auth.jwtAccessSecret,
      algorithm: 'HS256',
      expiresIn: SESSION_RULES.accessTtlSeconds,
    });
  }

  /** Returns the user id, or null for anything invalid or expired. */
  verifyAccessToken(token: string): string | null {
    try {
      const claims = this.jwt.verify<AccessClaims>(token, {
        secret: this.config.auth.jwtAccessSecret,
        algorithms: ['HS256'],
      });
      return claims.typ === 'access' && typeof claims.sub === 'string' ? claims.sub : null;
    } catch {
      return null;
    }
  }

  /** Starts a new refresh-token family for a fresh login. */
  async startSession(userId: string, meta: RequestMeta): Promise<IssuedRefreshToken> {
    return this.createRefreshToken(this.prisma, userId, randomUUID(), meta);
  }

  /**
   * Exchanges a refresh token for a new one. A token that was already rotated or revoked is
   * treated as stolen: its whole family is revoked and the caller must sign in again.
   */
  async rotate(
    token: string,
    meta: RequestMeta,
  ): Promise<{ userId: string; refresh: IssuedRefreshToken }> {
    const now = this.clock.now();
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!current) {
      throw unauthorized();
    }
    if (current.rotatedAt || current.revokedAt) {
      await this.revokeFamily(current.familyId, now);
      await this.audit.log({
        action: 'auth.refresh_reuse',
        entity: 'user',
        entityId: current.userId,
        actorUserId: current.userId,
        ip: meta.ip,
        metadata: { familyId: current.familyId },
      });
      throw unauthorized();
    }
    if (current.expiresAt <= now) {
      throw unauthorized();
    }

    return this.prisma.$transaction(async (tx) => {
      // Conditional so two concurrent refreshes with the same token can't both win.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: current.id, rotatedAt: null, revokedAt: null },
        data: { rotatedAt: now },
      });
      if (count !== 1) {
        throw unauthorized();
      }
      const refresh = await this.createRefreshToken(tx, current.userId, current.familyId, meta);
      return { userId: current.userId, refresh };
    });
  }

  /** Logout: revokes the family of the presented token, if it exists. Never throws. */
  async revoke(token: string): Promise<string | null> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!current) {
      return null;
    }
    await this.revokeFamily(current.familyId, this.clock.now());
    return current.userId;
  }

  private async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private async createRefreshToken(
    db: Pick<PrismaService, 'refreshToken'>,
    userId: string,
    familyId: string,
    meta: RequestMeta,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.clock.now().getTime() + SESSION_RULES.refreshTtlMs);
    await db.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: sha256(token),
        expiresAt,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      },
    });
    return { token, expiresAt };
  }
}
