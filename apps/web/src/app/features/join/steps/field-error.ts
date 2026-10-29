import type { AbstractControl } from '@angular/forms';

const MESSAGES: Record<string, () => string> = {
  required: () => $localize`This is required.`,
  minlength: () => $localize`This is too short.`,
  maxlength: () => $localize`This is too long.`,
  email: () => $localize`Enter a valid email address.`,
  indianMobile: () => $localize`Enter a 10-digit Indian mobile number.`,
  pincode: () => $localize`Enter a 6-digit pincode.`,
  date: () => $localize`Enter a valid date.`,
  future: () => $localize`The date of birth can't be in the future.`,
  tooYoung: () => $localize`Residents must be at least 16 years old.`,
  sameNumber: () => $localize`Give someone else's number for emergencies.`,
  idNumber: () => $localize`This is not a valid number for this ID.`,
  institutionRequired: () => $localize`Enter your college or company.`,
};

/** The first error of a touched control as a sentence, else null. */
export function fieldError(control: AbstractControl | null, groupError?: string): string | null {
  if (!control || !control.touched) {
    return null;
  }
  const own = control.errors ? Object.keys(control.errors)[0] : undefined;
  if (own) {
    return MESSAGES[own]?.() ?? $localize`Check this field.`;
  }
  const fromGroup = groupError && control.parent?.errors?.[groupError] ? groupError : undefined;
  return fromGroup ? (MESSAGES[fromGroup]?.() ?? null) : null;
}
