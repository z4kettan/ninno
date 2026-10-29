# Design

## Context

Phase 1 is archived:

- The tables for onboarding links, residents, ID documents and rent plans already exist.
- Phone OTP has a reusable `OtpService` with a SIGNUP purpose.
- Sessions, guards and tenant scoping are in place.
- The web shell has its design system and placeholders for Approvals.

Local S3 is RustFS (`ninno-private` bucket, path-style). The owner decided: selfie required, any one ID, India Post pincode autofill, and re-application after rejection (see proposal.md).

## Goals / Non-Goals

**Goals:** a resident on a cheap phone and 3G completes registration in a few minutes. ID data is private, minimal and audited from the moment it is captured. Staff approve in one screen.

**Non-Goals:** a job queue (no BullMQ yet), OCR, and staff notifications beyond the in-app count.

## Decisions

### A draft identity before an account exists

Uploads happen before signup, so `POST /api/v1/onboarding/:token/drafts` (public, rate-limited) validates the link and returns `{ draftId, draftToken }`. `draftToken` is a 24-hour HS256 JWT (`typ: "draft"`, `sub: draftId`, `hostelId`), signed with the access secret and a distinct `typ`, so it can never act as a session. Every upload-URL request and the final submit must present it in the `x-draft-token` header, and its hostel must match the link's. The draft id names the storage folder `pending/<draftId>/`. The web app keeps the draft token in memory and in the device draft (needed to resume after a closed tab). It grants only uploading to its own folder and submitting.
_Alternative:_ upload only at submit, as one multipart request. Rejected: three photos over 3G in one request is fragile, and one failure would lose everything.

### Uploads: presigned PUT with a pinned type and length

`POST /api/v1/onboarding/:token/uploads` (draft token in the `x-draft-token` header) takes `{ kind: "selfie" | "id-front" | "id-back", contentType, size }` and returns `{ key, url, headers }`.

- The key is `pending/<draftId>/<kind>-<uuid>.<ext>`.
- The URL is signed with `PutObjectCommand` including `ContentType` and `ContentLength`, so storage rejects any other type or size. It expires in 10 minutes.
- Allowed types: selfie `image/jpeg` or `image/png`; IDs also `application/pdf`. Larger than 5 MB → `FILE_TOO_LARGE`.

Client: `<input type="file" accept="image/*" capture>` (`user` for the selfie, `environment` for IDs), then `createImageBitmap` → canvas → `toBlob('image/jpeg', q)`, with quality stepped down until the file is ≤ 1 MB and the long side ≤ 2560px. PDFs upload as they are.

### Synchronous cleaning with sharp, not a worker

At submit the API, for each referenced key:

1. `HeadObject`: confirm existence and size.
2. A ranged `GetObject` of the first 12 bytes: check JPEG `FF D8 FF`, PNG `89 50 4E 47`, PDF `%PDF`.
3. For images: download, then with `sharp` apply `.rotate()` (EXIF orientation), resize to inside 2560, and output JPEG q82. Re-encoding drops all metadata. ID images are composited with an SVG text watermark ("For <hostel> KYC only", diagonal, 20% opacity).
4. Upload to `residents/<residentId>/<kind>-<uuid>.jpg|pdf`, then delete the pending object.

This takes about 1–2 s for three images on the API host. That's fine at pilot volume, and removes Redis/BullMQ from this phase. If submit volume grows, the same function moves behind a queue unchanged.
_Alternative:_ a BullMQ worker, as the guide suggests. Deferred: one more moving part for no user-visible gain yet. The queue arrives with Phase 3's reminders.

### Submit transaction and duplicate rules

`POST /api/v1/onboarding/:token/verify-phone` (draft token) sends a SIGNUP OTP to the form's phone, with the otp-delivery cooldowns. Unlike login it is sent to any valid number, because this is signup. `POST /api/v1/onboarding/:token/submit` carries `{ form, files, otp }`:

1. Validate the DTO, the link (active, not expired, under max uses), and that the draft token's hostel matches.
2. `OtpService.verify(phone, SIGNUP, otp)`. If that fails, nothing is created.
3. Duplicate check: an existing PENDING_REVIEW or ACTIVE resident of this hostel with the phone → `409 ALREADY_REGISTERED`.
4. Pre-generate `residentId`, then clean and move the files (above).
5. In one DB transaction:
   - upsert the user by phone (name from the form only when creating)
   - create the RESIDENT membership if missing (the unique key prevents doubles)
   - create the resident (PENDING_REVIEW, consent version and time) and the identity document (masked number)
   - increment the link's use count with a guarded `updateMany` (`useCount < maxUses or maxUses is null`, `isActive`); a count of 0 rolls back with `LINK_INVALID`
   - write the audit entry `resident.applied`
