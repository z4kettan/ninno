/** E.164 Indian mobile number, e.g. "+919876543210". */
export type E164Phone = `+91${string}`;

export class InvalidPhoneError extends Error {
  constructor(input: string) {
    super('Invalid Indian mobile number');
    this.name = 'InvalidPhoneError';
    // The raw input is deliberately left out of the message: phone numbers are PII.
    void input;
  }
}

const MOBILE_PATTERN = /^[6-9]\d{9}$/;

/** Strips separators and the +91 / 91 / 0 prefixes, leaving the 10-digit mobile number. */
function nationalDigits(input: string): string {
  let digits = input.trim().replace(/[\s\-().]/g, '');
  if (digits.startsWith('+91')) {
    digits = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

/** Normalises Indian mobile input to E.164: "098765 43210" → "+919876543210". */
export function normalizeIndianPhone(input: string): E164Phone {
  const digits = nationalDigits(input);
  if (!MOBILE_PATTERN.test(digits)) {
    throw new InvalidPhoneError(input);
  }
  return `+91${digits}`;
}

export function isValidIndianPhone(input: string): boolean {
  return MOBILE_PATTERN.test(nationalDigits(input));
}

/** Masked for display and logs: "+919876543210" → "+91 ••••••3210". */
export function maskPhone(phone: string): string {
  const digits = nationalDigits(phone);
  return `+91 ${'•'.repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}
