import type { ApprovalDetailResponse } from '@ninno/contracts';
import { formatInr } from '@ninno/utils';
import {
  approvalDefaults,
  groupBedsByRoom,
  paiseToRupeesInput,
  timeAgo,
  toApproveRequest,
} from './approval-form';

const detail = {
  defaultSecurityDepositPaise: '500000',
  vacantBeds: [
    {
      bedId: 'a',
      label: 'A',
      roomId: 'r1',
      roomNumber: '101',
      floor: 1,
      monthlyRentPaise: '650000',
    },
    {
      bedId: 'b',
      label: 'B',
      roomId: 'r1',
      roomNumber: '101',
      floor: 1,
      monthlyRentPaise: '650000',
    },
    {
      bedId: 'c',
      label: 'A',
      roomId: 'r2',
      roomNumber: '102',
      floor: 1,
      monthlyRentPaise: '800050',
    },
  ],
} as ApprovalDetailResponse;

describe('approval form', () => {
  it('proposes the room rent and the hostel deposit, in rupees', () => {
    expect(approvalDefaults(detail, 'a', '2026-03-10')).toEqual({
      bedId: 'a',
      checkInDate: '2026-03-10',
      rentRupees: '6500',
      depositRupees: '5000',
    });
    expect(approvalDefaults(detail, 'c', '2026-03-10').rentRupees).toBe('8000.50');
  });

  it('converts rupees to paise strings for the API', () => {
    const result = toApproveRequest({
      bedId: 'a',
      checkInDate: '2026-03-10',
      rentRupees: '6,500',
      depositRupees: '₹5000.5',
    });
    expect(result.request).toEqual({
      bedId: 'a',
      checkInDate: '2026-03-10',
      monthlyRentPaise: '650000',
      securityDepositPaise: '500050',
    });
  });

  it('explains what is wrong instead of sending', () => {
    const result = toApproveRequest({
      bedId: '',
      checkInDate: '',
      rentRupees: '0',
      depositRupees: 'abc',
    });
    expect(result.request).toBeNull();
    expect(Object.keys(result.errors ?? {}).sort()).toEqual([
      'bedId',
      'checkInDate',
      'depositRupees',
      'rentRupees',
    ]);
  });

  it('groups vacant beds by room for the select', () => {
    expect(groupBedsByRoom(detail.vacantBeds, (p) => formatInr(BigInt(p)))).toEqual([
      {
        label: 'Room 101 · ₹6,500 per bed',
        beds: [
          { id: 'a', label: 'Bed A' },
          { id: 'b', label: 'Bed B' },
        ],
      },
      { label: 'Room 102 · ₹8,000.50 per bed', beds: [{ id: 'c', label: 'Bed A' }] },
    ]);
  });

  it('formats paise for rupee inputs', () => {
    expect(paiseToRupeesInput('0')).toBe('0');
    expect(paiseToRupeesInput('5')).toBe('0.05');
  });

  it('says how long ago an application came in', () => {
    const now = new Date('2026-03-10T12:00:00Z');
    expect(timeAgo('2026-03-10T11:59:40Z', now)).toBe('Just now');
    expect(timeAgo('2026-03-10T11:15:00Z', now)).toBe('45 min ago');
    expect(timeAgo('2026-03-10T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-03-09T10:00:00Z', now)).toBe('Yesterday');
    expect(timeAgo('2026-03-07T12:00:00Z', now)).toBe('3 days ago');
  });
});
