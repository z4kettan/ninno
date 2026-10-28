import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorBody } from '@ninno/contracts';

/**
 * The exception domain code throws. `code` is a stable UPPER_SNAKE_CASE
 * identifier that clients can branch on; `message` is for humans.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ApiErrorBody['code'],
    status: HttpStatus,
    message: string,
    readonly details: ApiErrorBody['details'] = null,
  ) {
    super(message, status);
  }
}
