import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

/** All calendar logic in Ninno runs in India Standard Time. */
export const IST_TIME_ZONE = 'Asia/Kolkata';

/** A calendar date as `YYYY-MM-DD`, the format Postgres `date` columns use. */
export type IsoDate = string;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The IST calendar date of an instant: 2026-03-09T20:00:00Z → "2026-03-10". */
export function toIstDate(instant: Date | string | number): IsoDate {
  return format(new TZDate(new Date(instant).getTime(), IST_TIME_ZONE), 'yyyy-MM-dd');
}

/** Today's date in IST. */
export function todayIst(now: Date = new Date()): IsoDate {
  return toIstDate(now);
}

/** Formats a calendar date for display: "2026-03-10" → "10 Mar 2026". */
export function formatIstDate(date: IsoDate): string {
  const match = ISO_DATE_PATTERN.exec(date);
  if (!match) {
    throw new RangeError(`Invalid ISO date: "${date}"`);
  }
  const [, y, m, d] = match;
  // Built in IST so the displayed day never shifts with the device time zone.
  return format(new TZDate(Number(y), Number(m) - 1, Number(d), IST_TIME_ZONE), 'd MMM yyyy');
}
