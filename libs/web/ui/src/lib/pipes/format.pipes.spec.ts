import { InrPipe, IstDatePipe } from './format.pipes';

describe('InrPipe', () => {
  const pipe = new InrPipe();

  it('formats paise with Indian grouping', () => {
    expect(pipe.transform(650000)).toBe('₹6,500');
    expect(pipe.transform(12345678)).toBe('₹1,23,456.78');
  });

  it('accepts bigint and the string form the API sends', () => {
    expect(pipe.transform(650000n)).toBe('₹6,500');
    expect(pipe.transform('650000')).toBe('₹6,500');
  });

  it('prints a real zero and a dash for missing values', () => {
    expect(pipe.transform(0)).toBe('₹0');
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
  });
});

describe('IstDatePipe', () => {
  const pipe = new IstDatePipe();

  it('shows a calendar date as D MMM YYYY', () => {
    expect(pipe.transform('2026-03-10')).toBe('10 Mar 2026');
  });

  it('converts instants to the IST day', () => {
    expect(pipe.transform('2026-03-09T20:00:00Z')).toBe('10 Mar 2026');
    expect(pipe.transform(new Date('2026-03-09T18:29:00Z'))).toBe('9 Mar 2026');
  });

  it('shows a dash for missing values', () => {
    expect(pipe.transform(null)).toBe('—');
  });
});
