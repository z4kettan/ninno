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

/** Whether a string is a real calendar date in `YYYY-MM-DD` form (rejects "2026-02-30"). */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Completed years between a date of birth and a date: ageOn("2010-03-10", "2026-03-09") → 15. */
export function ageOn(dob: IsoDate, on: IsoDate): number {
  if (!isIsoDate(dob) || !isIsoDate(on)) {
    throw new RangeError('Invalid ISO date');
  }
  const [by, bm, bd] = dob.split('-').map(Number);
  const [y, m, d] = on.split('-').map(Number);
  const hadBirthday = m > bm || (m === bm && d >= bd);
  return y - by - (hadBirthday ? 0 : 1);
}

/** Residents must be at least this old to register. */
export const MIN_RESIDENT_AGE = 16;
