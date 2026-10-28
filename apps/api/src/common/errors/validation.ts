import { HttpStatus, ValidationPipe, type ValidationError } from '@nestjs/common';
import { ErrorCode, type FieldError } from '@ninno/contracts';
import { AppException } from './app.exception';

/** Flattens nested class-validator errors into `[{ field: 'address.pincode', errors: [...] }]`. */
export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own: FieldError[] = error.constraints
      ? [{ field, errors: Object.values(error.constraints) }]
      : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new AppException(
        ErrorCode.ValidationFailed,
        HttpStatus.BAD_REQUEST,
        'Some fields are missing or invalid.',
        flattenValidationErrors(errors),
      ),
  });
}
