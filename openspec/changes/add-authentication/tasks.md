# Tasks

## 1. Schema and config

- [x] 1.1 Add `OtpChallenge` and `RefreshToken` models and generate the `add_auth` migration with `--create-only`; verify it only creates the new enum, tables, indexes and FKs (no drops or renames of existing objects)
- [x] 1.2 **Owner checkpoint:** show the full migration SQL and wait for approval (owner waived the pause on 2026-10-29; SQL shown in the session: new enum, two tables, indexes, one FK, OTP CHECKs, nothing existing touched)
- [x] 1.3 After approval, apply with `pnpm db:migrate`; verify `pnpm db:drift` reports no difference and the DB suite still passes
- [x] 1.4 Extend the env schema with `JWT_ACCESS_SECRET`, `OTP_PEPPER`, `OTP_SENDER`, `APITXT_AUTH_KEY`, `APITXT_CHANNEL`, `APITXT_TEMPLATE_ID`; unit-test that production rejects `OTP_SENDER=console` and apitxt without a key, and update `.env.example`

## 2. OTP delivery (`otp-delivery`)

- [x] 2.1 `OtpSender` interface with `ConsoleOtpSender` and `ApitxtOtpSender`; unit tests with mocked `fetch` for success, AUTH_FAILED and timeout, asserting no code or full phone in logs
- [x] 2.2 `OtpService` (issue with cooldown, hourly cap and uniform unknown-number handling; verify with expiry, single use, replacement and lockout); DB tests for every otp-delivery scenario

## 3. Login and sessions (`phone-otp-login`, `auth-sessions`)

- [x] 3.1 `AuditService` writing masked metadata; DB test that an `auth.otp_failed` entry carries no raw phone
- [ ] 3.2 `TokenService` for access JWTs and refresh rotation with reuse detection; DB tests for refresh, missing cookie, reuse and logout
- [x] 3.3 `AuthController` (`/auth/otp`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout`, `/auth/me`) with cookie handling and per-route throttles; DB e2e tests for every phone-otp-login and auth-sessions scenario

## 4. Access control (`access-control`)

- [x] 4.1 Global `JwtAuthGuard` with `@Public()`, `TenantGuard` with `@TenantScoped()`/`@Tenant()`, and `RolesGuard` with `@Roles()`; mark health and auth routes public
- [x] 4.2 DB e2e tests through a probe controller for no-token, public, single membership, foreign org, ambiguous tenant and wrong role

## 5. Contracts, docs, CI

- [x] 5.1 Auth DTO types in `@ninno/contracts` (requests, responses, error codes `OTP_INVALID`, `OTP_LOCKED`, `OTP_COOLDOWN`, `OTP_DELIVERY_FAILED`, `TENANT_REQUIRED`); verify the API compiles against them
- [x] 5.2 Manual check: with the dev stack, request an OTP for the seeded owner, read it from the console log, verify, call `/auth/me`, refresh and logout with curl; document the flow in the README
- [x] 5.3 Full gate green locally (`lint typecheck test build`, `api:test-db` and `db:drift`)
- [x] 5.4 **Owner checkpoint:** show the results and the list of changed files; commit and push only after approval, then verify CI is green on GitHub (owner waived the pause on 2026-10-29: "do not stop, continue your work")

## Workflow follow-up

- Run `openspec validate add-authentication --strict`, then archive the change once all tasks are checked.
