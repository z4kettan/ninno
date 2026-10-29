export type Role = 'OWNER' | 'MANAGER' | 'STAFF' | 'RESIDENT';

/** POST /api/v1/auth/otp */
export interface RequestOtpRequest {
  /** Indian mobile number in any common format, e.g. "98765 43210". */
  phone: string;
}

/** Same response whether or not the number has an account. */
export interface RequestOtpResponse {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

/** POST /api/v1/auth/otp/verify */
export interface VerifyOtpRequest {
  phone: string;
  /** 6 digits. */
  otp: string;
}

export interface MembershipSummary {
  organizationId: string;
  organizationName: string;
  /** null = organisation-wide */
  hostelId: string | null;
  hostelName: string | null;
  role: Role;
}

/** GET /api/v1/auth/me */
export interface MeResponse {
  id: string;
  name: string;
  /** e.g. "+91 ••••••3210" */
  phoneMasked: string;
  memberships: MembershipSummary[];
}

/** Returned by verify and refresh. The refresh token travels only in an httpOnly cookie. */
export interface AuthSession {
  accessToken: string;
  expiresInSeconds: number;
  user: MeResponse;
}

/** Header that selects the acting organisation when a user belongs to several. */
export const ORGANIZATION_HEADER = 'x-organization-id';
