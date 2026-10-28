import { formatIstDate, toIstDate, todayIst } from './dates';

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
