import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode } from '@ninno/contracts';
import type { E164Phone } from '@ninno/utils';
import { type Clock, InjectClock } from '../../../common/clock';
import { AppException } from '../../../common/errors/app.exception';
import { InjectConfig } from '../../../config/config.module';
import type { AppConfig } from '../../../config/env.schema';
import { PrismaService } from '../../../database/prisma.service';
import type { OtpPurpose } from '../../../generated/prisma/client';
import { OTP_SENDER, OtpDeliveryError, type OtpSender } from './otp-sender';

export const OTP_RULES = {
  codeTtlMs: 5 * 60_000,
  resendCooldownMs: 30_000,
  sendWindowMs: 60 * 60_000,
  maxSendsPerWindow: 5,
  maxAttempts: 5,
} as const;

export type OtpVerification = 'ok' | 'invalid' | 'locked';

export interface IssuedOtp {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

/**
 * Issues and checks one-time codes. One live challenge per (phone, purpose); a new
 * request replaces it. Codes are stored only as HMAC hashes.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectConfig() private readonly config: AppConfig,
    @Inject(OTP_SENDER) private readonly sender: OtpSender,
    @InjectClock() private readonly clock: Clock,
  ) {}

  /**
   * Creates a fresh code and, when `deliver` is true, sends it. Callers pass `deliver: false`
   * for numbers without an account: the challenge still exists (so cooldowns and lockouts
   * look identical) but nothing is sent.
   */
  async issue(
    phone: E164Phone,
    purpose: OtpPurpose,
    { deliver }: { deliver: boolean },
  ): Promise<IssuedOtp> {
    const now = this.clock.now();
    const existing = await this.prisma.otpChallenge.findUnique({
      where: { phone_purpose: { phone, purpose } },
    });

    let windowStart = now;
    let sendsInWindow = 0;
    if (existing) {
      const sinceLastSend = now.getTime() - existing.lastSentAt.getTime();
      if (sinceLastSend < OTP_RULES.resendCooldownMs) {
        throw cooldown(OTP_RULES.resendCooldownMs - sinceLastSend);
      }
      if (now.getTime() - existing.sendWindowStart.getTime() < OTP_RULES.sendWindowMs) {
        windowStart = existing.sendWindowStart;
        sendsInWindow = existing.sendCountInWindow;
      }
      if (sendsInWindow >= OTP_RULES.maxSendsPerWindow) {
        throw cooldown(windowStart.getTime() + OTP_RULES.sendWindowMs - now.getTime());
      }
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const fields = {
      codeHash: this.hash(phone, purpose, code),
      attempts: 0,
      expiresAt: new Date(now.getTime() + OTP_RULES.codeTtlMs),
      consumedAt: null,
      lockedAt: null,
      lastSentAt: now,
      sendWindowStart: windowStart,
      sendCountInWindow: sendsInWindow + 1,
      delivered: deliver,
    };
    const challenge = await this.prisma.otpChallenge.upsert({
      where: { phone_purpose: { phone, purpose } },
      create: { phone, purpose, ...fields },
      update: fields,
    });

    if (deliver) {
      try {
        await this.sender.send(phone, code);
      } catch (error) {
        if (!(error instanceof OtpDeliveryError)) {
          throw error;
        }
        // Let the user retry straight away; the attempt still counts toward the hourly cap.
        await this.prisma.otpChallenge.update({
          where: { id: challenge.id },
          data: { lastSentAt: new Date(0) },
        });
        throw new AppException(
          ErrorCode.OtpDeliveryFailed,
          HttpStatus.BAD_GATEWAY,
          "We couldn't send the code right now. Please try again in a moment.",
        );
      }
    }

    return {
      expiresInSeconds: OTP_RULES.codeTtlMs / 1000,
      resendAfterSeconds: OTP_RULES.resendCooldownMs / 1000,
    };
  }

  /** Checks a code. A correct code works once; the 5th wrong attempt locks the challenge. */
  async verify(phone: E164Phone, purpose: OtpPurpose, code: string): Promise<OtpVerification> {
    const now = this.clock.now();
    const challenge = await this.prisma.otpChallenge.findUnique({
      where: { phone_purpose: { phone, purpose } },
    });
    if (!challenge) {
      return 'invalid';
    }
    if (challenge.lockedAt) {
      return 'locked';
    }
    if (challenge.consumedAt || challenge.expiresAt <= now) {
      return 'invalid';
    }

    if (this.matches(challenge.codeHash, this.hash(phone, purpose, code))) {
      // Conditional update so two concurrent correct submissions can't both succeed.
      const { count } = await this.prisma.otpChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, lockedAt: null },
        data: { consumedAt: now },
      });
      return count === 1 ? 'ok' : 'invalid';
    }

    const updated = await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    if (updated.attempts >= OTP_RULES.maxAttempts) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { lockedAt: now },
      });
      return 'locked';
    }
    return 'invalid';
  }

  private hash(phone: E164Phone, purpose: OtpPurpose, code: string): string {
    return createHmac('sha256', this.config.auth.otpPepper)
      .update(`${purpose}|${phone}|${code}`)
      .digest('hex');
  }

  private matches(storedHex: string, candidateHex: string): boolean {
    const stored = Buffer.from(storedHex, 'hex');
    const candidate = Buffer.from(candidateHex, 'hex');
    return stored.length === candidate.length && timingSafeEqual(stored, candidate);
  }
}

function cooldown(waitMs: number): AppException {
  const retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
  return new AppException(
    ErrorCode.OtpCooldown,
    HttpStatus.TOO_MANY_REQUESTS,
    `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
    { retryAfterSeconds },
  );
}
