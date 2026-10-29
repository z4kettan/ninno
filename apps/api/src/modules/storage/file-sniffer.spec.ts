import { sniffContentType } from './file-sniffer';

const bytes = (...values: number[]) => Uint8Array.from(values);

describe('sniffContentType', () => {
  it('recognises JPEG, PNG and PDF by their first bytes', () => {
    expect(sniffContentType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe('image/jpeg');
    expect(sniffContentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      'image/png',
    );
    expect(sniffContentType(new TextEncoder().encode('%PDF-1.7\n'))).toBe('application/pdf');
  });

  it('rejects anything else, whatever it claims to be', () => {
    expect(sniffContentType(new TextEncoder().encode('<html><script>'))).toBeNull();
    expect(sniffContentType(bytes(0x47, 0x49, 0x46, 0x38))).toBeNull(); // GIF
    expect(sniffContentType(bytes(0xff, 0xd8))).toBeNull(); // truncated JPEG marker
    expect(sniffContentType(new Uint8Array())).toBeNull();
  });
});
