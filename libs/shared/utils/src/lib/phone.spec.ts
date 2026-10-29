import {
  formatIndianPhone,
  InvalidPhoneError,
  isValidIndianPhone,
  maskPhone,
  normalizeIndianPhone,
} from './phone';

describe('normalizeIndianPhone', () => {
  it.each([
    '098765 43210',
    '9876543210',
    '+91 98765-43210',
    '919876543210',
    '+919876543210',
    '(98765) 43210',
  ])('normalises %j', (input) => {
    expect(normalizeIndianPhone(input)).toBe('+919876543210');
  });

  it.each(['5876543210', '987654321', '98765432101', '+1 4155551234', 'abc'])(
    'rejects %j',
    (input) => {
      expect(() => normalizeIndianPhone(input)).toThrow(InvalidPhoneError);
      expect(isValidIndianPhone(input)).toBe(false);
    },
  );

  it('keeps the number out of the error message', () => {
    expect(() => normalizeIndianPhone('5876543210')).toThrow('Invalid Indian mobile number');
  });
});

describe('formatIndianPhone', () => {
  it('groups the ten digits after +91', () => {
    expect(formatIndianPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatIndianPhone('98765-43210')).toBe('+91 98765 43210');
  });

  it('leaves anything else as it was', () => {
    expect(formatIndianPhone('12345')).toBe('12345');
  });
});

describe('maskPhone', () => {
  it('shows only the last four digits', () => {
    expect(maskPhone('+919876543210')).toBe('+91 ••••••3210');
  });
});
