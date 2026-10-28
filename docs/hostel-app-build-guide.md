# Hostel Management App: Build Guide

> Use this file as the spec for building the app in VS Code (for example with an AI coding assistant).
> Work one phase at a time. Each phase is done only when its "Done when" checklist passes.

---

## 0. Product summary

A mobile-first SaaS for hostel owners, built as an **Angular PWA** with a **NestJS + PostgreSQL** backend.

- **Residents** scan a QR code at the hostel. It opens an onboarding form where they enter their details and upload a government ID (Aadhaar, Voter ID, etc.).
- **Hostel staff** review and approve residents, assign beds, and set rent.
- **Residents pay rent through UPI** inside the app. Tapping Pay opens their UPI app (GPay, PhonePe, Paytm, BHIM…). When the payment finishes, they come back to the app and see a success screen.
- **Staff track rent**: each resident's next due date, who is overdue, and payment history.
- **Later**: a public "nearby hostel finder" built on hostel data.

**Scope for v1:** one real hostel (the pilot hostel, see §11). The architecture must still be **multi-tenant from day one**, so adding a second hostel needs no schema rewrite.

**Market:** India only. Currency INR. Timezone `Asia/Kolkata`. Phone numbers are `+91`.

---

## 1. Guiding principles (follow throughout)

1. **Multi-tenant by default.** Every business table has an `organization_id` (and `hostel_id` where relevant). Every query is scoped by tenant. Never trust a tenant id from the client body. Derive it from the authenticated user or the signed QR token.
2. **Mobile-first, simple UI.** Large tap targets (min 44px), one main action per screen, plain language, few fields per step, works on cheap Android phones and slow 3G.
3. **Money is never a float.** Store amounts as integer **paise** (`bigint`). Format only at the UI edge.
4. **The server is the source of truth for payments.** A redirect back to the app never proves a payment. Only a **verified webhook or server-to-server status check** marks a payment as paid.
5. **Protect personal data.** ID documents are sensitive (DPDP Act 2023, UIDAI Aadhaar rules). Encrypt them, keep them private, mask them, and log every access.
6. **Type-safe end to end.** TypeScript `strict` everywhere. Share DTO and contract types between the frontend and backend.
7. **Automate quality.** Lint, format, type-check, and test in CI on every PR. No merging to `main` on red.
8. **12-factor config.** All config comes from environment variables, validated at startup. No secrets in git.

---

## 2. Tech stack

| Layer              | Choice                                                                                                                             | Notes                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Monorepo           | **Nx** (pnpm)                                                                                                                      | `apps/web`, `apps/api`, `libs/*` with shared types; affected-only CI                                         |
| Frontend           | **Angular (latest stable)**                                                                                                        | Standalone components, **signals**, new control flow (`@if`, `@for`), zoneless if stable, lazy-loaded routes |
| PWA                | `@angular/pwa` (Angular service worker)                                                                                            | Installable, offline shell, app icons, splash, update prompt                                                 |
| UI                 | **Angular Material (M3)** + **Tailwind CSS** for layout                                                                            | One design-token file for colors, spacing, and type                                                          |
| Forms              | Angular **typed reactive forms**                                                                                                   | Same validation rules as the backend, from shared lib                                                        |
| Backend            | **NestJS (latest)** on Node LTS                                                                                                    | Modular, one module per domain                                                                               |
| DB                 | **PostgreSQL 16+**                                                                                                                 |                                                                                                              |
| ORM                | **Prisma**                                                                                                                         | Migrations in git; never `db push` in prod                                                                   |
| Validation         | `class-validator` + `class-transformer` (API), global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`                   |
| Auth               | JWT access token (15 min) + rotating refresh token (httpOnly secure cookie), **argon2** for passwords, **phone OTP** for residents |
| Jobs / queues      | **BullMQ** + **Redis**                                                                                                             | Reminders, webhook processing, ID-image processing                                                           |
| File storage       | **S3-compatible** (AWS S3 `ap-south-1`, or Cloudflare R2 / MinIO in dev)                                                           | Private bucket, pre-signed URLs only                                                                         |
| Payments           | **Razorpay** (UPI Intent flow)                                                                                                     | Cashfree or PhonePe PG can replace it behind a `PaymentProvider` interface                                   |
| SMS / OTP          | MSG91 (DLT-registered templates) behind an `OtpProvider` interface                                                                 | Console provider in dev                                                                                      |
| Notifications      | SMS + WhatsApp (later), Web Push via service worker                                                                                |                                                                                                              |
| API docs           | `@nestjs/swagger` OpenAPI at `/api/docs` (non-prod only)                                                                           |                                                                                                              |
| Logging            | `nestjs-pino` (JSON logs, request ids, PII redaction)                                                                              |                                                                                                              |
| Errors             | Sentry (web + api)                                                                                                                 |                                                                                                              |
| Testing            | Jest (api unit), Supertest + Testcontainers Postgres (api e2e), Vitest/Jest (web unit), **Playwright** (web e2e, mobile viewport)  |                                                                                                              |
| Local dev          | `docker-compose` for Postgres, Redis, MinIO, Mailpit                                                                               |                                                                                                              |
| CI                 | GitHub Actions: lint → typecheck → test → build                                                                                    |                                                                                                              |
| Deploy (suggested) | API in a Docker container on Railway / Render / AWS (Mumbai region), web on Cloudflare Pages / Vercel, managed Postgres            | Keep data in India                                                                                           |

> **Project decision (2026-10-28):** all users (staff and residents) log in with phone number + OTP only, with no passwords. OTPs are delivered through **apitxt** (`POST https://apitxt.com/api/sendOTP`) instead of MSG91. A resident account is created when the onboarding form is submitted, with the OTP verified at submit.
>
> **Project decision (2026-10-28):** the UI base is Angular CDK + Tailwind with custom components in `libs/web/ui` instead of Angular Material. See `openspec/config.yaml`.

