import { Pipe, type PipeTransform } from '@angular/core';
import { formatInr, formatIstDate, toIstDate } from '@ninno/utils';

/** Paise to "₹6,500" / "₹1,23,456.78". A missing value is an em dash, never a fake zero. */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(paise: number | bigint | string | null | undefined): string {
    if (paise === null || paise === undefined || paise === '') {
      return '—';
    }
    return formatInr(typeof paise === 'string' ? BigInt(paise) : paise);
  }
}

/** A calendar date ("2026-03-10") or an instant, shown as "10 Mar 2026" in IST. */
@Pipe({ name: 'istDate' })
export class IstDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) {
      return '—';
    }
    const isCalendarDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    return formatIstDate(isCalendarDate ? value : toIstDate(value));
  }
}
