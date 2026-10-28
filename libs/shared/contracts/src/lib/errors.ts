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
