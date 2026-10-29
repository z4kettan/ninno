import { isIsoDate, isValidIdNumber, isValidIndianPhone, type IdDocumentType } from '@ninno/utils';
import { Transform } from 'class-transformer';
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

function rule(
  name: string,
  message: string,
  validate: (value: unknown, args: ValidationArguments) => boolean,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name,
      target: target.constructor,
      propertyName: String(propertyName),
      options: { message, ...options },
      validator: { validate },
    });
}

export const IsIndianMobile = (options?: ValidationOptions) =>
  rule(
    'isIndianMobile',
    'must be a 10-digit Indian mobile number',
    (value) => typeof value === 'string' && isValidIndianPhone(value),
    options,
  );

/** A real calendar date written as YYYY-MM-DD. */
export const IsIsoCalendarDate = (options?: ValidationOptions) =>
  rule(
    'isIsoCalendarDate',
    'must be a date like 2001-08-24',
    (value) => typeof value === 'string' && isIsoDate(value),
    options,
  );

/** Checks the number against the `type` property of the same object (Aadhaar checksum etc.). */
export const IsIdNumberForType = (options?: ValidationOptions) =>
  rule(
    'isIdNumberForType',
    'is not a valid number for this ID type',
    (value, args) => {
      const type = (args.object as { type?: IdDocumentType }).type;
      return typeof value === 'string' && type !== undefined && isValidIdNumber(type, value);
    },
    options,
  );

/** A non-negative whole number of paise written as a decimal string, e.g. "650000". */
export const IsPaiseString = (options?: ValidationOptions) =>
  rule(
    'isPaiseString',
    'must be a whole number of paise',
    (value) => typeof value === 'string' && /^\d{1,15}$/.test(value),
    options,
  );

/** Trims strings; leaves everything else for the validators to reject. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Trims strings and turns empty ones into null, for optional fields. */
export const TrimToNull = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });
