import { Logger } from '@nestjs/common';
import { type E164Phone, maskPhone } from '@ninno/utils';
import type { AppConfig } from '../../../config/env.schema';
import { OtpDeliveryError, type OtpSender } from './otp-sender';

const TIMEOUT_MS = 10_000;

interface ApitxtResponse {
  status?: unknown;
  message?: unknown;
  data?: { request_id?: unknown };
}

/**
 * Sends Ninno-generated codes through apitxt (`POST {baseUrl}/api/sendOTP`, form-encoded).
 * Success is HTTP 2xx with `status: "success"`; anything else is a delivery failure.
 * Logs carry only the masked number, HTTP status and provider status, never the code or key.
 */
export class ApitxtOtpSender implements OtpSender {
  private readonly logger = new Logger('ApitxtOtpSender');

  constructor(
    private readonly options: AppConfig['otp']['apitxt'],
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(phone: E164Phone, code: string): Promise<void> {
    const body = new URLSearchParams({
      authkey: this.options.authKey ?? '',
      // apitxt wants the country code without "+": 91XXXXXXXXXX
      mobile: phone.slice(1),
      otp: code,
      channel: this.options.channel,
    });
    if (this.options.templateId) {
      body.set('template_id', this.options.templateId);
    }

    let response: Response;
    try {
      response = await this.fetchFn(new URL('/api/sendOTP', this.options.baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network';
      this.logger.warn(`apitxt unreachable (${reason}) for ${maskPhone(phone)}`);
      throw new OtpDeliveryError(reason);
    }

    const payload = (await response.json().catch(() => null)) as ApitxtResponse | null;
    const providerStatus = typeof payload?.status === 'string' ? payload.status : 'unknown';
    if (response.ok && providerStatus === 'success') {
      const requestId =
        typeof payload?.data?.request_id === 'string' ? payload.data.request_id : '-';
      this.logger.log(`OTP sent to ${maskPhone(phone)} (request ${requestId})`);
      return;
    }

    this.logger.warn(
      `apitxt rejected OTP for ${maskPhone(phone)}: HTTP ${response.status}, status ${providerStatus}`,
    );
    throw new OtpDeliveryError(`provider status ${providerStatus}`);
  }
}
