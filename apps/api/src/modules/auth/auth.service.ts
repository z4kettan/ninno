import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AuthSession,
  ErrorCode,
  type MeResponse,
  type RequestOtpResponse,
} from '@ninno/contracts';
import { maskPhone, normalizeIndianPhone } from '@ninno/utils';
import { type Clock, InjectClock } from '../../common/clock';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OtpService } from './otp/otp.service';
import {
  type IssuedRefreshToken,
  type RequestMeta,
  SESSION_RULES,
  TokenService,
} from './tokens/token.service';

export interface LoginResult {
  session: AuthSession;
  refresh: IssuedRefreshToken;
}

const OTP_INVALID_MESSAGE = 'That code is wrong or has expired. Please try again.';

/** Phone + OTP login for every role. Login never creates accounts. */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    @InjectClock() private readonly clock: Clock,
  ) {}

  /** Same response for every valid number; a code is only sent to existing users. */
  async requestLoginCode(rawPhone: string, meta: RequestMeta): Promise<RequestOtpResponse> {
    const phone = normalizeIndianPhone(rawPhone);
    const user = await this.findActiveUser(phone);
    const issued = await this.otp.issue(phone, 'LOGIN', { deliver: user !== null });
    await this.audit.log({
      action: 'auth.otp_requested',
      entity: 'user',
      entityId: user?.id,
      actorUserId: user?.id,
      ip: meta.ip,
      metadata: { phone, delivered: user !== null },
    });
    return issued;
  }

  async verifyLoginCode(rawPhone: string, code: string, meta: RequestMeta): Promise<LoginResult> {
    const phone = normalizeIndianPhone(rawPhone);
    const result = await this.otp.verify(phone, 'LOGIN', code);
    const user = await this.findActiveUser(phone);

    if (result === 'ok' && user) {
      return this.completeSignIn(user.id, phone, meta);
    }

    const locked = result === 'locked';
    await this.audit.log({
      action: locked ? 'auth.otp_locked' : 'auth.otp_failed',
      entity: 'user',
      entityId: user?.id,
      actorUserId: user?.id,
      ip: meta.ip,
      metadata: { phone },
    });
    throw locked
      ? new AppException(
          ErrorCode.OtpLocked,
          HttpStatus.UNAUTHORIZED,
          'Too many wrong attempts. Request a new code.',
        )
      : new AppException(ErrorCode.OtpInvalid, HttpStatus.UNAUTHORIZED, OTP_INVALID_MESSAGE);
  }

  /** Starts a session for a user whose phone was just verified (login or signup). */
  async completeSignIn(
    userId: string,
    phone: string,
    meta: RequestMeta,
    via: 'login' | 'signup' = 'login',
  ): Promise<LoginResult> {
    const refresh = await this.tokens.startSession(userId, meta);
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: this.clock.now() },
    });
    const me = await this.me(userId);
    await this.audit.log({
      action: 'auth.login',
      entity: 'user',
      entityId: userId,
      actorUserId: userId,
      organizationId: me.memberships[0]?.organizationId,
      ip: meta.ip,
      metadata: { phone, via },
    });
    return { session: this.session(userId, me), refresh };
  }

  async refresh(refreshToken: string | undefined, meta: RequestMeta): Promise<LoginResult> {
    if (!refreshToken) {
      throw new AppException(
        ErrorCode.Unauthorized,
        HttpStatus.UNAUTHORIZED,
        'Please sign in again.',
      );
    }
    const { userId, refresh } = await this.tokens.rotate(refreshToken, meta);
    const me = await this.me(userId);
    return { session: this.session(userId, me), refresh };
  }

  async logout(refreshToken: string | undefined, meta: RequestMeta): Promise<void> {
    if (!refreshToken) {
      return;
    }
    const userId = await this.tokens.revoke(refreshToken);
    if (userId) {
      await this.audit.log({
        action: 'auth.logout',
        entity: 'user',
        entityId: userId,
        actorUserId: userId,
        ip: meta.ip,
      });
    }
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        memberships: {
          where: { deletedAt: null, organization: { deletedAt: null } },
          include: {
            organization: { select: { name: true } },
            hostel: { select: { name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return {
      id: user.id,
      name: user.name,
      phoneMasked: maskPhone(user.phone),
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        hostelId: m.hostelId,
        hostelName: m.hostel?.name ?? null,
        role: m.role,
      })),
    };
  }

  private session(userId: string, me: MeResponse): AuthSession {
    return {
      accessToken: this.tokens.issueAccessToken(userId),
      expiresInSeconds: SESSION_RULES.accessTtlSeconds,
      user: me,
    };
  }

  private findActiveUser(phone: string) {
    return this.prisma.user.findFirst({ where: { phone, deletedAt: null }, select: { id: true } });
  }
}
