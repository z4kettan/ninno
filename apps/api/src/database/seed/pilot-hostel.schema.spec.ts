import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { parsePilotHostel, SeedDataError } from './pilot-hostel.schema';

const committedFile = () =>
  parse(readFileSync(resolve(__dirname, '../../../../../prisma/pilot-hostel.yaml'), 'utf8'));

describe('pilot hostel data file', () => {
  it('accepts the committed placeholder file', () => {
    const data = parsePilotHostel(committedFile());
    expect(data.owner.phone).toBe('+919000000002');
    expect(data.rooms.find((r) => r.number === '101')).toMatchObject({
      capacity: 2,
      monthly_rent: 650000n,
    });
    expect(data.rooms.find((r) => r.number === '202')?.capacity).toBe(6);
    expect(data.billing.security_deposit).toBe(500000n);
  });

  it('names owner.phone when the owner phone is invalid', () => {
    const raw = committedFile();
    raw.owner.phone = '12345';
    expect(() => parsePilotHostel(raw)).toThrow(SeedDataError);
    expect(() => parsePilotHostel(raw)).toThrow(/owner\.phone/);
  });

  it('requires a capacity for DORM rooms', () => {
    const raw = committedFile();
    raw.rooms.push({ number: '301', floor: 3, type: 'DORM', monthly_rent: 3000 });
    expect(() => parsePilotHostel(raw)).toThrow(/rooms\.4\.capacity/);
  });

  it('requires fixed_due_day for FIXED_DAY billing', () => {
    const raw = committedFile();
    raw.billing.mode = 'FIXED_DAY';
    expect(() => parsePilotHostel(raw)).toThrow(/billing\.fixed_due_day/);
  });

  it('rejects duplicate room numbers', () => {
    const raw = committedFile();
    raw.rooms.push({ ...raw.rooms[0] });
    expect(() => parsePilotHostel(raw)).toThrow(/room numbers must be unique/);
  });

  it('applies SEED_OWNER_PHONE', () => {
    const data = parsePilotHostel(committedFile(), { SEED_OWNER_PHONE: '9876543210' });
    expect(data.owner.phone).toBe('+919876543210');
  });

  it('rejects an invalid SEED_OWNER_PHONE', () => {
    expect(() => parsePilotHostel(committedFile(), { SEED_OWNER_PHONE: '555' })).toThrow(
      /SEED_OWNER_PHONE/,
    );
  });
});