6. If the transaction fails, delete the moved files (compensation).
7. Start a session exactly as login does, and return an `AuthSession`.

### Masking and Verhoeff in shared utils

`@ninno/utils` gains `isValidAadhaar` (Verhoeff), `maskIdNumber(type, number)` (`XXXX-XXXX-1234` for Aadhaar; last 4 characters for others) and `ID_TYPES_WITH_BACK`. Web and API use the same functions. Numbers are trimmed and uppercased, with spaces and hyphens removed before checking. The raw number never reaches logs (it's covered by the `idNumber` redaction path) or the database.

### Viewing documents

`GET /api/v1/residents/:id/files/:file` (`file` ∈ `selfie | id-front | id-back`), `@Roles('OWNER','MANAGER','STAFF')`, tenant-scoped. It loads the resident through the caller's organisation (and hostel, for hostel-scoped memberships), and returns 404 otherwise. It returns `{ url, expiresAt }` from `GetObjectCommand` presigned for 300 s with `ResponseContentDisposition: inline`, then writes `document.viewed` or `photo.viewed`. Images are shown with `<img src>`, and PDFs open in a new tab.

### Approvals

- `GET /api/v1/approvals` (list, oldest first), `GET /api/v1/approvals/count`, and `GET /api/v1/approvals/:id` (detail plus the vacant beds of that hostel, with room rents).
- `POST /:id/approve { bedId, checkInDate, monthlyRentPaise, securityDepositPaise }` and `POST /:id/reject { reason }` are `@Roles('OWNER','MANAGER')`.
- **Approval transaction:**
  - a guarded `updateMany` of the resident `where status = PENDING_REVIEW` (0 rows → `NOT_PENDING`)
  - a guarded bed update `where status = VACANT and hostelId` (0 → `BED_UNAVAILABLE`)
  - the rent plan
  - the ID marked VERIFIED
  - an audit entry

  The existing partial unique index on active residents per bed is the last line of defence.

- **Billing anchor day:** for CHECKIN_ANNIVERSARY, the check-in day of month as it is (1–31). Build guide §7: in months without that day, Phase 3's billing uses the month's last day, so nothing is clamped here. For FIXED_DAY, the hostel's `fixed_due_day`.
- **Money:** amounts travel as decimal strings of paise (`"650000"`) in JSON, because BigInt isn't JSON. They are validated as non-negative integers.

### Resident status

`GET /api/v1/residents/me` returns the latest application for each of the caller's resident memberships: status, hostel name, rejection reason, and room and bed labels once active. The resident home renders from it.

### Daily clean-up

`@nestjs/schedule` runs a cron at 03:30 IST. It lists `pending/` objects with `LastModified` older than 24 h and deletes them in batches. (RustFS lifecycle rules weren't verified; an explicit sweep works on any S3.)

### Web

- **`/join/:token`:** a public, lazy-loaded route with its own minimal layout (the hostel name and the Ninno mark).
- **Steps:** each is a component with typed reactive forms. A `JoinDraftStore` (signals) persists text fields and the draft token to `localStorage` under `ninno.join.<token>`, and clears it on success or when the link is invalid.
- **Pincode:** fetch with a 4 s `AbortSignal.timeout`, ignoring failures.
- **Admin `/admin/onboarding`:** generates the QR with `qrcode` (SVG string) and uses a print stylesheet (`@media print`) for the poster.
- **Admin approvals:** the list shows the count in the sidebar and in the "More" sheet. The detail page has a bed `select` grouped by room, a date input, and rent and deposit fields in rupees (converted with `rupeesToPaise`).

### Screen design (design-taste-frontend pass)

Same app style as Phase 1: accent-ladder (seed 346400820), Backwater green. The full hue goes only on small marks (the one filled button, the progress fill, the active step); its pale tints carry areas (the consent panel, selected choice cards, status pills). No shadows at rest, no gradients, DM Sans, 16px body on phones.

**Face.** The hostel itself leads the first screen: its name at title size, its address, gender policy and amenities as plain pills, and its own house rules in full. The resident sees whose register they are signing before any field. On the review step their own selfie and ID thumbnails lead, so they check what staff will see.

- **Join intro (`/join/:token`):** the Ninno mark (small), hostel name (24px, 700), address, pills, house rules, then "About 5 minutes. Keep your ID card ready." and one primary button, "Start". An invalid link shows one plain sentence ("This QR code is no longer active. Ask the hostel for the current one."), with no form.
- **Steps 1–6:** a 4px progress track (accent-track, accent fill) with "Step 2 of 6 · Contact" above it; the step title (24px) and one sentence; fields in one column; a bottom bar fixed to the viewport, holding Back (text button) and Continue (primary, wide). The draft saves silently; no "saved" toasts.
- **Choices** (gender, occupation, ID type) are radio cards: a 44px+ row with a radio dot and the label, and the selected card on accent-soft with an accent-ink label. No dropdowns for 3–6 options.
- **Photos:** a large dashed tile ("Take a selfie", "Photo of the front"). After capture it becomes the photo itself (4:3 or square) with "Retake" and a status line ("Uploading… 60%", "Uploaded", or the error with "Try again"). PDFs show as a file row.
- **Review:** a section per step with an "Edit" text button; the consent text on an accent-soft panel; one checkbox; "Verify and submit". The code step reuses `nn-otp-input` and the login page's resend countdown.
- **Status at home:** one card with a pill (Waiting for approval / Not approved / Active). Rejected: the hostel's reason, quoted, and "Scan the hostel's QR code to apply again." Active: room and bed at figure size.
- **Staff QR (`/admin/onboarding`):** the QR (SVG, 240px on phones) on a white card with the hostel name, the link in small type with "Copy", "Print poster" (primary) and "Make a new QR code" (text, with a confirmation sheet). Print view: A4, black on white, hostel name at 48pt, the QR at 120mm, "Scan to join", nothing else.
- **Approvals:** a list of rows (name, occupation, "2 days ago"); a count badge on the nav item, on accent-soft with accent-ink. The detail is one column on phones and two from 1024px (details on the left; photos, decision form on the right). The selfie is shown at the top of the details (through its view link, audited as `photo.viewed` on each open). The ID front and back are buttons that open a sheet through their view links, so every ID view is deliberate and audited. The approve form has the bed `select` grouped by room ("Room 101 · Bed A · ₹6,500"), the check-in date, and rent and deposit fields in rupees; reject opens a sheet with the reason.

New shared components in `@ninno/ui`: `nn-field` (label, hint, error around a projected native input, plus an `nnInput` directive for the input's look), `nn-choice-cards`, `nn-step-progress`, `nn-photo-tile`, `nn-pill`. Everything else reuses Phase 1 parts.

### Testing

- **Unit:** Verhoeff and masking, the magic-byte sniffer, the watermark/clean function (EXIF removed, size capped), the billing anchor day, and the web step validators and draft store.
- **API e2e (DB + S3):** the full flow over HTTP: draft → presigned PUT (uploading real bytes to RustFS) → verify-phone → submit → approvals list → view link (with an audit entry) → approve → the resident ACTIVE in a bed with a rent plan. Also duplicates, re-apply after reject, link rotation, `FILE_INVALID`, `BED_UNAVAILABLE`, `NOT_PENDING`, and tenant isolation. CI's database job gets a RustFS service.
- **Web e2e (Playwright, mocked API, 360px):** scan link → six steps (file inputs fed fixture images) → code → "waiting for approval", then staff approve. Plus the QR screen and print view.

## Risks / Trade-offs

- [The draft token in localStorage could be stolen from a shared phone] → it only allows uploading to and submitting that one draft for 24 h, never reading data.
- [Synchronous image work slows submit on a small API host] → about 1–2 s at pilot scale, with a 30 s server timeout. Move to a queue if p95 > 5 s.
- [India Post API outages or format changes] → the 4 s timeout and manual entry. Only the pincode leaves the device.
- [Consent text is a draft] → versioned `v1`, so the owner can revise it to `v2` without losing which text each resident accepted.
- [`sharp` native binaries on Windows and Linux] → prebuilt packages for both; CI verifies.

## Open Questions

- Final consent wording (owner, before the pilot). It doesn't change the code, only `CONSENT_V1` text in contracts.
