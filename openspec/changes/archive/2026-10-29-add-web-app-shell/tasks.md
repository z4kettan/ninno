# Tasks

## 1. Foundations

- [x] 1.1 Add `@angular/cdk`, `@angular/service-worker`, `@angular/localize`, Tailwind 4 (`tailwindcss`, `@tailwindcss/postcss`) and `@fontsource/dm-sans`; configure PostCSS for `apps/web`; verify `nx build web` succeeds with a Tailwind utility in a template
- [x] 1.2 Create `libs/web/ui` (`@ninno/ui`, tags `scope:web,type:lib`) with `tokens.css` (light + dark), the `@theme inline` mapping and DM Sans latin + latin-ext imports; verify the ₹ renders in DM Sans in a built page
- [x] 1.3 Remove the Nx welcome page; set the document title, `lang="en"`, theme-color meta and viewport; verify the app boots blank with tokens applied

## 2. UI components (`web-shell`)

- [x] 2.1 `nn-mark`, `nn-button`, `nn-card`, `nn-empty-state`, `nn-skeleton` with unit tests for button states (disabled, loading) and accessible names
- [x] 2.2 `nn-phone-field` and `nn-otp-input` (hidden real input, paste, backspace, autofill, WebOTP where available) with unit tests for typing, paste and backspace
- [x] 2.3 `nn-toast` (fixed aria-live region) and `nn-sheet` (CDK Dialog bottom sheet) with unit tests for open, close and focus return
- [x] 2.4 `inr` and `istDate` pipes over `@ninno/utils`; unit tests for `650000 → ₹6,500` and `2026-03-10 → 10 Mar 2026`

## 3. Session handling (`web-shell`)

- [x] 3.1 `AuthStore` (signals, in-memory token) with app-start restore through `/auth/refresh`; unit tests for restore success, restore 401 and logout
- [x] 3.2 Auth interceptor (bearer on `/api/v1`, one shared refresh on 401, retry once, sign out on failure) and API error mapping; unit tests for concurrent 401s, retry and sign-out
- [x] 3.3 Guards (`signedIn`, `staffArea`, `residentArea`, login bounce) and role-based landing; unit tests for each redirect

## 4. Screens (`web-shell`)

- [x] 4.1 Login: phone step and code step (countdown, change number, error messages, locked → "Send a new code"); unit tests for the error-to-message mapping and the countdown
- [x] 4.2 Resident shell (bottom tabs) with Home, Payments and Profile placeholders (honest empty states; Profile shows the name, masked phone and Sign out)
- [x] 4.3 Staff shell (bottom tabs below 1024px, sidebar from 1024px, hostel name, More sheet) with Overview, Residents, Approvals, Beds, Payments and Settings placeholders
- [x] 4.4 Check the shells and login with the design skill's inspector (`inspect.mjs --app`) at 1440, 768 and 390; fix every FAIL and look at every screenshot (light and dark)

## 5. PWA (`pwa`)

- [x] 5.1 Manifest, icons rendered from the mark (`tools/render-icons.mjs`), `ngsw-config.json` (app shell + assets only, no data groups, `/api/**` excluded from navigation) and `provideServiceWorker` for production
- [x] 5.2 Install prompt (once per device, iOS manual steps), update banner (`VERSION_READY` → Reload) and offline screen with Retry; unit tests for the once-per-device rule and the update banner

## 6. End-to-end and wrap-up

- [x] 6.1 Playwright at 360×740 with a mocked API: owner → staff overview, resident → home, wrong code, locked, deep link returns after login, session restored on reload, nothing in web storage
- [x] 6.2 Playwright against the production build: Chrome `Page.getInstallabilityErrors` is empty, and no `/api/` response is stored in the service-worker caches
- [x] 6.3 Real-stack smoke: with `pnpm dev`, sign in as the seeded owner using the console OTP and reach the staff overview; document it in the README
- [x] 6.4 Full gate green (`lint typecheck test build`, `api:test-db`, `db:drift`, `e2e`) and add the web e2e step to CI
- [x] 6.5 **Owner checkpoint:** show screenshots, results and changed files; commit and push after approval, then verify CI on GitHub (owner tried the login locally and said "ok continue the work", 2026-10-29)

## Workflow follow-up

- Run `openspec validate add-web-app-shell --strict`, then archive the change once all tasks are checked. Phase 1's "done when" is then met.
