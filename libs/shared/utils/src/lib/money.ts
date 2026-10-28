/**
 * Money is always integer paise. Never use floating-point maths for amounts:
 * rupee strings are parsed digit by digit and paise are formatted with integer
 * division only.
 */

export class InvalidAmountError extends Error {
  constructor(input: string) {
    super(`Invalid amount: "${input}"`);
    this.name = 'InvalidAmountError';
  }
}

const RUPEE_PATTERN = /^(\d{1,13})(?:\.(\d{1,2}))?$/;

/** Parses user-entered rupees (e.g. "6,500.50") into integer paise. */
export function rupeesToPaise(input: string): number {
  const cleaned = input.trim().replace(/^₹\s*/, '').replace(/,/g, '');
  const match = RUPEE_PATTERN.exec(cleaned);
  if (!match) {
    throw new InvalidAmountError(input);
  }
  const rupees = Number(match[1]);
  const paise = Number((match[2] ?? '').padEnd(2, '0'));
  const total = rupees * 100 + paise;
  if (!Number.isSafeInteger(total)) {
    throw new InvalidAmountError(input);
  }
  return total;
}

/** Groups digits the Indian way: 1234567 → "12,34,567". */
function groupIndian(digits: string): string {
  if (digits.length <= 3) {
    return digits;
  }
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${lastThree}`;
}

/** Formats paise for display: 650000 → "₹6,500", 12345678 → "₹1,23,456.78". */
export function formatInr(paise: number | bigint): string {
  const value = BigInt(paise);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const rupees = groupIndian((abs / 100n).toString());
  const fraction = abs % 100n;
  const sign = negative ? '-' : '';
  return fraction === 0n
    ? `${sign}₹${rupees}`
    : `${sign}₹${rupees}.${fraction.toString().padStart(2, '0')}`;
}
