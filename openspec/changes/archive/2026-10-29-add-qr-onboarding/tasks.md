# Tasks

## 1. Foundations

- [x] 1.1 Shared rules in `@ninno/utils`: `isValidAadhaar` (Verhoeff), `maskIdNumber`, `ID_TYPES_WITH_BACK`, age check; unit tests including `234123412346` valid, one wrong digit invalid, and masking per type
- [x] 1.2 Contracts in `@ninno/contracts`: onboarding form, drafts, uploads, submit, approvals, `residents/me`, the error codes (`LINK_INVALID`, `ALREADY_REGISTERED`, `FILE_TOO_LARGE`, `FILE_INVALID`, `BED_UNAVAILABLE`, `NOT_PENDING`) and the `CONSENT_V1` draft text; verify api and web compile against them
- [x] 1.3 Storage module (`@aws-sdk/client-s3`, presigner, path-style, env-validated `S3_*`), with a magic-byte sniffer and a `sharp` cleaner (rotate, strip metadata, ≤2560px, ID watermark); unit tests prove EXIF/GPS is gone and the size is capped; add RustFS to the CI database job

## 2. Onboarding links (`onboarding-links`)

- [x] 2.1 Link service and endpoints (get-or-create the active link, rotate; OWNER/MANAGER) and public `GET /onboarding/:token` with the hostel's public details; DB e2e tests for every scenario, including rotation and `LINK_INVALID` uniformity

## 3. Registration (`resident-onboarding`, `identity-documents`)

- [x] 3.1 Drafts and uploads: draft token issue and validation, presigned PUT with pinned type and length; DB+S3 e2e tests for a real upload, `FILE_TOO_LARGE`, wrong hostel, and an expired draft token
- [x] 3.2 Verify-phone and submit: SIGNUP OTP, file checks and cleaning, the transaction (user reuse, membership, resident, document, guarded use count, audit), compensation on failure, session start; DB+S3 e2e tests for success, wrong code (nothing created), `ALREADY_REGISTERED`, re-apply after rejection, staff phone reuse, `FILE_INVALID`, max uses, and that stored files have no EXIF and the DB holds only masked numbers
- [x] 3.3 Daily clean-up of `pending/` older than 24 h with `@nestjs/schedule`; a test with a back-dated object (or injected clock) deleted and a fresh one kept
- [x] 3.4 `GET /residents/me` (latest application per hostel with status, reason, bed); DB tests for pending, rejected and active

## 4. Approvals (`resident-approval`, `identity-documents`)

- [x] 4.1 Approvals list, count and detail with vacant beds; audited view links for the selfie and ID; DB+S3 e2e tests for ordering, count, the signed-link expiry ≤ 300 s, audit entries, and other-tenant 404
- [x] 4.2 Approve (guarded resident and bed updates, rent plan with anchor day, ID verified, audit) and reject (reason 5–300 characters); DB e2e tests for every scenario, including `BED_UNAVAILABLE`, `NOT_PENDING` under concurrency, and STAFF `FORBIDDEN`

## 5. Web: join flow (`resident-onboarding`)

- [x] 5.1 Design pass with the design-taste-frontend skill for the join flow and approval screens (same accent-ladder style); note any new components
- [x] 5.2 `/join/:token` shell and draft store (device persistence of text and the draft token, cleared on success or an invalid link) with unit tests
- [x] 5.3 Steps 1–4 with typed reactive forms matching the API rules, camera capture and compression for the selfie, and pincode autofill with a 4 s fallback; unit tests for validators, compression limits and the pincode fallback
- [x] 5.4 Step 5 (ID type, number with Aadhaar check, front/back as required) and step 6 (review, consent, verify code, submit, signed in → status); unit tests for the back-photo rule and consent gating
- [x] 5.5 Resident home renders pending, rejected (reason + how to re-apply) and active (room/bed) from `residents/me`

## 6. Web: staff screens (`onboarding-links`, `resident-approval`)

- [x] 6.1 `/admin/onboarding`: QR (client-side SVG), rotate with confirmation, and an A4 print poster; unit test for the print layout content
- [x] 6.2 Approvals list and detail: count in the sidebar and More sheet, selfie and ID viewing through view links, approve form (bed grouped by room, check-in date, rent and deposit defaults in ₹), and reject with reason; unit tests for the rupee→paise conversion and the form defaults
- [x] 6.3 Inspect the new screens with the design skill's inspector at 1440, 768 and 390 (light and dark); fix every FAIL and look at every screenshot

## 7. End-to-end and wrap-up

- [x] 7.1 Playwright (mocked API, 360px): scan link → six steps with fixture images → code → waiting screen; staff approve → resident active; plus the QR and print view
- [x] 7.2 Real-stack smoke with `pnpm dev`: register a new resident through the real UI and storage (code from the console), approve as the seeded owner, and confirm the resident is ACTIVE in the chosen bed; document it in the README
- [x] 7.3 Full gate green: `lint typecheck test build`, `api:test-db` with storage, `db:drift`, web e2e (repeated 5× with no flakes)
- [x] 7.4 **Owner checkpoint:** show results, screenshots and changed files, plus the draft consent text for review; commit and push after approval, then verify CI on GitHub

## Workflow follow-up

- Run `openspec validate add-qr-onboarding --strict`, then archive once all tasks are checked.
