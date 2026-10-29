import type { E164Phone } from '@ninno/utils';

/** Injection token for the configured {@link OtpSender}. */
export const OTP_SENDER = Symbol('OTP_SENDER');

/** Delivers a code Ninno generated. Implementations must never log the code or the full number. */
export interface OtpSender {
  send(phone: E164Phone, code: string): Promise<void>;
}

/** The provider did not accept the code for delivery. Safe to show: carries no PII. */
export class OtpDeliveryError extends Error {
  constructor(reason: string) {
    super(`OTP delivery failed: ${reason}`);
    this.name = 'OtpDeliveryError';
  }
}
