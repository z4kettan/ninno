# Proposal

## Why

Hostels onboard residents on paper today: slow, lossy, and insecure for ID copies. A QR poster at reception lets a new resident register from their own phone in minutes, and staff review everything in one queue. This is build-guide **Phase 2** (§5, §10).

## What Changes

- Onboarding links: create, rotate and deactivate them. Each link has an unguessable token, an optional expiry and max uses, and a use counter.
- Admin "Onboarding QR" screen with the QR code rendered on the client, plus a printable A4 "Scan to join" poster.
- Public `/join/:token`: token validation, then the hostel's public info, then a 6-step form (personal, contact and address with pincode autofill, work or study, emergency contact, ID upload, review and consent). It has a progress bar and saves the draft to `localStorage`.
- **Submit is signup** (owner decision, 2026-10-28). On the review step the resident taps "Verify & submit". An OTP (purpose `SIGNUP`, through `otp-delivery` / apitxt) is sent to the phone entered in the form, and a correct code creates the User, the RESIDENT membership and the Resident (PENDING_REVIEW) in one transaction, then logs them in. If the number already belongs to an active resident of this hostel, the submission is refused with a "you're already registered, log in instead" message.
- Because uploads happen before an account exists, ID files go to a short-lived `pending/` prefix keyed by an anonymous draft token issued with the join link. They move under the resident only on successful submit, and orphaned files are purged after 24 h.
- ID upload: Aadhaar Verhoeff check with only the masked number kept, client-side compression (under 1 MB, at most 2560px), a pre-signed PUT URL to the private bucket, server-side magic-byte and size checks, and a worker that strips EXIF data and adds a "For <Hostel> KYC only" watermark.
- Consent capture with `consent_version` and a timestamp.
- Staff approvals queue: view the details, view the ID through a ≤5-minute pre-signed URL (every view is audit-logged), assign a bed, set the rent plan and check-in date, then approve or reject with a reason. Approval makes the resident ACTIVE and marks the bed OCCUPIED. Generating the first invoice is wired in Phase 3.
- A notification to staff when a submission arrives (in-app badge for now; SMS later).

## Capabilities

### New Capabilities

- `onboarding-links`: QR link lifecycle and token validation.
- `resident-onboarding`: the public self-registration flow, drafts and consent.
- `identity-documents`: secure ID capture, storage, masking, viewing and audit.
- `resident-approval`: the review queue, approve/reject, and bed and rent-plan assignment.

### Modified Capabilities

- `hostel-inventory`: beds become occupied or vacant through approval.

## Out of scope

- Invoices and staff-recorded payments (Phase 3).
- OCR or automatic ID verification.
- Data-retention purge jobs (scheduled after move-out handling exists).

## Impact

- New `onboarding`, `residents` and `documents` API modules, a BullMQ worker, and the S3/MinIO client.
- Web `onboarding` and `admin/approvals` features, with Playwright e2e covering scan → submit → approve.
