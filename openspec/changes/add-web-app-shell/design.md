# Design

## Context

`apps/web` is the bare Nx-generated Angular 22 app (zoneless, standalone, esbuild, Vitest, Playwright at port 4300, `/api` proxied to the API on 127.0.0.1:3000). The API's auth endpoints are archived in `openspec/specs/{phone-otp-login,auth-sessions,access-control}`. The refresh token lives in an httpOnly, SameSite=Strict cookie on `/api/v1/auth`, so the web app must call the API on the same site. Visual direction is fixed in `openspec/config.yaml`: accent-ladder, DM Sans, Backwater green. The owner previewed it at `.taste-skill/preview/hues.html`.

## Goals / Non-Goals

**Goals:** a seeded owner can install the app, sign in with an OTP and land in a shell that already looks like Ninno, with every later screen inheriting tokens, components and session handling.

**Non-Goals:** feature data (residents, rooms, rent), Web Push, translations.

## Decisions

### Tokens first, Tailwind as the delivery mechanism

`libs/web/ui/src/styles/tokens.css` defines the sheet's roles as CSS custom properties, with dark values under `@media (prefers-color-scheme: dark)`. Tailwind 4 (`@tailwindcss/postcss`, configured through `apps/web/.postcssrc.json`) maps them with `@theme inline` (`--color-accent: var(--accent)`, …), so components use utilities like `bg-surface text-muted`, and nothing hard-codes a hex value outside the token file.

- **Dark tokens:** the app-screens defaults, with the green ladder lifted for dark: accent `#3fbf95`, soft `#10241d`, ink `#a7e9d2`. Each was checked for 4.5:1.
- **Radii:** card 8px, control 6px, pills fully round.
- **Spacing:** 16px phone margins, 44px minimum tap targets.

### Self-hosted DM Sans with the ₹ subset

`@fontsource/dm-sans` provides weights 400, 500, 600 and 700. We import both its `latin` and `latin-ext` faces. Verified: U+20B9 (₹) is only in `latin-ext`, and the browser downloads that file only when a ₹ appears, thanks to `unicode-range`. Self-hosting lets the service worker cache the fonts, so they work offline and on 3G, and avoids a Google Fonts round trip.
_Alternative:_ Google Fonts CDN. Rejected: no offline support, plus an extra origin on slow networks.

### Components in `libs/web/ui`

Standalone, OnPush, signal inputs, Angular CDK for the hard parts:

- `nn-button` (primary, secondary, text, and a loading state)
- `nn-phone-field` (fixed +91 prefix, `inputmode="numeric"`, `autocomplete="tel-national"`)
- `nn-otp-input` (6 boxes over one hidden real `<input autocomplete="one-time-code">`, so SMS autofill and paste both work, plus the WebOTP `navigator.credentials.get({otp})` where supported)
- `nn-card`, `nn-empty-state`, `nn-skeleton` (flat bars at real size, no shimmer)
- `nn-toast` (a fixed `aria-live="polite"` region placed once in the app root; _changed during implementation_ from a CDK overlay, which was simpler and equally accessible)
- `nn-sheet` (CDK Dialog as a bottom sheet on phones)
- `nn-mark` (the "n" monogram on a green square, inline SVG)

Icons are a small set of inline 1.6px-stroke outline SVGs, so there is no icon-font download.

### Session handling

`AuthStore` (signals) keeps `status: 'unknown' | 'signedIn' | 'signedOut'`, `user` (`MeResponse`) and the access token, **in memory only**.

- **On start:** `provideAppInitializer` calls `POST /api/v1/auth/refresh` once. Success means signed in; a 401 means signed out. A splash with the mark shows meanwhile.
- **Interceptor:** an `HttpInterceptorFn` adds `Authorization` to `/api/v1/**` (except the auth routes). On a 401 it runs one shared refresh (concurrent 401s wait on the same promise) and retries once. A failed refresh means sign out, then navigate to `/login?next=`.
- **Errors:** an error helper maps the API envelope `{code, message}` to the screen's plain-language text, so components never parse HTTP errors themselves.
- **Logout:** `POST /auth/logout`, clear the store, go to `/login`.