---

## 3. Repository layout

```
hostel-app/
├─ apps/
│  ├─ web/                 # Angular PWA
│  └─ api/                 # NestJS
├─ libs/
│  ├─ shared/contracts/    # DTO interfaces, enums, zod/validation rules shared by web + api
│  ├─ shared/utils/        # money (paise) helpers, date helpers (IST), phone formatting
│  └─ web/ui/              # reusable Angular UI components (buttons, cards, form fields, empty states)
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts              # seeds the pilot hostel (§11)
├─ docker-compose.yml
├─ .github/workflows/ci.yml
├─ .env.example
└─ README.md
```

### Backend module layout (`apps/api/src/modules/`)

`auth`, `users`, `organizations`, `hostels` (incl. rooms and beds), `onboarding` (QR + public form), `residents`, `documents` (ID uploads), `billing` (rent plans, invoices, due dates), `payments` (provider + webhooks), `notifications`, `audit`, `health`.

Each module: `controller` (thin) → `service` (business logic) → Prisma via a repository or the service. DTOs live in the module, and contracts are re-exported from `libs/shared/contracts`.

### Frontend structure (`apps/web/src/app/`)

```
core/        # auth service, http interceptors (auth, error, tenant), guards, app config
shared/      # pipes (inr currency, ist date), directives
features/
  onboarding/   # public QR form (no login)
  resident/     # resident home, pay rent, payment history, profile
  admin/        # staff dashboard, residents, approvals, rooms/beds, payments, settings
  auth/         # login (staff: email+password, residents: phone OTP)
```

Use lazy-loaded routes per feature, and a signal-based store per feature (or NgRx SignalStore).

---

## 4. Data model (Prisma, Postgres)

All tables: `id` (UUID v7 or cuid2), `created_at`, `updated_at`. Use soft delete (`deleted_at`) where history matters. Add indexes on every foreign key and on `(hostel_id, status)` style filters.

