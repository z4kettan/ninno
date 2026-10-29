import type { E164Phone } from '@ninno/utils';
import type { Clock } from '../src/common/clock';
import { OtpDeliveryError, type OtpSender } from '../src/modules/auth/otp/otp-sender';

/** A clock tests can move forward. */
export class TestClock implements Clock {
  private current: Date;

  constructor(start = '2026-04-01T10:00:00Z') {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** Records codes instead of sending SMS; can be told to fail. */
export class CapturingOtpSender implements OtpSender {
  readonly sent: { phone: E164Phone; code: string }[] = [];
  failNext = false;

  async send(phone: E164Phone, code: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new OtpDeliveryError('provider status AUTH_FAILED');
    }
    this.sent.push({ phone, code });
  }

  reset(): void {
    this.sent.length = 0;
    this.failNext = false;
  }

  lastCodeFor(phone: string): string {
    const entry = [...this.sent].reverse().find((s) => s.phone === phone);
    if (!entry) {
      throw new Error(`no code sent to ${phone}`);
    }
    return entry.code;
  }
}

/** A 6-digit code guaranteed to differ from `code`. */
export function wrongCode(code: string): string {
  return code === '000000' ? '111111' : '000000';
}
