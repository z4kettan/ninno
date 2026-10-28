# Proposal

## Why

Hostel staff and residents both use Ninno on their phones, and neither should have to remember a password. The owner decided (2026-10-28) that **everyone logs in with their mobile number and a one-time code**, delivered through **apitxt** (https://apitxt.com). Every later endpoint also needs a trusted answer to "who is this, and which tenant and role are they acting as?" This is build-guide **Phase 1** (§2 Auth, §9, §10). It replaces the guide's staff email + password login.

## What Changes

- **Phone OTP login for all users** (OWNER, MANAGER, STAFF, RESIDENT): enter the mobile number, receive a 6-digit code by SMS, and enter the code. Codes expire after 5 minutes, allow at most 5 attempts, have a 30 s resend cooldown, and are stored only as a peppered hash.
- **Login is only for existing accounts.** An unknown number gets the same neutral "If this number is registered, you'll get a code" response (no account enumeration) and no SMS is sent. Staff accounts come from the seed, or from staff management later. **Resident accounts are created only when the onboarding form is submitted** (`add-qr-onboarding`), which is their signup.
- A reusable OTP challenge service with a `purpose` (`LOGIN`, `SIGNUP`), so onboarding can verify a number at submit with the same rules.
- `OtpSender` interface with:
  - `ApitxtOtpSender`: `POST https://apitxt.com/api/sendOTP` (form-encoded `authkey`, `mobile`=`91XXXXXXXXXX`, `otp`, `channel`, optional `template_id`). We generate and verify the code ourselves, and apitxt only delivers it. Success is `status: "success"`; anything else is a delivery failure that is logged without the code or number.
  - `ConsoleOtpSender` for development and tests (prints the code to the API log, and is never allowed when `NODE_ENV=production`).
- Sessions: a 15-minute JWT access token, plus a refresh token in an httpOnly, Secure, SameSite cookie. The refresh token rotates on every use, and reuse of an old one revokes the whole token family.
- `GET /api/v1/auth/me` returns the user, their memberships, and the active tenant context. Logout revokes the current refresh family.
- Guards: authentication is the default on every route (opt out with `@Public()`), plus a role guard and a **tenant guard** that derive organisation and hostel from the membership, never from the request body.
- Stricter rate limits on OTP routes (per IP and per phone), on top of apitxt's own limit of 3 per number per minute.
- Audit log entries for OTP requested, login success, failed verification and lockout. Phone numbers appear masked.

## Capabilities

### New Capabilities

- `phone-otp-login`: one-time-code authentication by mobile number for every role.
- `otp-delivery`: issuing, delivering (apitxt or console), and verifying one-time codes for any purpose, with expiry, attempt and cooldown rules.
- `auth-sessions`: access and refresh token lifecycle, rotation, reuse detection, logout, and the current-user endpoint.
- `access-control`: the default-deny authentication rule, role checks, and tenant scoping derived from memberships.

### Modified Capabilities

- None.

## Out of scope

- Passwords of any kind (deliberately not stored, by owner decision).
- Staff invitation and management screens (Settings, a later phase). Pilot staff come from the seed.
- WhatsApp or voice OTP. The channel is an env setting (`APITXT_CHANNEL`, default `sms`), so it can switch later without code changes.
- Postgres Row Level Security.

## Impact

- New `auth`, `users` and `audit` API modules, plus the `OtpChallenge` and `RefreshToken` tables (migration). `User.password_hash` is dropped from the §4 model.
- New env vars: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_PEPPER`, `OTP_SENDER` (`apitxt` | `console`), `APITXT_AUTH_KEY`, `APITXT_CHANNEL`, `APITXT_TEMPLATE_ID` (optional; a DLT-approved template is required for production SMS in India), `COOKIE_DOMAIN`.
- Each SMS costs wallet credits on apitxt (about ₹0.25), and the rate limits keep abuse costs bounded.
- Contracts for auth DTOs in `@ninno/contracts`, used by the web login screen.
