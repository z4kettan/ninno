import { HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { type ApiErrorBody, ErrorCode } from '@ninno/contracts';
import { AppException } from './app.exception';

export interface ErrorEnvelope {
  status: number;
  body: ApiErrorBody;
}

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: ErrorCode.BadRequest,
  401: ErrorCode.Unauthorized,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  409: ErrorCode.Conflict,
  413: ErrorCode.PayloadTooLarge,
  429: ErrorCode.RateLimited,
};

const MESSAGE_BY_CODE: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.NotFound]: 'The requested resource was not found.',
  [ErrorCode.PayloadTooLarge]: 'The request body is too large.',
  [ErrorCode.RateLimited]: 'Too many requests. Please wait a moment and try again.',
  [ErrorCode.InternalError]: 'Something went wrong on our side. Please try again.',
};

/** Errors thrown by body-parser carry a numeric status and a `type`. */
function isHttpError(error: unknown): error is { status: number; type?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { status?: unknown }).status === 'number' &&
    typeof (error as { type?: unknown }).type === 'string'
  );
}

/**
 * Maps any thrown value to the single API error shape. Unknown errors become
 * a generic 500 so internal messages and stack traces never reach clients.
 */
export function toErrorEnvelope(error: unknown, requestId: string): ErrorEnvelope {
  if (error instanceof AppException) {
    return {
      status: error.getStatus(),
      body: { code: error.code, message: error.message, details: error.details, requestId },
    };
  }

  if (error instanceof ThrottlerException) {
    return envelopeFor(HttpStatus.TOO_MANY_REQUESTS, requestId);
  }

  if (error instanceof HttpException) {
    const status = error.getStatus();
    const code = CODE_BY_STATUS[status];
    if (code) {
      const response = error.getResponse();
      const message =
        MESSAGE_BY_CODE[code] ??
        (typeof response === 'string'
          ? response
          : String((response as { message?: unknown }).message ?? error.message));
      return { status, body: { code, message, details: null, requestId } };
    }
  }

  if (isHttpError(error) && error.status >= 400 && error.status < 500) {
    if (error.type === 'entity.parse.failed') {
      return {
        status: 400,
        body: {
          code: ErrorCode.BadRequest,
          message: 'The request body is not valid JSON.',
          details: null,
          requestId,
        },
      };
    }
    return envelopeFor(error.status, requestId);
  }

  return envelopeFor(HttpStatus.INTERNAL_SERVER_ERROR, requestId);
}

function envelopeFor(status: number, requestId: string): ErrorEnvelope {
  const code = CODE_BY_STATUS[status] ?? ErrorCode.InternalError;
  const finalStatus = CODE_BY_STATUS[status] ? status : HttpStatus.INTERNAL_SERVER_ERROR;
  return {
    status: finalStatus,
    body: {
      code,
      message: MESSAGE_BY_CODE[code] ?? 'The request could not be processed.',
      details: null,
      requestId,
    },
  };
}
