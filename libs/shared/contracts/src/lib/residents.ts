import type { IdDocumentType } from '@ninno/utils';
import type { AddressInput, Gender, OccupationType } from './onboarding';

export type ResidentStatus = 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'MOVED_OUT';
export type BillingMode = 'CHECKIN_ANNIVERSARY' | 'FIXED_DAY';
export type ResidentFile = 'selfie' | 'id-front' | 'id-back';

/**
 * Money travels as a decimal string of integer paise ("650000" = ₹6,500),
 * because the database holds BigInt and JSON has no BigInt.
 */
export type PaiseString = string;

// ── The resident's own view ────────────────────────────────────────────────

export interface MyApplication {
  residentId: string;
  hostelId: string;
  hostelName: string;
  status: ResidentStatus;
  submittedAt: string;
  rejectionReason: string | null;
  /** Set once ACTIVE. */
  roomNumber: string | null;
  bedLabel: string | null;
  checkInDate: string | null;
}

/** GET /api/v1/residents/me — the latest application per hostel, newest first. */
export interface MyApplicationsResponse {
  applications: MyApplication[];
}

// ── Staff: approvals ───────────────────────────────────────────────────────

export interface ApprovalListItem {
  residentId: string;
  hostelId: string;
  hostelName: string;
  fullName: string;
  /** e.g. "+91 ••••••3210" */
  phoneMasked: string;
  occupationType: OccupationType;
  institutionOrCompany: string | null;
  submittedAt: string;
}

/** GET /api/v1/approvals — PENDING_REVIEW applications, oldest first. */
export interface ApprovalListResponse {
  items: ApprovalListItem[];
}

/** GET /api/v1/approvals/count */
export interface ApprovalCountResponse {
  count: number;
}

export interface VacantBed {
  bedId: string;
  label: string;
  roomId: string;
  roomNumber: string;
  floor: number;
  monthlyRentPaise: PaiseString;
}

/** GET /api/v1/approvals/:residentId */
export interface ApprovalDetailResponse {
  residentId: string;
  hostelId: string;
  hostelName: string;
  status: ResidentStatus;
  submittedAt: string;
  fullName: string;
  dob: string;
  gender: Gender;
  /** Full number, so staff can call the applicant. */
  phone: string;
  altPhone: string | null;
  email: string | null;
  permanentAddress: AddressInput;
  occupationType: OccupationType;
  institutionOrCompany: string | null;
  emergencyContact: { name: string; phone: string; relation: string };
  idDocument: {
    type: IdDocumentType;
    numberMasked: string;
    hasBack: boolean;
  };
  consentVersion: string;
  consentAcceptedAt: string;
  vacantBeds: VacantBed[];
  defaultSecurityDepositPaise: PaiseString;
  billingMode: BillingMode;
  fixedDueDay: number | null;
}

/** POST /api/v1/approvals/:residentId/approve (OWNER, MANAGER) */
export interface ApproveRequest {
  bedId: string;
  /** YYYY-MM-DD */
  checkInDate: string;
  monthlyRentPaise: PaiseString;
  securityDepositPaise: PaiseString;
}

/** POST /api/v1/approvals/:residentId/reject (OWNER, MANAGER) */
export interface RejectRequest {
  /** 5–300 characters; shown to the applicant. */
  reason: string;
}

export const REJECTION_REASON_LIMITS = { min: 5, max: 300 } as const;

export interface ApprovalDecisionResponse {
  residentId: string;
  status: ResidentStatus;
}

/** GET /api/v1/residents/:residentId/files/:file — audited, short-lived link. */
export interface FileViewResponse {
  url: string;
  contentType: 'image/jpeg' | 'application/pdf';
  expiresAt: string;
}
