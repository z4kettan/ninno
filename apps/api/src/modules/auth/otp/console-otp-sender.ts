import { Logger } from '@nestjs/common';
import { type E164Phone, maskPhone } from '@ninno/utils';
import type { OtpSender } from './otp-sender';

/**
 * Development/test sender: prints the code to the API log instead of sending an SMS.
 * Config validation refuses this sender in production.
 */
export class ConsoleOtpSender implements OtpSender {
  private readonly logger = new Logger('OTP');

  async send(phone: E164Phone, code: string): Promise<void> {
    this.logger.warn(`[dev] OTP for ${maskPhone(phone)} is ${code}`);
  }
}
