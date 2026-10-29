/**
 * Government ID rules shared by the join form and the API. The raw ID number
 * only ever passes through these functions; what gets stored is the masked form.
 */

export const ID_DOCUMENT_TYPES = [
  'AADHAAR',
  'VOTER_ID',
  'PASSPORT',
  'DRIVING_LICENCE',
  'PAN',
  'OTHER',
] as const;

export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number];

/** Cards with information on both sides, so a back photo is required. */
export const ID_TYPES_WITH_BACK: readonly IdDocumentType[] = [
  'AADHAAR',
  'VOTER_ID',
  'DRIVING_LICENCE',
];

export function idTypeNeedsBack(type: IdDocumentType): boolean {
  return ID_TYPES_WITH_BACK.includes(type);
}

/** Trims, uppercases and removes spaces and hyphens: "2341 2341-2346" → "234123412346". */
export function normalizeIdNumber(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, '');
}

// Verhoeff checksum tables (dihedral group D5 and its permutation).
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 2, 4, 1],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function verhoeffValid(digits: string): boolean {
  let check = 0;
  const reversed = [...digits].reverse();
  reversed.forEach((char, i) => {
    check = VERHOEFF_D[check][VERHOEFF_P[i % 8][Number(char)]];
  });
  return check === 0;
}

/** 12 digits, not starting with 0 or 1 (UIDAI never issues those), with a valid Verhoeff check digit. */
export function isValidAadhaar(input: string): boolean {
  const digits = normalizeIdNumber(input);
  return /^[2-9]\d{11}$/.test(digits) && verhoeffValid(digits);
}

const GENERIC_ID_PATTERN = /^[A-Z0-9/]{5,20}$/;

/** Aadhaar must pass its checksum; other IDs must be 5–20 letters, digits or slashes. */
export function isValidIdNumber(type: IdDocumentType, input: string): boolean {
  return type === 'AADHAAR'
    ? isValidAadhaar(input)
    : GENERIC_ID_PATTERN.test(normalizeIdNumber(input));
}

/**
 * The only form of an ID number that is ever stored:
 * Aadhaar "234123412346" → "XXXX-XXXX-2346"; PAN "ABCDE1234F" → "XXXXXX234F".
 */
export function maskIdNumber(type: IdDocumentType, input: string): string {
  const value = normalizeIdNumber(input);
  if (type === 'AADHAAR') {
    return `XXXX-XXXX-${value.slice(-4)}`;
  }
  return `${'X'.repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`;
}