- **Organization**: the SaaS tenant (the hostel business). `name`, `slug`, `gstin?`.
- **Hostel**: `organization_id`, `name`, `slug`, `address_line1/2`, `city`, `state`, `pincode`, `latitude`, `longitude`, `phone`, `gender_policy` (MALE / FEMALE / CO_LIVING), `amenities` (jsonb), `is_listed_publicly` (for the future finder), `upi_vpa?`, `rules_text`.
- **Room**: `hostel_id`, `number`, `floor`, `type` (SINGLE / DOUBLE / TRIPLE / DORM), `capacity`.
- **Bed**: `room_id`, `label`, `status` (VACANT / OCCUPIED / MAINTENANCE).
- **User**: `phone` (E.164, unique), `email?`, `password_hash?` (staff only), `name`.
- **Membership**: `user_id`, `organization_id`, `hostel_id?`, `role` (OWNER / MANAGER / STAFF / RESIDENT).
- **OnboardingLink**: `hostel_id`, `token` (random, unguessable), `is_active`, `expires_at?`, `max_uses?`, `use_count`. The QR code encodes `https://<app>/join/<token>`.
- **Resident**: `user_id`, `hostel_id`, `status` (PENDING_REVIEW / ACTIVE / REJECTED / MOVED_OUT), `full_name`, `dob`, `gender`, `phone`, `alt_phone?`, `email?`, `permanent_address` (jsonb), `occupation_type` (STUDENT / WORKING / OTHER), `institution_or_company?`, `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation`, `photo_key?`, `consent_accepted_at`, `consent_version`, `check_in_date?`, `check_out_date?`, `bed_id?`, `approved_by?`, `approved_at?`.
- **IdentityDocument**: `resident_id`, `type` (AADHAAR / VOTER_ID / PASSPORT / DRIVING_LICENCE / PAN / OTHER), `number_masked` (Aadhaar shows only the last 4: `XXXX-XXXX-1234`), `number_encrypted` (only if truly needed, encrypted at app level), `front_key`, `back_key?`, `verification_status` (PENDING / VERIFIED / REJECTED), `verified_by?`, `verified_at?`, `rejection_reason?`.
- **RentPlan**: per resident. `resident_id`, `monthly_rent_paise`, `security_deposit_paise`, `billing_anchor_day` (1–28 or the actual join day, see §7), `billing_cycle` (MONTHLY for v1, with the enum ready for WEEKLY / QUARTERLY), `effective_from`, `effective_to?`.
- **Invoice** (one per rent period): `resident_id`, `hostel_id`, `period_start`, `period_end`, `due_date`, `amount_paise`, `late_fee_paise`, `status` (UPCOMING / DUE / OVERDUE / PAID / PARTIALLY_PAID / CANCELLED), `paid_at?`.
- **Payment**: `invoice_id`, `resident_id`, `hostel_id`, `amount_paise`, `provider` (RAZORPAY / CASH / MANUAL_UPI), `provider_order_id`, `provider_payment_id?`, `method` (UPI / CARD / CASH…), `upi_vpa_masked?`, `status` (CREATED / PENDING / SUCCESS / FAILED / REFUNDED), `failure_reason?`, `idempotency_key` (unique), `raw_webhook` (jsonb), `recorded_by?` (for cash entries).
- **WebhookEvent**: `provider`, `event_id` (unique, for dedupe), `payload`, `processed_at?`, `error?`.
- **AuditLog**: `actor_user_id`, `organization_id`, `action`, `entity`, `entity_id`, `metadata` (jsonb), `ip`, `created_at`. Log every view or download of an ID document.

**Next rent date** is not a stored column on the resident. It is the `due_date` of the earliest unpaid invoice, or the next invoice to be generated. Expose it as a computed field or DB view (`resident_billing_status`).

---

## 5. QR onboarding flow

