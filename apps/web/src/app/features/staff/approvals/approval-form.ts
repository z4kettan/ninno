import type { ApprovalDetailResponse, ApproveRequest, VacantBed } from '@ninno/contracts';
import { InvalidAmountError, rupeesToPaise } from '@ninno/utils';

export interface RoomGroup {
  label: string;
  beds: { id: string; label: string }[];
}

export interface ApprovalFormValue {
  bedId: string;
  checkInDate: string;
  rentRupees: string;
  depositRupees: string;
}

/** Paise string → what a rupee field shows: "650000" → "6500", "650050" → "6500.50". */
export function paiseToRupeesInput(paise: string): string {
  const value = BigInt(paise);
  const rupees = (value / 100n).toString();
  const fraction = value % 100n;
  return fraction === 0n ? rupees : `${rupees}.${fraction.toString().padStart(2, '0')}`;
}

/** Vacant beds for a `<select>` with one `<optgroup>` per room, rooms in order. */
export function groupBedsByRoom(
  beds: VacantBed[],
  formatRent: (paise: string) => string,
): RoomGroup[] {
  const groups = new Map<string, RoomGroup>();
  for (const bed of beds) {
    const group = groups.get(bed.roomId) ?? {
      label: $localize`Room ${bed.roomNumber}:room: · ${formatRent(bed.monthlyRentPaise)}:rent: per bed`,
      beds: [],
    };
    group.beds.push({ id: bed.bedId, label: $localize`Bed ${bed.label}:bed:` });
    groups.set(bed.roomId, group);
  }
  return [...groups.values()];
}

/** What the form proposes: the room's rent for the chosen bed and the hostel's deposit. */
export function approvalDefaults(
  detail: ApprovalDetailResponse,
  bedId: string,
  today: string,
): ApprovalFormValue {
  const bed = detail.vacantBeds.find((b) => b.bedId === bedId);
  return {
    bedId,
    checkInDate: today,
    rentRupees: bed ? paiseToRupeesInput(bed.monthlyRentPaise) : '',
    depositRupees: paiseToRupeesInput(detail.defaultSecurityDepositPaise),
  };
}

export type ApprovalFormErrors = Partial<Record<keyof ApprovalFormValue, string>>;

/** The request to send, or the field errors that stop it. */
export function toApproveRequest(
  value: ApprovalFormValue,
): { request: ApproveRequest; errors: null } | { request: null; errors: ApprovalFormErrors } {
  const errors: ApprovalFormErrors = {};
  if (!value.bedId) {
    errors.bedId = $localize`Choose a bed.`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.checkInDate)) {
    errors.checkInDate = $localize`Choose the check-in date.`;
  }
  const amount = (input: string, field: 'rentRupees' | 'depositRupees') => {
    try {
      return String(rupeesToPaise(input));
    } catch (error) {
      if (error instanceof InvalidAmountError) {
        errors[field] = $localize`Enter an amount in rupees, like 6500.`;
        return '';
      }
      throw error;
    }
  };
  const monthlyRentPaise = amount(value.rentRupees, 'rentRupees');
  const securityDepositPaise = amount(value.depositRupees, 'depositRupees');
  if (monthlyRentPaise === '0') {
    errors.rentRupees = $localize`The rent can't be zero.`;
  }
  if (Object.keys(errors).length > 0) {
    return { request: null, errors };
  }
  return {
    request: {
      bedId: value.bedId,
      checkInDate: value.checkInDate,
      monthlyRentPaise,
      securityDepositPaise,
    },
    errors: null,
  };
}

/** "Just now", "3 hours ago", "2 days ago". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return $localize`Just now`;
  if (minutes < 60) return $localize`${minutes}:count: min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? $localize`1 hour ago` : $localize`${hours}:count: hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? $localize`Yesterday` : $localize`${days}:count: days ago`;
}
