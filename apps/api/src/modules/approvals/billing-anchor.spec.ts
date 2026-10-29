import { billingAnchorDay } from './billing-anchor';

describe('billingAnchorDay', () => {
  it('uses the check-in day for anniversary billing, without clamping', () => {
    expect(billingAnchorDay('CHECKIN_ANNIVERSARY', null, '2026-03-10')).toBe(10);
    expect(billingAnchorDay('CHECKIN_ANNIVERSARY', null, '2026-01-31')).toBe(31);
    expect(billingAnchorDay('CHECKIN_ANNIVERSARY', 5, '2026-01-29')).toBe(29);
  });

  it("uses the hostel's day for fixed-day billing", () => {
    expect(billingAnchorDay('FIXED_DAY', 5, '2026-03-10')).toBe(5);
  });
});
