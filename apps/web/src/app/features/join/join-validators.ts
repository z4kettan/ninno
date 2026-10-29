import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PINCODE_PATTERN } from '@ninno/contracts';
import {
  ageOn,
  type IdDocumentType,
  isIsoDate,
  isValidIdNumber,
  isValidIndianPhone,
  MIN_RESIDENT_AGE,
  todayIst,
} from '@ninno/utils';

/** The same rules as the API's DTOs, so a step only advances when the server will agree. */

const blank = (value: unknown) => typeof value !== 'string' || value.trim() === '';

export const indianMobile: ValidatorFn = (control) =>
  blank(control.value) || isValidIndianPhone(control.value as string)
    ? null
    : { indianMobile: true };

export const pincode: ValidatorFn = (control) =>
  blank(control.value) || PINCODE_PATTERN.test((control.value as string).trim())
    ? null
    : { pincode: true };

/** A real date, not in the future, and at least 16 years ago (in IST). */
export function dateOfBirth(now: () => Date = () => new Date()): ValidatorFn {
  return (control) => {
    const value = control.value as string;
    if (blank(value)) {
      return null;
    }
    if (!isIsoDate(value)) {
      return { date: true };
    }
    const today = todayIst(now());
    if (value > today) {
      return { future: true };
    }
    return ageOn(value, today) < MIN_RESIDENT_AGE ? { tooYoung: true } : null;
  };
}

/** On the ID group: the number must suit the chosen type (Aadhaar checksum, etc.). */
export const idNumberForType: ValidatorFn = (group) => {
  const type = group.get('type')?.value as IdDocumentType | '';
  const number = group.get('idNumber');
  if (!type || !number || blank(number.value)) {
    return null;
  }
  return isValidIdNumber(type, number.value as string) ? null : { idNumber: true };
};

/** On the work group: students and working residents name their institution or company. */
export const institutionRequired: ValidatorFn = (group) => {
  const type = group.get('occupationType')?.value as string;
  const name = group.get('institutionOrCompany')?.value as string;
  return (type === 'STUDENT' || type === 'WORKING') && blank(name)
    ? { institutionRequired: true }
    : null;
};

/** On the emergency phone: it must be someone else's number. */
export function notSameNumber(own: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (blank(value) || blank(own())) {
      return null;
    }
    const digits = (v: string) => v.replace(/\D/g, '').slice(-10);
    return digits(value) === digits(own()) ? { sameNumber: true } : null;
  };
}
