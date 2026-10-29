import type { UploadContentType } from '@ninno/contracts';

/** How many leading bytes {@link sniffContentType} needs. */
export const SNIFF_BYTES = 12;

const SIGNATURES: { type: UploadContentType; bytes: number[] }[] = [
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // "%PDF-"
  { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
];

/** The real type of a file from its first bytes, regardless of its name or declared type. */
export function sniffContentType(head: Uint8Array): UploadContentType | null {
  const match = SIGNATURES.find(({ bytes }) => bytes.every((byte, i) => head[i] === byte));
  return match?.type ?? null;
}
