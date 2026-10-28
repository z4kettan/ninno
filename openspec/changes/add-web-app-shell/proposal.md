# Proposal

## Why

Residents and staff need an installable, fast, mobile-first app before any feature screen can exist. The visual system (tokens, components, layouts) has to be decided once, so every later screen feels like the same product, and so it doesn't look like a generic template. This is build-guide **Phase 1** (§3 frontend, §8 General and PWA, §10).

## What Changes

- Angular 22 app shell: standalone components, signals, zoneless change detection, and lazy routes for `auth`, `resident`, `admin` and `onboarding`.
- Design system in `libs/web/ui`, built on Angular CDK + Tailwind 4 (the owner chose this over Angular Material). It has one token file for color, type, spacing, radius and motion, light and dark themes, and components for buttons, fields, cards, a sheet/dialog, toasts, skeletons, empty states and a brand wordmark. The art direction comes from the design-taste-frontend skill.
- Layouts: a resident shell with bottom navigation, and an admin shell with bottom navigation on mobile and a sidebar on desktop.
- One login screen for everyone: mobile number, then the 6-digit OTP (with a resend timer, SMS autofill via `autocomplete="one-time-code"`, and the WebOTP API where supported). After login, the user is routed to the admin or resident area based on their role. Unknown numbers see a neutral message with a hint to scan their hostel's QR to join.
- Core plumbing: an auth service built on signals, an access-token interceptor with silent refresh, an error interceptor that turns the API error envelope into toasts or inline errors, and role-aware route guards.
- PWA: a manifest (Ninno name, theme color, maskable 192/512 icons, standalone display), a service worker that caches the app shell and static assets and never API responses, an install prompt (with iOS instructions), an update-available banner, and an offline screen.
- Pipes: INR (paise → `₹6,500`) and IST date (`10 Mar 2026`), both backed by `@ninno/utils`.
- i18n-ready string handling. English ships first.

## Capabilities

### New Capabilities

- `web-shell`: navigation, layouts, theming, accessibility baseline, login screens, and the client side of session handling.
- `pwa`: installability, offline behaviour, caching rules, and update prompts.

### Modified Capabilities

- None.

## Out of scope

- Feature screens beyond placeholders (onboarding is Phase 2, rent and payments are Phase 3).
- Web Push (later).
- Hindi and Malayalam translations (the strings are ready for them, but not translated yet).

## Impact

- `apps/web`, a new `libs/web/ui` library, and `@angular/cdk`, `@angular/service-worker`, Tailwind 4 and an icon set as dependencies.
- Playwright e2e at a 360px mobile viewport, plus a Lighthouse PWA check in CI.
