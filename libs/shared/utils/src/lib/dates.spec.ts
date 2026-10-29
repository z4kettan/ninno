import { ageOn, formatIstDate, isIsoDate, toIstDate, todayIst } from './dates';

describe('toIstDate', () => {
  it('rolls a late-evening UTC instant into the next IST day', () => {
    expect(toIstDate('2026-03-09T20:00:00Z')).toBe('2026-03-10');
  });

  it('keeps an instant just before IST midnight on the same day', () => {
    expect(toIstDate('2026-03-09T18:29:59Z')).toBe('2026-03-09');
    expect(toIstDate('2026-03-09T18:30:00Z')).toBe('2026-03-10');
  });

  it('computes today in IST', () => {
    expect(todayIst(new Date('2026-12-31T19:00:00Z'))).toBe('2027-01-01');
  });
});

describe('formatIstDate', () => {
  it('formats as D MMM YYYY', () => {
    expect(formatIstDate('2026-03-10')).toBe('10 Mar 2026');
    expect(formatIstDate('2028-02-29')).toBe('29 Feb 2028');
  });

  it('rejects malformed input', () => {
    expect(() => formatIstDate('10/03/2026')).toThrow(RangeError);
  });
});

describe('isIsoDate', () => {
  it.each(['2026-03-10', '2028-02-29'])('accepts %j', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-3-10', '10-03-2026', ''])('rejects %j', (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});

describe('ageOn', () => {
  it('counts a birthday only once it has arrived', () => {
    expect(ageOn('2010-03-10', '2026-03-09')).toBe(15);
    expect(ageOn('2010-03-10', '2026-03-10')).toBe(16);
  });

  it('treats a 29 February birthday as reached on 1 March in common years', () => {
    expect(ageOn('2008-02-29', '2024-02-28')).toBe(15);
    expect(ageOn('2008-02-29', '2024-02-29')).toBe(16);
    expect(ageOn('2008-02-29', '2025-02-28')).toBe(16);
  });

  it('rejects invalid dates', () => {
    expect(() => ageOn('2010-02-30', '2026-03-10')).toThrow(RangeError);
  });
});
