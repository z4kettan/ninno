# Proposal

## Why

Hostels onboard residents on paper today, which is slow, loses forms, and leaves ID photocopies lying around. A QR poster at reception lets a new resident register from their own phone in minutes, and staff review everything in one queue. This is build-guide **Phase 2** (§5, §10). Its "done when": a phone can scan the QR, complete the form and upload an ID; staff can approve, and the resident is ACTIVE in a bed; an e2e test covers this.

## What Changes

- **Onboarding links:** one active link per hostel, which owners and managers view and rotate. Each has an unguessable token, an optional expiry and maximum uses, and a use counter. The admin "Onboarding QR" screen renders the QR on the device and offers a printable A4 "Scan to join" poster.
- **Public `/join/:token`:** shows the hostel's public details, then a 6-step form with a progress indicator. The draft is saved on the device and cleared after submitting.
  1. About you, with a **required selfie** (owner decision, 2026-10-29).
  2. Contact and permanent address, with **pincode autofill from India Post's free API** that falls back to typing (owner decision).
  3. Work or study.
  4. Emergency contact.
  5. **Any one government ID** (owner decision): front photo, plus the back for Aadhaar, Voter ID and Driving Licence.
  6. Review and consent.
- **Submit is signup** (owner decision, 2026-10-28). "Verify and submit" sends a SIGNUP code to the form's number. The correct code creates or reuses the user, adds a RESIDENT membership, and records a PENDING_REVIEW application in one step, then signs the resident in. A number with a pending or active application is refused. **Rejected applicants may re-apply** by scanning again (owner decision), and history is kept.
- **ID and selfie handling:**
  - Signed, size-limited direct uploads to the private bucket, under an anonymous per-draft folder.
  - Aadhaar Verhoeff check, with only `XXXX-XXXX-1234` stored.
  - On submit the server checks magic bytes and re-encodes images: no EXIF data, at most 2560px, and a "For <hostel> KYC only" watermark on IDs.
  - Abandoned uploads are deleted daily.
- **Staff approvals:** a queue with a count in the navigation. The detail view shows the selfie and ID through 5-minute signed links, and every view is audit-logged. Owners and managers approve by choosing a vacant bed, check-in date, rent and deposit, which makes the resident ACTIVE, the bed OCCUPIED, creates the rent plan and verifies the ID. Or they reject with a reason the applicant sees.
- **Resident home** shows the application's status: waiting, rejected (with the reason and how to re-apply), or the room and bed once active.

## Capabilities

### New Capabilities

- `onboarding-links`: QR link lifecycle, validity and the printable poster.
- `resident-onboarding`: the public self-registration flow, draft, pincode autofill, consent, signup, duplicates and the applicant's status.
- `identity-documents`: ID and selfie rules, Aadhaar masking, private uploads, server-side cleaning, audited viewing and clean-up.
- `resident-approval`: the review queue, approve with bed and rent, and reject with a reason.

### Modified Capabilities

- None. The existing tenancy and hostel-inventory rules (one active resident per bed, tenant-safe links) already cover what approval relies on.

## Out of scope

- Invoices, payments and rent reminders (Phase 3). Approval creates the rent plan only.
- OCR or automatic ID verification, and staff SMS or WhatsApp notifications (the in-app count only).
- Moving residents between beds, move-out, and data-retention purges after move-out (with move-out handling).
- The final legal wording of the consent text. A plain-language draft ships (`consent v1`) and must be reviewed by the owner before the pilot.

## Impact

- **API:** new `onboarding`, `residents`, `documents` and `storage` modules, plus `@aws-sdk/client-s3` with its presigner, `sharp` for image cleaning, and `@nestjs/schedule` for the daily clean-up. No schema change is expected: the existing tables already hold everything. Abandoned uploads are tracked by their storage folder, and any migration that turns out to be needed is reviewed before it's applied.
- **Web:** new public `join` feature, admin `onboarding` (QR + poster) and `approvals` screens, a resident home showing status, and the `qrcode` package.
- **CI:** the database job gains an S3-compatible storage service (RustFS) for the full API e2e.
