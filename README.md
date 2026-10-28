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
