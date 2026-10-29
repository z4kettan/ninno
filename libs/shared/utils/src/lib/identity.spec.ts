import {
  idTypeNeedsBack,
  isValidAadhaar,
  isValidIdNumber,
  maskIdNumber,
  normalizeIdNumber,
} from './identity';

describe('isValidAadhaar', () => {
  it.each(['234123412346', '2341 2341 2346', '2341-2341-2346', ' 234123412346 '])(
    'accepts %j',
    (input) => {
      expect(isValidAadhaar(input)).toBe(true);
    },
  );

  it('rejects every single-digit typo of a valid number', () => {
    const valid = '234123412346';
    for (let i = 0; i < valid.length; i++) {
      for (let d = 0; d <= 9; d++) {
        if (String(d) === valid[i]) continue;
        const typo = `${valid.slice(0, i)}${d}${valid.slice(i + 1)}`;
        expect(isValidAadhaar(typo)).toBe(false);
      }
    }
  });

  it('rejects swapped adjacent digits', () => {
    expect(isValidAadhaar('234123412364')).toBe(false);
  });

  it.each(['23412341234', '2341234123467', '034123412346', '134123412346', 'ABCD12341234', ''])(
    'rejects malformed %j',
    (input) => {
      expect(isValidAadhaar(input)).toBe(false);
    },
  );
});

describe('isValidIdNumber', () => {
  it('uses the Aadhaar checksum for Aadhaar', () => {
    expect(isValidIdNumber('AADHAAR', '234123412346')).toBe(true);
    expect(isValidIdNumber('AADHAAR', '234123412347')).toBe(false);
  });

  it.each([
    ['PAN', 'abcde1234f'],
    ['PASSPORT', 'M1234567'],
    ['VOTER_ID', 'ABC1234567'],
    ['DRIVING_LICENCE', 'KL07 20110012345'],
    ['OTHER', 'KL/07/123'],
  ] as const)('accepts a plausible %s', (type, value) => {
    expect(isValidIdNumber(type, value)).toBe(true);
  });

  it.each(['ABC', 'A'.repeat(21), 'AB#12345'])('rejects %j for other types', (value) => {
    expect(isValidIdNumber('PAN', value)).toBe(false);
  });
});

describe('maskIdNumber', () => {
  it('keeps only the last four Aadhaar digits', () => {
    expect(maskIdNumber('AADHAAR', '2341 2341 2346')).toBe('XXXX-XXXX-2346');
  });

  it.each([
    ['PAN', 'abcde1234f', 'XXXXXX234F'],
    ['PASSPORT', 'M1234567', 'XXXX4567'],
    ['DRIVING_LICENCE', 'KL07 20110012345', 'XXXXXXXXXXX2345'],
  ] as const)('masks %s to the last four characters', (type, value, masked) => {
    expect(maskIdNumber(type, value)).toBe(masked);
  });

  it('never contains the full Aadhaar number', () => {
    expect(maskIdNumber('AADHAAR', '234123412346')).not.toContain('23412341');
  });
});

describe('ID rules', () => {
  it('requires a back photo only for Aadhaar, Voter ID and Driving Licence', () => {
    expect(idTypeNeedsBack('AADHAAR')).toBe(true);
    expect(idTypeNeedsBack('VOTER_ID')).toBe(true);
    expect(idTypeNeedsBack('DRIVING_LICENCE')).toBe(true);
    expect(idTypeNeedsBack('PAN')).toBe(false);
    expect(idTypeNeedsBack('PASSPORT')).toBe(false);
    expect(idTypeNeedsBack('OTHER')).toBe(false);
  });

  it('normalises spacing and case', () => {
    expect(normalizeIdNumber(' ab-cd 12 ')).toBe('ABCD12');
  });
});
