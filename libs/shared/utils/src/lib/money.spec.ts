import { formatInr, InvalidAmountError, rupeesToPaise } from './money';

describe('rupeesToPaise', () => {
  it('converts rupees with paise', () => {
    expect(rupeesToPaise('6500.50')).toBe(650050);
  });

  it('accepts whole rupees, one decimal, commas and the ₹ symbol', () => {
    expect(rupeesToPaise('6500')).toBe(650000);
    expect(rupeesToPaise('0.5')).toBe(50);
    expect(rupeesToPaise('₹ 1,23,456.78')).toBe(12345678);
  });

  it('avoids floating-point drift', () => {
    expect(rupeesToPaise('0.29')).toBe(29);
    expect(rupeesToPaise('1.15')).toBe(115);
  });

  it.each(['10.005', '-5', 'abc', '', '1.2.3', '1e3'])('rejects %j', (input) => {
    expect(() => rupeesToPaise(input)).toThrow(InvalidAmountError);
  });
});

describe('formatInr', () => {
  it('omits decimals for whole rupees', () => {
    expect(formatInr(650000)).toBe('₹6,500');
  });

  it('uses lakh grouping and two decimals', () => {
    expect(formatInr(12345678)).toBe('₹1,23,456.78');
  });

  it('pads single-digit paise and handles small and bigint values', () => {
    expect(formatInr(105)).toBe('₹1.05');
    expect(formatInr(0)).toBe('₹0');
    expect(formatInr(1000000000n)).toBe('₹1,00,00,000');
  });
});
