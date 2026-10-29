import { HttpErrorResponse } from '@angular/common/http';
import { type ApiErrorBody, ErrorCode } from '@ninno/contracts';

export interface LoginError {
  code: string;
  message: string;
  /** Seconds until a new code may be requested (cooldowns only). */
  retryAfterSeconds?: number;
}

/** Turns any failed login call into the plain-language message the screen shows. */
export function describeLoginError(error: unknown): LoginError {
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return {
      code: 'OFFLINE',
      message: $localize`You seem to be offline. Check your connection and try again.`,
    };
  }
  const body = (
    error instanceof HttpErrorResponse ? error.error : null
  ) as Partial<ApiErrorBody> | null;
  const code = body?.code ?? 'UNKNOWN';

  switch (code) {
    case ErrorCode.OtpInvalid:
      return {
        code,
        message: $localize`That code is wrong or has expired. Check the SMS and try again.`,
      };
    case ErrorCode.OtpLocked:
      return { code, message: $localize`Too many wrong attempts. Request a new code to continue.` };
    case ErrorCode.OtpCooldown: {
      const details = body?.details as { retryAfterSeconds?: number } | null | undefined;
      const seconds = details?.retryAfterSeconds ?? 30;
      return {
        code,
        retryAfterSeconds: seconds,
        message: $localize`Please wait ${seconds}:seconds: seconds before asking for another code.`,
      };
    }
    case ErrorCode.OtpDeliveryFailed:
      return {
        code,
        message: $localize`We couldn't send the SMS just now. Please try again in a moment.`,
      };
    case ErrorCode.RateLimited:
      return {
        code,
        message: $localize`Too many tries from this device. Wait a minute and try again.`,
      };
    case ErrorCode.ValidationFailed:
      return { code, message: $localize`Enter a 10-digit Indian mobile number.` };
    default:
      return { code, message: $localize`Something went wrong on our side. Please try again.` };
  }
}
