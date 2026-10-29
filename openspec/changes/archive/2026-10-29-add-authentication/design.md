# Design

## Context

The API platform, the data model (users identified by unique E.164 phone, memberships with roles, audit log) and the pilot seed are archived (`openspec/specs/`). The owner decided that everyone logs in with phone + OTP, delivered by apitxt (see proposal.md). apitxt's API, read from its developer docs bundle and probed:

- `POST https://apitxt.com/api/sendOTP`, `application/x-www-form-urlencoded`: `authkey`, `mobile` (`91XXXXXXXXXX`), `otp` (we generate it), `channel` (`sms` default | `whatsapp` | `voice`), optional `template_id`.
- Success: `200 {"status":"success","message":"Sms OTP Sent Successfully","data":{"request_id","mobile","cost"}}`.
- Failure example: `401 {"status":"AUTH_FAILED","message":"Invalid Auth Key"}`. apitxt itself limits each number to 3 OTPs per minute.

## Goals / Non-Goals

**Goals:**

- One OTP engine reused by login now and onboarding signup next (`purpose`).
- No account enumeration through responses, timing of limits, or lockouts.

**Non-Goals:**

- Staff invitations or management UI. Pilot staff come from the seed.
- WhatsApp or voice channels (an env switch only).

## Decisions

### OTP challenges are uniform for known and unknown numbers

`POST /auth/otp` always creates (or replaces) an `OtpChallenge` row for `(phone, purpose)`, with the same cooldown and hourly cap, and returns the same `202`. Only when the phone belongs to a live user is the code actually sent. For unknown numbers the row holds the hash of a code nobody receives, so verify, attempts and lockout behave identically. This closes enumeration through the 429 or lockout behaviour.

### Hashing

Code hash = `HMAC-SHA256(OTP_PEPPER, purpose|phone|code)`, compared with `timingSafeEqual`. A database leak alone doesn't allow offline brute force of the 10⁶ space without the pepper. Refresh tokens are 32 random bytes (base64url) stored as `SHA-256(token)`. They're high-entropy, so no pepper is needed.

### Schema additions (migration `add_auth`)

- `OtpChallenge(id, phone, purpose LOGIN|SIGNUP, codeHash, attempts, expiresAt, consumedAt?, lockedAt?, lastSentAt, sendWindowStart, sendCountInWindow, delivered, createdAt)`, unique on `(phone, purpose)`. One live challenge per phone and purpose: a new request overwrites it, which implements "replaced code".
- `RefreshToken(id, userId, familyId, tokenHash unique, expiresAt, rotatedAt?, revokedAt?, createdAt, ip?, userAgent?)`, indexed on `familyId`.

### Sessions

- Access token: HS256 JWT via `@nestjs/jwt` (`sub` = user id, `typ` = `access`), 15 min, secret `JWT_ACCESS_SECRET` (≥ 32 chars, validated at startup).
- Refresh: opaque token in cookie `ninno_rt`, `httpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`, `Secure` unless `NODE_ENV=development`, 30 days for every role (owner decision, 2026-10-29). Rotation runs in one transaction: find by hash. If it's live, mark it `rotatedAt`, insert the successor in the same family, and return it. If it was already rotated or revoked, revoke the whole family and answer 401 (reuse detection).
- `cookie-parser` is added to the Express stack.

### Guards

- `JwtAuthGuard` is global (`APP_GUARD`). `@Public()` opts out. It attaches `req.user = { id }` after checking that the user exists and isn't deleted.
- `TenantGuard` + `@TenantScoped()` loads active memberships. The `X-Organization-Id` header selects among them (403 if foreign), a single membership is implied, and several without the header give 400 `TENANT_REQUIRED`. It sets `req.tenant = { organizationId, hostelId | null, role }`, and the `@Tenant()` param decorator exposes it.
- `RolesGuard` + `@Roles(...)` checks `req.tenant.role`.
- Guard order: throttler → auth → tenant → roles.

### OtpSender

`OtpSender` interface, `send(phoneE164, code): Promise<void>`, throwing `OtpDeliveryError`:

- `ApitxtOtpSender`: `fetch` with a 10 s `AbortSignal.timeout`, form body, `channel` from `APITXT_CHANNEL`, `template_id` when set. Success requires HTTP 2xx and `status === "success"`. Logs carry the masked phone, HTTP status, provider `status` and `request_id`, and never the code or the key.
- `ConsoleOtpSender`: logs `OTP for +91 ••••••3210: 123456` at warn level, in development and test only.
- Config: `OTP_SENDER` defaults to `console` in development and test and must be `apitxt` in production (validated). `APITXT_AUTH_KEY` is required when the sender is apitxt.

### Rate limits

On top of the global throttler, a second named throttler `auth` applies only to routes marked `@AuthThrottled()` (OTP request and verify): 10 requests/min per IP by default, configurable with `AUTH_RATE_LIMIT_PER_MINUTE` so tests can raise it. _Changed during implementation:_ the draft had separate 5/min and 10/min limits via `@Throttle`, but static decorator values can't be configured per environment. Per-phone limits come from the challenge row (30 s cooldown, 5 sends per rolling hour), and they protect SMS cost regardless of IP.

### Audit

An `AuditService.log({ action, organizationId?, actorUserId?, entity, entityId?, metadata, ip })` writes `audit_logs`. Auth events: `auth.otp_requested`, `auth.login`, `auth.otp_failed`, `auth.otp_locked`, `auth.logout`, `auth.refresh_reuse`. Phones in metadata are always masked.

### Testing

- Unit tests: hashing, `ApitxtOtpSender` (mocked `fetch`: success, AUTH_FAILED, timeout), and config validation for the production sender rules.
- DB e2e (`*.db.spec.ts`): the full HTTP flows with Supertest against a real app and the throwaway DB, with a capturing OTP sender. They cover every scenario in the four specs, using fake timers for expiry and cooldown.

## Risks / Trade-offs

- [SMS cost abuse] → per-IP throttles, per-phone cooldown and hourly caps, and unknown numbers never trigger a send.
- [DLT: Indian SMS needs approved templates] → apitxt's default OTP template works for testing. Production needs a DLT-approved template id in `APITXT_TEMPLATE_ID` (tracked in launch-pilot).
- [apitxt outage locks everyone out] → accepted by the owner (no password fallback). The `APITXT_CHANNEL=whatsapp` switch is the emergency lever.
- [SameSite=Strict cookie with a different web origin in production] → the web app calls the API through a same-site domain (e.g. `api.<domain>`), decided at deploy time in launch-pilot.
