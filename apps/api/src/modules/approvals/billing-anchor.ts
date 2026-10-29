import type { BillingMode } from '@ninno/contracts';

/**
 * The day of the month rent falls due. For check-in anniversaries this is the check-in
 * day as it is (1–31): months without that day are handled by billing, which then uses
 * the month's last day (build guide §7). Nothing is clamped here.
 */
export function billingAnchorDay(
  mode: BillingMode,
  fixedDueDay: number | null,
  checkInDate: string,
): number {
  if (mode === 'FIXED_DAY' && fixedDueDay !== null) {
    return fixedDueDay;
  }
  return Number(checkInDate.slice(8, 10));
}
