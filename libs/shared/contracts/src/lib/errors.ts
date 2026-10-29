/** Stable error codes returned in the `code` field of every API error. */
export const ErrorCode = {
  BadRequest: 'BAD_REQUEST',
  ValidationFailed: 'VALIDATION_FAILED',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  PayloadTooLarge: 'PAYLOAD_TOO_LARGE',
  RateLimited: 'RATE_LIMITED',
  InternalError: 'INTERNAL_ERROR',
  // Auth
  OtpInvalid: 'OTP_INVALID',
  OtpLocked: 'OTP_LOCKED',
  OtpCooldown: 'OTP_COOLDOWN',
  OtpDeliveryFailed: 'OTP_DELIVERY_FAILED',
  TenantRequired: 'TENANT_REQUIRED',
  // Onboarding
  LinkInvalid: 'LINK_INVALID',
  AlreadyRegistered: 'ALREADY_REGISTERED',
  FileTooLarge: 'FILE_TOO_LARGE',
  FileInvalid: 'FILE_INVALID',
  // Approvals
  BedUnavailable: 'BED_UNAVAILABLE',
  NotPending: 'NOT_PENDING',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface FieldError {
  field: string;
  errors: string[];
}

/** The JSON body of every non-2xx API response. */
export interface ApiErrorBody {
  /** UPPER_SNAKE_CASE; domain modules may add codes beyond {@link ErrorCode}. */
  code: ErrorCode | (string & {});
  message: string;
  details: FieldError[] | Record<string, unknown> | null;
  requestId: string;
}
