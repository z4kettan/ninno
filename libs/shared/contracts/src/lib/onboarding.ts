import type { IdDocumentType } from '@ninno/utils';

export type GenderPolicy = 'MALE' | 'FEMALE' | 'CO_LIVING';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type OccupationType = 'STUDENT' | 'WORKING' | 'OTHER';
export type { IdDocumentType };

// ── Onboarding links (staff) ───────────────────────────────────────────────

/** GET /api/v1/hostels/:hostelId/onboarding-link (get-or-create) and POST …/rotate */
export interface OnboardingLinkResponse {
  hostelId: string;
  hostelName: string;
  token: string;
  /** Absolute join URL the QR code encodes, e.g. https://app.ninno.in/join/<token> */
  url: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  createdAt: string;
}

// ── Public join flow ───────────────────────────────────────────────────────

/** GET /api/v1/onboarding/:token — only what a stranger holding the QR may see. */
export interface PublicHostelResponse {
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  genderPolicy: GenderPolicy;
  amenities: string[];
  rulesText: string;
}

/** Header that carries the draft token on upload and submit requests. */
export const DRAFT_TOKEN_HEADER = 'x-draft-token';

/** POST /api/v1/onboarding/:token/drafts */
export interface CreateDraftResponse {
  draftId: string;
  /** Allows only uploading to and submitting this draft. Never a session. */
  draftToken: string;
  expiresAt: string;
}

export type UploadKind = 'selfie' | 'id-front' | 'id-back';
export type UploadContentType = 'image/jpeg' | 'image/png' | 'application/pdf';

export const UPLOAD_RULES = {
  maxBytes: 5 * 1024 * 1024,
  /** What the phone compresses images down to before uploading. */
  targetBytes: 1024 * 1024,
  maxImageSide: 2560,
  urlTtlSeconds: 600,
  contentTypes: {
    selfie: ['image/jpeg', 'image/png'],
    'id-front': ['image/jpeg', 'image/png', 'application/pdf'],
    'id-back': ['image/jpeg', 'image/png', 'application/pdf'],
  } satisfies Record<UploadKind, UploadContentType[]>,
} as const;

/** POST /api/v1/onboarding/:token/uploads (draft token header) */
export interface UploadUrlRequest {
  kind: UploadKind;
  contentType: UploadContentType;
  /** Exact size in bytes; the signed URL only accepts this size. */
  size: number;
}

export interface UploadUrlResponse {
  key: string;
  /** PUT the file here with exactly `headers`. */
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface AddressInput {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  /** 6 digits, not starting with 0. */
  pincode: string;
}

/** Everything the six steps collect. Phones are Indian mobiles in any common format. */
export interface OnboardingForm {
  fullName: string;
  /** YYYY-MM-DD */
  dob: string;
  gender: Gender;
  phone: string;
  altPhone?: string | null;
  email?: string | null;
  permanentAddress: AddressInput;
  occupationType: OccupationType;
  institutionOrCompany?: string | null;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
  idDocument: {
    type: IdDocumentType;
    /** Sent once, checked and masked by the server; never stored or logged in full. */
    idNumber: string;
  };
  /** The consent text version the resident accepted, e.g. "v1". */
  consentVersion: string;
}

export interface OnboardingFiles {
  selfieKey: string;
  idFrontKey: string;
  idBackKey?: string | null;
}

/** POST /api/v1/onboarding/:token/verify-phone (draft token header) → RequestOtpResponse */
export interface VerifyPhoneRequest {
  phone: string;
}

/** POST /api/v1/onboarding/:token/submit (draft token header) → AuthSession */
export interface SubmitOnboardingRequest {
  form: OnboardingForm;
  files: OnboardingFiles;
  /** The 6-digit SIGNUP code sent to form.phone. */
  otp: string;
}

/** Field limits shared by the join form and the API DTOs. */
export const ONBOARDING_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  textMax: 120,
  addressLineMax: 200,
  relationMax: 40,
  emailMax: 254,
} as const;

export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

/** GET /api/v1/hostels — the hostels the caller can manage in the acting organisation. */
export interface HostelSummary {
  id: string;
  name: string;
  city: string;
}
