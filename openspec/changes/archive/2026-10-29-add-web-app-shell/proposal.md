# Proposal

## Why

Residents and staff need a fast, mobile-first web app before any feature screen can exist, and the visual system has to be decided once, so every later screen looks like the same product and not a generic template. The login API (phone + OTP) is now live, but nobody can use it without a screen. This is the last part of build-guide **Phase 1** (§3 frontend, §8 General and PWA, §10). Its "done when" includes "a staff user from the seed can log in" and "the PWA is installable".

## What Changes

- **Design system** in a new `libs/web/ui`, built on Angular CDK + Tailwind 4 (owner's choice over Angular Material). It follows the design-taste-frontend app style **accent-ladder** (seed 346400820):
  - **Type:** DM Sans, self-hosted with the `latin` and `latin-ext` subsets (₹ lives in `latin-ext`).
  - **Surfaces:** white cards on `#f9fafb`, no shadows at rest, no gradients.
  - **Hue:** **Backwater green** (`#0f7a5c`, chosen by the owner), only on small marks: the primary button, the active tab, badges and progress tracks.
  - **Themes:** light and dark tokens in one file.
  - **Components:** button, text and phone field, OTP input, card, sheet (CDK dialog), toast, skeleton, empty state, and the Ninno mark and wordmark.
- **One login screen for everyone.** You enter your mobile number, then the 6-digit code.
  - The code screen has a resend countdown, SMS autofill (`autocomplete="one-time-code"`, plus the WebOTP API where supported) and "Change number".
  - Errors from the API (`OTP_INVALID`, `OTP_LOCKED`, `OTP_COOLDOWN`, `OTP_DELIVERY_FAILED`, `RATE_LIMITED`) become plain-language messages.
  - Unknown numbers see the same "code sent" screen, plus a standing hint to scan their hostel's QR to join.
- **Session handling on the client.**
  - An auth service built on signals keeps the access token in memory only, never in localStorage.
  - On app start it restores the session through the refresh cookie.
  - An interceptor adds the bearer token, refreshes once on a 401 and retries.
  - Logout clears everything.
- **Routing by role.** Staff roles (owner, manager, staff) land in `/admin`, residents in `/home`, and guards keep each out of the other's area.
- **Two shells.**
  - Resident: bottom navigation with Home, Payments and Profile.
  - Staff: bottom navigation on phones (Overview, Residents, Beds, More) and a labelled sidebar from 1024px (Overview, Residents, Approvals, Beds, Payments, Settings). The hostel's name is in the shell.
  - Feature pages are placeholders with honest empty states until their phase.
- **PWA (installable web app).**
  - A manifest: name Ninno, green theme, maskable 192/512 icons drawn from the mark, standalone display.
  - An Angular service worker that caches only the app shell and static assets, never API responses or ID images.
  - An install prompt (with manual steps on iOS), an "update available" banner, and an offline screen with Retry.
- **Formatting pipes:** `inr` (paise → `₹6,500`) and `istDate` (`10 Mar 2026`), backed by `@ninno/utils`.
- **i18n-ready strings:** user-facing text marked for Angular i18n. English ships first.

## Capabilities

### New Capabilities

- `web-shell`: login screens, client session handling, role-based areas and navigation, theming and the accessibility baseline.
- `pwa`: installability, caching rules, offline behaviour and update prompts.

### Modified Capabilities

- None.

## Out of scope

- Feature screens beyond placeholders: onboarding is Phase 2, rent and payments are Phase 3. The rent cycle strip (the resident home's signature element) is built with real invoices in Phase 3.
- Web Push (later), and Hindi and Malayalam translations (the strings are marked but not translated).
- A Lighthouse PWA audit: Lighthouse 12 removed that category. Installability is checked through Chrome's own `Page.getInstallabilityErrors` in Playwright instead.

## Impact

- `apps/web`, a new `libs/web/ui` library, and new dependencies: `@angular/cdk`, `@angular/service-worker`, `@angular/localize`, Tailwind 4, `@fontsource/dm-sans`.
- Playwright e2e at a 360px phone viewport, with the API mocked at the network layer, plus a real-API smoke test run locally.
- The API is unchanged. The web app calls `/api/v1` on the same origin: through the dev proxy locally, and through the deploy's routing later.
