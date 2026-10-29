import { CapturingOtpSender, TestClock, wrongCode } from '../../../../test/auth-doubles';
import { createTestPrisma, truncateAll } from '../../../../test/db/test-prisma';
import { testConfig } from '../../../../test/test-config';
import { AppException } from '../../../common/errors/app.exception';
import type { PrismaService } from '../../../database/prisma.service';
import { OTP_RULES, OtpService } from './otp.service';

const PHONE = '+919876543210' as const;
const prisma = createTestPrisma();

let clock: TestClock;
let sender: CapturingOtpSender;
let otp: OtpService;

beforeEach(async () => {
  await truncateAll(prisma);
  clock = new TestClock();
  sender = new CapturingOtpSender();
  otp = new OtpService(prisma as unknown as PrismaService, testConfig(), sender, clock);
});

afterAll(() => prisma.$disconnect());

async function issueAndRead() {
  await otp.issue(PHONE, 'LOGIN', { deliver: true });
  return sender.lastCodeFor(PHONE);
}

async function expectAppError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppException);
  expect((error as AppException).code).toBe(code);
  return error as AppException;
}

describe('OTP delivery rules', () => {
  describe('code format and storage', () => {
    it('sends 6 digits and stores only a hash', async () => {
      const code = await issueAndRead();
      expect(code).toMatch(/^\d{6}$/);
      const row = await prisma.otpChallenge.findUniqueOrThrow({
        where: { phone_purpose: { phone: PHONE, purpose: 'LOGIN' } },
      });
      expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(row)).not.toContain(code);
    });

    it('reports the expiry and resend timings', async () => {
      await expect(otp.issue(PHONE, 'LOGIN', { deliver: true })).resolves.toEqual({
        expiresInSeconds: 300,
        resendAfterSeconds: 30,
      });
    });
  });

  describe('verification', () => {
    it('accepts the right code once', async () => {
      const code = await issueAndRead();
      await expect(otp.verify(PHONE, 'LOGIN', code)).resolves.toBe('ok');
      await expect(otp.verify(PHONE, 'LOGIN', code)).resolves.toBe('invalid');
    });

    it('rejects a code for another purpose', async () => {
      const code = await issueAndRead();
      await expect(otp.verify(PHONE, 'SIGNUP', code)).resolves.toBe('invalid');
    });

    it('rejects the right code after 5 minutes', async () => {
      const code = await issueAndRead();
      clock.advance(OTP_RULES.codeTtlMs);
      await expect(otp.verify(PHONE, 'LOGIN', code)).resolves.toBe('invalid');
    });

    it('locks after 5 wrong attempts, even for the right code', async () => {
      const code = await issueAndRead();
      for (let i = 1; i < OTP_RULES.maxAttempts; i++) {
        await expect(otp.verify(PHONE, 'LOGIN', wrongCode(code))).resolves.toBe('invalid');
      }
      await expect(otp.verify(PHONE, 'LOGIN', wrongCode(code))).resolves.toBe('locked');
      await expect(otp.verify(PHONE, 'LOGIN', code)).resolves.toBe('locked');
    });

    it('a new code replaces the old one', async () => {
      const first = await issueAndRead();
      clock.advance(OTP_RULES.resendCooldownMs);
      const second = await issueAndRead();
      // Random codes can collide (1 in a million); only assert rejection when they differ.
      if (first !== second) {
        await expect(otp.verify(PHONE, 'LOGIN', first)).resolves.toBe('invalid');
      }
      await expect(otp.verify(PHONE, 'LOGIN', second)).resolves.toBe('ok');
    });

    it('a new code works again after a lockout', async () => {
      const code = await issueAndRead();
      for (let i = 0; i < OTP_RULES.maxAttempts; i++) {
        await otp.verify(PHONE, 'LOGIN', wrongCode(code));
      }
      await expect(otp.verify(PHONE, 'LOGIN', code)).resolves.toBe('locked');
      clock.advance(OTP_RULES.resendCooldownMs);
      const fresh = await issueAndRead();
      await expect(otp.verify(PHONE, 'LOGIN', fresh)).resolves.toBe('ok');
    });

    it('rejects everything for a number that never requested a code', async () => {
      await expect(otp.verify(PHONE, 'LOGIN', '123456')).resolves.toBe('invalid');
    });
  });

  describe('resend limits', () => {
    it('refuses a second code within 30 seconds and says how long to wait', async () => {
      await otp.issue(PHONE, 'LOGIN', { deliver: true });
      clock.advance(10_000);
      const error = await expectAppError(
        otp.issue(PHONE, 'LOGIN', { deliver: true }),
        'OTP_COOLDOWN',
      );
      expect(error.getStatus()).toBe(429);
      expect(error.details).toEqual({ retryAfterSeconds: 20 });
    });

    it('caps sends at 5 per hour per number', async () => {
      for (let i = 0; i < OTP_RULES.maxSendsPerWindow; i++) {
        await otp.issue(PHONE, 'LOGIN', { deliver: true });
        clock.advance(OTP_RULES.resendCooldownMs);
      }
      await expectAppError(otp.issue(PHONE, 'LOGIN', { deliver: true }), 'OTP_COOLDOWN');
      expect(sender.sent).toHaveLength(5);

      clock.advance(OTP_RULES.sendWindowMs);
      await expect(otp.issue(PHONE, 'LOGIN', { deliver: true })).resolves.toBeTruthy();
    });

    it('applies the same limits when nothing is delivered (unknown numbers)', async () => {
      await otp.issue(PHONE, 'LOGIN', { deliver: false });
      expect(sender.sent).toHaveLength(0);
      await expectAppError(otp.issue(PHONE, 'LOGIN', { deliver: false }), 'OTP_COOLDOWN');
    });
  });

  describe('delivery failures', () => {
    it('returns OTP_DELIVERY_FAILED (502) and allows an immediate retry', async () => {
      sender.failNext = true;
      const error = await expectAppError(
        otp.issue(PHONE, 'LOGIN', { deliver: true }),
        'OTP_DELIVERY_FAILED',
      );
      expect(error.getStatus()).toBe(502);
      await expect(otp.issue(PHONE, 'LOGIN', { deliver: true })).resolves.toBeTruthy();
      expect(sender.sent).toHaveLength(1);
    });
  });
});
