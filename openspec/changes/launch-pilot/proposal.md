# Proposal

## Why

The product only proves itself with real residents paying real rent. The pilot hostel needs a production deployment in India with backups, monitoring and error tracking before any personal data goes live. This is the first half of build-guide **Phase 4** (§10, §12).

## What Changes

- Production API container (Mumbai region), web on a CDN host, and managed Postgres and Redis, with all data kept in India.
- Custom domain over HTTPS, `trust proxy`, production CORS origins, and secrets in the host's secret manager.
- Daily backups plus point-in-time recovery, with a documented restore drill.
- Uptime monitoring on `/health`, and Sentry for web and API with PII scrubbing.
- Real pilot data: replace the placeholder seed YAML with the owner's §11 details, switch apitxt to the live auth key with DLT-approved OTP and reminder templates, and print the QR posters.
- A feedback channel and a short pilot checklist.

## Capabilities

### New Capabilities

- `operations`: backup, restore, monitoring and incident basics the production system must meet.

### Modified Capabilities

- `pilot-seed`: real pilot data replaces the placeholders.

## Out of scope

- Online payments (deferred by the owner; staff mark rent as paid).
- Row Level Security (needed once a second tenant signs up).

## Impact

- Hosting accounts, a domain, and Sentry and apitxt credentials (§12).
- A CD workflow added next to CI.