1. Staff open **Admin → Onboarding QR**. The app shows the hostel's active `OnboardingLink` as a QR code (generate client-side with a QR library, and offer a **printable A4 poster** with the hostel name and the text "Scan to join").
2. The resident scans the code with their phone camera, and `https://<app>/join/<token>` opens in the browser (the PWA, if installed).
3. The API validates the token (active, not expired, under `max_uses`) and returns the hostel's public info (name, address, rules).
4. **Verify phone with OTP first.** This creates or links the `User` and proves the number is real.
5. **Multi-step form** (progress bar, autosave the draft to `localStorage` so a closed tab doesn't lose data):
   1. Personal: full name, DOB, gender, photo (camera capture).
   2. Contact and address: alternate phone, email, permanent address (pincode autofills city and state).
   3. Work or study: student / working, institution or company.
   4. Emergency contact.
   5. **ID upload**: choose the type, enter the number (Aadhaar is validated with the Verhoeff checksum and only the masked form is shown back), then capture the front and back with the camera or pick from the gallery. Compress on the client (target under 1 MB, max 2560px), and accept JPG, PNG, and PDF.
   6. Review, **consent checkbox** (clear text on why the data is collected, how long it's kept, and who can see it; store `consent_version`), and submit.
6. The resident sees "Submitted, waiting for approval", and staff get a notification.
7. **Staff approval screen**: view details, view the ID (the image loads via a short-lived pre-signed URL and the view is audit-logged), assign a bed, set the rent plan and check-in date, then **Approve** or **Reject with reason**. Approval activates the resident and generates their first invoice.

**Upload security:** the client asks the API for a pre-signed PUT URL (with content type and size limits). The file goes straight to the private bucket, and the API then verifies the magic bytes and size. A worker strips EXIF data and can watermark the image ("For <Hostel> KYC only"). Buckets are private, use server-side encryption, and never allow public reads.

---

## 6. UPI payment flow (the important part)

> **Project decision (2026-10-28): deferred.** v1 has no payment gateway. Residents pay the hostel directly (UPI to the hostel's ID, cash, or bank transfer) and staff **mark each invoice as paid** in the app. See `openspec/changes/add-rent-billing-and-manual-payments`. The flow below is kept for a future change.

**Goal:** the resident taps **Pay ₹X**, their UPI app opens, they approve, they return to the app, and they see **Payment successful**.

**Why a payment gateway (not a raw `upi://pay` link):** a bare UPI deep link can open the app, but a web app gets **no reliable confirmation** of whether money arrived. That makes it impossible to track rent correctly. A gateway such as Razorpay gives us the same "open my UPI app" experience plus signed webhooks and status APIs.

### Flow

1. Resident home shows the current invoice: amount, due date, and status. They tap **Pay ₹X via UPI**.
2. `POST /payments/orders` with `{ invoiceId }` and an `Idempotency-Key` header. The API:
   - checks that the invoice belongs to this resident and is payable,
   - calculates the amount **on the server** (never trust the client's amount),
   - creates a Razorpay Order and stores a `Payment` with status `CREATED`,
   - returns `{ orderId, amount, keyId, prefill }`.
3. The web app opens Razorpay Checkout with `method: upi` and the **UPI Intent** flow enabled. On Android mobile web, Checkout lists installed UPI apps (GPay, PhonePe, Paytm…) and opens the chosen one. On desktop it falls back to a QR code or collect request.
   - Set `callback_url` / `redirect: true` to `https://<app>/pay/return?paymentId=<ourPaymentId>` so the browser comes back to our app after the UPI app.
4. **Return page** (`/pay/return`): show a "Confirming your payment…" spinner and poll `GET /payments/:id/status` (every 2s, up to about 60s, then show "We'll update you shortly"). Never mark success based on query params alone.
5. **Server confirmation** (whichever arrives first):
   - **Webhook** `POST /webhooks/razorpay`: verify the `X-Razorpay-Signature` HMAC over the **raw body**, dedupe on event id, enqueue to BullMQ, then the worker marks the `Payment` SUCCESS or FAILED and settles the `Invoice`.
   - **Checkout handler** sends `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature` to `POST /payments/verify`, which verifies the signature and then fetches the payment from the Razorpay API to confirm `captured`.
   - Both paths go through one **idempotent** `settlePayment()` function inside a DB transaction.
6. **Success screen**: a big green tick, amount, date, a reference number, "Next rent due on <date>", and buttons for **Download receipt (PDF)** and **Done**. Failure screen: a plain-language reason and **Try again**.
7. **Reconciliation job** (every 15 min): for `PENDING` or `CREATED` payments older than 10 minutes, fetch their status from Razorpay. This catches missed webhooks.
8. Staff can also **record cash or direct UPI payments** manually (with a reference number and an audit log entry). These settle the invoice the same way.

**Abstraction:** define a `PaymentProvider` interface (`createOrder`, `verifySignature`, `fetchPayment`, `parseWebhook`, `refund`) and implement `RazorpayProvider`. Swapping to Cashfree or PhonePe PG later should only need a new class.

**Settlement:** in v1 the money settles to the pilot hostel's Razorpay account. For multi-hostel SaaS later, use **Razorpay Route** (linked accounts) so each hostel gets paid directly.

**Test mode:** use Razorpay test keys and the test UPI ids (`success@razorpay`, `failure@razorpay`) in dev and CI.

---

## 7. Rent and due-date logic

- **Billing anchor:** by default the cycle runs from the resident's **check-in date**. For example, check-in on 10 March gives periods 10 Mar–9 Apr, 10 Apr–9 May, and so on. The hostel can instead choose a **fixed day** (for example, everyone pays on the 1st, with the first month pro-rated). Make this a hostel setting: `billing_mode = CHECKIN_ANNIVERSARY | FIXED_DAY`.
- **Month-end edge case:** if the anchor day doesn't exist in a month (the 31st, or the 29th to 31st in February), use the last day of that month. Use a date library (`date-fns` + `date-fns-tz`) and always calculate in **IST**. Store dates as `date` and timestamps as `timestamptz`.
- **Due date** = `period_start + grace_days` (hostel setting, default 5).
- **Invoice generation job** (daily at 00:15 IST): create the next invoice `N` days before the period starts (default 7). Make it idempotent with a unique `(resident_id, period_start)`.
- **Status job** (daily): UPCOMING → DUE on the due date → OVERDUE after it. Optional late fee rule (flat or per day, with a cap), off by default.
- **Paying early** pays the earliest open invoice first. Partial payments are allowed only if the hostel enables them.
- **Rent change:** a new `RentPlan` row with `effective_from`. Future invoices use it, and past invoices never change.
- **Move-out:** set `check_out_date`, cancel future invoices, and optionally pro-rate the final one. Track the security deposit refund.
- Write **thorough unit tests** for this module (month ends, leap years, plan changes, move-outs, and mid-cycle check-ins).

---

## 8. Screens (UI/UX)

**General:** bottom navigation on mobile and a sidebar on desktop. Skeleton loaders, friendly empty states, toasts for success, and inline errors under fields. Dates look like `10 Mar 2026` and money like `₹6,500`. Support light and dark themes, meet WCAG AA contrast, and work with screen readers. Plan for **i18n** from the start (Angular i18n or Transloco): English first, Hindi and Malayalam next.

**Resident app**

- **Home:** a large card saying "Rent ₹6,500 due in 4 days" with a **Pay now** button, plus room and bed info and hostel contact.
- **Payments:** history list, receipt download.
- **Profile:** details, documents (status only, with the number masked), emergency contact.
- **Notices:** hostel announcements (later).

**Staff / admin**

- **Dashboard:** KPI tiles (occupancy %, collected this month, due this week, overdue count and amount) and a "Needs attention" list (pending approvals, overdue residents).
- **Residents:** searchable list with filters (status, due, overdue) and a resident detail page with tabs (Profile, Documents, Rent, Payments, Activity).
- **Approvals queue.**
- **Rooms and beds:** a grid showing vacant and occupied beds, and assigning or moving a resident.
- **Payments:** list, record a cash payment, export CSV.
- **Onboarding QR:** show, print, and rotate the link.
- **Settings:** hostel profile, billing mode, grace days, late fees, staff users and roles.

**PWA**

- Manifest with name, short name, theme color, and maskable icons (192, 512). `display: standalone`.
- Service worker: cache the app shell and static assets, use network-first for API calls, and never cache ID images or payment responses.
- An "Install app" prompt (handle `beforeinstallprompt`, and show manual instructions on iOS).
- An update-available banner (`SwUpdate`).
- An offline screen with retry.
- Web Push for rent reminders (later phase).

---

## 9. Security checklist

- `helmet`, strict CORS (only the web origin), rate limiting (`@nestjs/throttler`, stricter on OTP and login), and request body size limits.
- OTP: 6 digits, 5-minute expiry, max 5 attempts, a resend cooldown, and stored as a hash.
- RBAC guard plus a **tenant guard** on every route. Add Postgres **Row Level Security** as a second layer once more than one hostel exists.
- Validate all input on the API. Use Prisma parameterized queries (no raw SQL with string concatenation).
- Store ID documents encrypted at rest. Pre-signed URLs expire in 5 minutes or less. Audit log every view.
- **Never store the full Aadhaar number in plain text.** Store the masked version, plus app-level encryption only if there's a real business need.
- Data retention: delete or archive ID documents N months after move-out (configurable), and provide a "delete my data" request path.
- PII redaction in logs (phone, Aadhaar, address). Secrets live only in env or a secret manager.
- Webhook endpoint: raw-body signature check, idempotent, and returns 2xx quickly.
- Dependency scanning (Dependabot / `pnpm audit`) in CI.

---

## 10. Build phases

### Phase 1: Foundations

- Nx monorepo with pnpm, ESLint + Prettier, strict TS, commit hooks (husky + lint-staged + commitlint).
- `docker-compose` with Postgres, Redis, MinIO, and Mailpit. `.env.example`, plus config validation at API startup.
- NestJS app: config module, Prisma module, pino logger, global validation pipe, exception filter (consistent error shape `{ code, message, details }`), `/health` endpoint, Swagger, API versioning (`/api/v1`).
- Prisma schema for all models in §4, the first migration, and a seed script for the pilot hostel.
- Auth: staff email + password, resident phone OTP, JWT + refresh rotation, roles, and tenant guard.
- Angular app: routing, Material theme + Tailwind, auth interceptors and guards, layout shells (resident and admin), and the PWA setup.
- GitHub Actions CI.
- **Done when:** `pnpm dev` runs web + api locally, a staff user from the seed can log in, CI is green, and Lighthouse shows the PWA as installable.

### Phase 2: QR onboarding

- OnboardingLink CRUD, QR display and printable poster.
- Public `/join/:token` multi-step form with OTP, draft autosave, camera capture, and ID upload via pre-signed URL.
- Approvals queue, bed assignment, and rent plan setup on approval.
- **Done when:** a phone can scan the QR, complete the form, and upload an ID, and staff can approve and see the resident as ACTIVE in a bed. e2e test covers this.

### Phase 3: Rent and UPI payments

- Billing module (§7), with jobs on BullMQ.
- Razorpay integration (§6): orders, checkout with UPI Intent, return page, webhook, verify, reconciliation job, receipts as PDF.
- Manual cash entry. Resident home and payment history. Staff dashboard KPIs, due and overdue lists, and CSV export.
- Rent reminders by SMS (3 days before, on the due date, and when overdue).
- **Done when:** in Razorpay test mode, a resident on an Android phone taps Pay, their UPI app opens, they approve, they return to the success screen, the invoice shows PAID, and the next due date updates. Webhook replay doesn't double-count.

### Phase 4: Pilot launch, then the hostel finder

- Deploy to production (India region), with a custom domain over HTTPS, backups (daily plus point-in-time recovery), uptime monitoring, and Sentry.
- Onboard the pilot hostel's real residents and collect feedback.
- **Hostel finder (next):** a public `/find` page with a map (Leaflet + OpenStreetMap, or Google Maps), a "near me" search using browser geolocation, and PostGIS (`earthdistance` or a `geography(Point)` column with a GiST index). Filters: gender policy, price range, and amenities. Only hostels with `is_listed_publicly = true` appear, and only public fields are shown (never resident data). Each hostel gets an SEO-friendly page (consider Angular SSR for that route).

---

## 11. Pilot hostel details (fill these in)

The seed script (`prisma/seed.ts`) should create this hostel, its rooms and beds, and an OWNER login.

```yaml
organization_name: '<business name>'
hostel_name: '<hostel name>'
address: '<street, area>'
city: '<city>'
state: '<state>'
pincode: '<pincode>'
latitude: <lat>
longitude: <lng>
phone: '+91XXXXXXXXXX'
gender_policy: MALE | FEMALE | CO_LIVING
billing_mode: CHECKIN_ANNIVERSARY | FIXED_DAY
fixed_due_day: <1-28, if FIXED_DAY>
grace_days: 5
security_deposit: <₹>
rooms:
  - number: '101'
    floor: 1
    type: DOUBLE
    monthly_rent: <₹ per bed>
  # ...
owner:
  name: '<owner name>'
  email: '<owner email>'
  phone: '+91XXXXXXXXXX'
amenities: [wifi, food, laundry, ac, parking, power_backup]
```

---

## 12. Accounts and keys you'll need

- **Razorpay** account (KYC with the hostel's business or bank details). Test keys work immediately.
- **MSG91** (or similar) for OTP SMS. In India, SMS needs **DLT registration** of the sender id and templates, which can take a few days, so start early.
- An **S3** bucket in `ap-south-1` (or Cloudflare R2).
- **Sentry** project, a domain name, and a hosting account.

---

## 13. Definition of done (every feature)

- Typed DTOs with validation on the API, and matching form validation on the web.
- Tenant- and role-guarded endpoints.
- Unit tests for the business logic, and an e2e test for the main path.
- Works at 360px width, is keyboard accessible, and has loading, empty, and error states.
- No PII in logs, and an audit log entry for sensitive actions.
- Swagger docs updated. CI is green.