### Routing and guards

```
/login                     public; signed-in users are bounced to their area
/home        (resident)    ResidentShell → '', payments, profile
/admin       (staff)       StaffShell   → '', residents, approvals, beds, payments, settings, more
''                         → area by role
```

Functional `canMatch` guards (`signedIn`, `staffArea`, `residentArea`) read the `AuthStore`. A user's area comes from their memberships: any OWNER, MANAGER or STAFF role means staff. A user with both staff and resident memberships lands in staff, and the resident area remains reachable only if they hold a RESIDENT membership. Every feature route is lazy-loaded.

### Shell layout

- **Phones:** a 56px title row (the hostel name or page title), content with 16px margins, and a bottom tab bar of 3–4 tabs, each 44px tall. The active tab gets the soft-tint pill with ink text and a hue icon.
- **From 1024px (staff):** a 240px labelled sidebar on the page ground with a 1px hairline. The mark and "Ninno" sit at the top, with the hostel's name under them. Nav rows are on a 34px pitch, the active row is the soft-tint pill, and the user row with "Sign out" sits at the bottom. There is no top bar, and the page title is an h1 at 24px.
- **"More" (phone, staff):** a sheet listing Approvals, Payments, Settings and Sign out.

### PWA

- **Service worker:** `ng add @angular/pwa` style, but configured by hand. `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' })`.
- **`ngsw-config.json`:** an `app` group (prefetch) for index, JS and CSS, and an `assets` group (lazy, then update) for fonts and icons. **No `dataGroups`**, so API responses are never cached. `navigationUrls` exclude `/api/**`.
- **Icons:** PNGs (192, 512, maskable 192/512, Apple touch 180) rendered from the mark's SVG by `tools/render-icons.mjs` (headless Chrome, a dev-time script). The PNGs are committed.
- **Install prompt:** an `InstallPrompt` service captures `beforeinstallprompt` and shows a bottom card once. Dismissal is stored in `localStorage` (`ninno.install.dismissed`), a per-device convenience wrapped in try/catch. iOS Safari is detected and shown the manual "Share → Add to Home Screen" steps.
- **Update banner:** `SwUpdate.versionUpdates` `VERSION_READY` triggers the banner, and "Reload" calls `document.location.reload()`.
- **Offline:** an `online`/`offline` listener plus API status-0 failures drive an `Offline` signal. When it's set and the screen has no data, the offline view shows, with a Retry that re-runs the last failed load.

### i18n

`@angular/localize` with `i18n` attributes in templates and `$localize` in code. Only English is built now; the extraction (`ng extract-i18n`) works when Hindi and Malayalam arrive.

### Testing

- **Unit (Vitest):** AuthStore restore, refresh-once, logout; the interceptor (single shared refresh, retry once, sign-out on failure); guards; error mapping; the OTP input (typing, paste, backspace, autofill); pipes.
- **e2e (Playwright, 360×740 Chromium):** API calls mocked with `page.route`. Covers login → staff area, login → resident area, wrong code, locked, deep-link return, refresh-cookie restore, and no tokens in web storage.
- **Installability:** a Playwright test against the production build served statically calls CDP `Page.getInstallabilityErrors` and expects none. It also checks that the service worker never stores `/api/` responses.
- **Real-stack smoke (local, documented):** with `pnpm dev`, sign in as the seeded owner with the console OTP.

## Risks / Trade-offs

- [The app-start refresh adds a round trip on 3G] → a branded splash, and the refresh call is tiny. A later improvement could render the shell optimistically.
- [The service worker serves stale code after a deploy] → the update banner, `registerWhenStable`, and `ngsw` hashing. Never cache API data.
- [The hidden-input OTP pattern is fiddly with screen readers] → the real input is labelled ("6-digit code") and the boxes are `aria-hidden`.
- [Tailwind 4 + Angular build integration is new] → PostCSS is the documented path. If it misbehaves, the tokens still work as plain CSS variables.
