# Ninno

Hostel management for India: QR onboarding for residents, rent tracking for staff, phone + OTP login for everyone.

- **Product spec:** [docs/hostel-app-build-guide.md](docs/hostel-app-build-guide.md). Owner decisions that override it are recorded in [openspec/config.yaml](openspec/config.yaml).
- **Change history and plans:** [openspec/](openspec/). See [How we work](#how-we-work-openspec).

## Stack

| Part             | Tech                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| Monorepo         | Nx 24, pnpm 12                                                           |
| Web (`apps/web`) | Angular 22 (standalone, signals, zoneless), Angular CDK + Tailwind, PWA  |
| API (`apps/api`) | NestJS 11, Prisma + PostgreSQL 17, Redis/BullMQ                          |
| Shared           | `@ninno/contracts` (API types), `@ninno/utils` (paise, IST dates, phone) |
| Local infra      | Docker Compose: Postgres, Redis, RustFS (S3), Mailpit                    |

## Prerequisites

- Node 24 (`.nvmrc`) and pnpm 12 (`corepack enable` picks the version from `package.json`)
- Docker Desktop, running

## Getting started

```sh
pnpm install
cp .env.example .env        # local defaults; never commit .env
pnpm infra:up               # Postgres, Redis, S3 (private bucket), Mailpit
pnpm dev                    # API on http://localhost:3000, web on http://localhost:4300
```

Check that it's up:

- API health: http://localhost:3000/health
- API docs (non-production only): http://localhost:3000/api/docs
- Web app: http://localhost:4300 (it proxies `/api/*` to the API)
- Mailpit inbox: http://localhost:8025
- S3 console: http://localhost:9001 (user `ninno`, password `ninno-dev-secret`)

Stop the infrastructure with `pnpm infra:down` (data persists in Docker volumes).

## Database

Postgres runs in Docker on host port **5433**, not 5432, so it doesn't clash with a locally installed PostgreSQL. The schema lives in [prisma/schema.prisma](prisma/schema.prisma), and migrations are in `prisma/migrations/` (committed).

```sh
pnpm db:migrate                        # apply committed migrations (non-destructive)
pnpm db:seed                           # create/update the pilot hostel from prisma/pilot-hostel.yaml
pnpm db:migrate:new --name add_thing   # after editing schema.prisma: write a new migration to review
pnpm db:reset                          # DESTRUCTIVE: wipe the dev DB, re-migrate and re-seed
pnpm db:studio                         # browse data
```

- **Pilot data:** [prisma/pilot-hostel.yaml](prisma/pilot-hostel.yaml) holds placeholder values until the real hostel details arrive. Edit it and re-run `pnpm db:seed`. The seed updates changed values and never deletes rooms or beds.
- **Log in as the owner locally:** set `SEED_OWNER_PHONE=<your number>` in `.env`, then run `pnpm db:seed`.
- **Tenant safety:** child rows reference parents through composite `(id, organization_id)` keys, so the database itself rejects cross-hostel links. Some constraints (CHECKs, partial indexes, a view) are hand-written in the migration SQL.
- **DB tests:** `pnpm exec nx run api:test-db` creates a throwaway `ninno_test_<timestamp>_<pid>` database, migrates it, runs `*.db.spec.ts`, and drops it. No existing database is touched.
- **Schema drift:** `pnpm db:drift` fails if the database differs from `schema.prisma`. CI runs it on every push.

## Logging in (phone + OTP)

Everyone (owners, staff and residents) logs in with their mobile number and a 6-digit code. There are no passwords.

- **Locally**, `OTP_SENDER=console` prints the code in the API log instead of sending an SMS:
  `[dev] OTP for +91 ••••••0002 is 520648`
- **Real SMS** goes through [apitxt](https://apitxt.com). Set `OTP_SENDER=apitxt` and `APITXT_AUTH_KEY` in `.env`, never in git. Production refuses to start without them, and Indian production SMS also needs a DLT-approved `APITXT_TEMPLATE_ID`.
- Login codes go only to existing accounts. Unknown numbers get the same reply but no SMS. Staff accounts come from the seed for now; residents sign up through the join form (below), which sends its own code to any valid number.

**In the app:** run `pnpm dev`, open http://localhost:4300, enter `90000 00002` (the seeded owner, or your `SEED_OWNER_PHONE`), and type the code from the API log. Owners, managers and staff land on `/admin`, residents on `/home`. The session survives reloads through the refresh cookie. The access token lives only in memory.

Or with curl:

```sh
curl -X POST localhost:3000/api/v1/auth/otp -H 'content-type: application/json' -d '{"phone":"90000 00002"}'
# read the code from the API log, then:
curl -c jar.txt -X POST localhost:3000/api/v1/auth/otp/verify -H 'content-type: application/json' \
  -d '{"phone":"+919000000002","otp":"<code>"}'        # → accessToken (15 min) + refresh cookie (30 days)
curl localhost:3000/api/v1/auth/me -H 'Authorization: Bearer <accessToken>'
curl -b jar.txt -c jar.txt -X POST localhost:3000/api/v1/auth/refresh   # new token + rotated cookie
curl -b jar.txt -X POST localhost:3000/api/v1/auth/logout
```

Code rules: valid for 5 minutes, single use, locked after 5 wrong tries, resend after 30 s, at most 5 SMS per hour per number. API routes require a token unless marked `@Public()`. The acting organisation always comes from the user's memberships (`X-Organization-Id` picks one when they have several), and `@Roles(...)` gates actions.

## Resident onboarding (QR code)

New residents register from their own phone by scanning the hostel's QR code. Submitting the form, confirmed by an SMS code, is their signup; staff then approve them into a bed.

**Try it locally** (with `pnpm infra:up` and `pnpm dev` running):

1. Sign in as the owner (`90000 00002`) and open **Onboarding QR** (`/admin/onboarding`). The first visit creates the hostel's join link. "Print poster" prints an A4 "Scan to join" page; "Make a new QR code" switches the old one off.
2. Open the link it shows (`http://localhost:4300/join/<token>`) in another browser profile or a private window, and fill in the six steps. Any JPEG or PNG works for the selfie and ID; Aadhaar `2341 2341 2346` passes the checksum. On "Verify and submit", read the code from the API log (`[dev] OTP for +91 ••••••XXXX is …`). You land on the resident home, "Waiting for approval".
3. Back as the owner, open **Approvals**, check the details and ID, choose a bed and check-in date, and approve. The resident's home now shows their room and bed.

To test with a real phone on your Wi-Fi, set `APP_URL=http://<your-PC-LAN-IP>:4300` (the QR code uses it) and `S3_PUBLIC_ENDPOINT=http://<your-PC-LAN-IP>:9000` (the phone uploads there), add that web origin to `WEB_ORIGINS`, and run `pnpm storage:cors`.

How it is kept safe:

- **Uploads:** photos go from the phone straight to the private bucket through 10-minute signed URLs pinned to the file's type and size (5 MB at most); phones shrink images to about 1 MB first. Before signup, a 24-hour draft token allows only uploading to and submitting that one form.
- **On submit,** the API checks each file's real type from its first bytes, re-encodes images (removing EXIF and GPS, at most 2560px) and watermarks IDs "For <hostel> KYC only". Uploads of forms never submitted are deleted daily at 03:30 IST.
- **ID numbers:** Aadhaar numbers are checked (Verhoeff) on the phone and the server, and only `XXXX-XXXX-1234` is stored; other IDs keep their last 4 characters.
- **Viewing:** staff see the selfie and ID through 5-minute signed links, and every view is written to the audit log (`photo.viewed`, `document.viewed`).
- **Storage CORS:** browsers need a CORS rule on the bucket to upload directly. `pnpm infra:up` sets it from `WEB_ORIGINS`; run `pnpm storage:cors` after changing origins, and once for the production bucket.
- **Consent:** the text residents accept is versioned (`CONSENT_V1` in `libs/shared/contracts`) and still a draft for the owner to review before the pilot.

## The web app

- **Design:** the design-taste-frontend "accent-ladder" style, with DM Sans (self-hosted, including the `latin-ext` subset that carries ₹) and one hue, Backwater green `#0f7a5c`, used only on small marks. All tokens live in [libs/web/ui/src/styles/tokens.css](libs/web/ui/src/styles/tokens.css), and dark mode follows the device.
- **Components:** shared components (`@ninno/ui`) are in [libs/web/ui](libs/web/ui): button, phone field, OTP input, form field and input, choice cards, photo tile, step progress, pill, card, empty state, skeleton, toast, sheet, and the `inr`/`istDate` pipes.
- **PWA:** the production build is installable ("Add to home screen"). The service worker caches only the app shell and static files, never API responses. PWA icons are rendered from the mark with `node tools/render-icons.mjs`.
- **e2e:** `pnpm exec nx run web-e2e:e2e` runs Playwright against the production build at 360×740 in your installed Chrome. The API is mocked, so no backend is needed. It also checks Chrome's installability and that the service worker never caches API responses.

## Everyday commands

| Command                         | What it does                           |
| ------------------------------- | -------------------------------------- |
| `pnpm dev`                      | Serve API + web with reload            |
| `pnpm lint`                     | ESLint across all projects             |
| `pnpm typecheck`                | `tsc --noEmit` across all projects     |
| `pnpm test`                     | Unit and API e2e tests (Jest / Vitest) |
| `pnpm build`                    | Production builds                      |
| `pnpm format`                   | Prettier write                         |
| `pnpm exec nx affected -t test` | Only what your change touched          |

On Windows, if Nx commands hang, set `NX_DAEMON=false` (CI does the same).

## Conventions

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `chore:`…). The `commit-msg` hook enforces this, and `pre-commit` lint-formats staged files.
- **Money** is integer paise everywhere. Format only at the UI edge with `formatInr`.
- **Dates** are computed in `Asia/Kolkata` with the helpers in `@ninno/utils`.
- **Errors** from the API always look like `{ code, message, details, requestId }`.
- **No PII in logs.** The logger redacts phone numbers, OTPs, tokens, ID numbers and addresses, but don't log them in the first place.
- **Module boundaries:** `scope:web` and `scope:api` projects may import only their own scope or `scope:shared` (ESLint enforces this).

## How we work (OpenSpec)

Every feature is an [OpenSpec](https://github.com/Fission-AI/OpenSpec) change in `openspec/changes/<name>/`:

1. `proposal.md`: why, what, and out of scope
2. `specs/<capability>/spec.md`: testable requirements (WHEN/THEN scenarios)
3. `design.md`: technical decisions and trade-offs
4. `tasks.md`: checklist ticked off during implementation

When a change is done and validated (`openspec validate <name> --strict`), it is archived (`openspec archive <name>`), which merges its specs into `openspec/specs/`, the living description of what the system does. Run `openspec list` to see work in flight. In Claude Code, the `/opsx:propose`, `/opsx:apply` and `/opsx:archive` commands drive the same flow.
