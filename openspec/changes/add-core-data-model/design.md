# Design

## Context

The foundation is archived: an Nx workspace, a NestJS 11 API with the platform behaviour in `openspec/specs/api-platform`, and a Postgres 17 container from `pnpm infra:up`. Prisma 7.10 is current stable. It configures the datasource in `prisma.config.ts`, generates TypeScript with the `prisma-client` generator into a chosen folder, and connects at runtime through a driver adapter (`@prisma/adapter-pg`). The owner removed online payments and passwords from v1 (see proposal.md).

## Goals / Non-Goals

**Goals:**

- Tenant integrity enforced by the database, not only by application code.
- A schema later phases extend (auth adds OTP and refresh-token tables) without reshaping existing tables.

**Non-Goals:**

- Repositories or HTTP endpoints for these models.
- Row Level Security policies. The composite keys below make them straightforward to add later.

## Decisions

### Composite tenant keys

Every tenant-owned parent exposes `@@unique([id, organizationId])` (and hostel-scoped parents `@@unique([id, hostelId])`), and children reference them with composite relations. For example, `Room(hostelId, organizationId) → Hostel(id, organizationId)`, and `Invoice(residentId, hostelId) → Resident(id, hostelId)`. A cross-tenant link is then impossible at the database level, which satisfies the "child records cannot cross tenants" requirement.
_Alternative:_ app-level checks only. Rejected: one forgotten `where` would leak data across hostels.

### IDs and types

- `@default(uuid(7)) @db.Uuid`: time-ordered keys, so indexes stay compact.
- Money is `BigInt` (`bigint`) with `CHECK (... >= 0)` constraints added in the migration SQL.
- Calendar dates are `@db.Date`, and instants are `@db.Timestamptz(3)`.
- Table and column names are `snake_case` through `@@map` / `@map`, so raw SQL and the future RLS policies read naturally.

### Constraints Prisma can't express, added to the migration SQL

The first migration is generated with `prisma migrate dev --create-only` and then extended by hand with:

- `CHECK` constraints for non-negative paise, room capacity ≥ 1, and `fixed_due_day BETWEEN 1 AND 28` when `billing_mode = 'FIXED_DAY'`.
- A partial unique index `UNIQUE (bed_id) WHERE status = 'ACTIVE'` on residents (one active resident per bed).
- `UNIQUE NULLS NOT DISTINCT (user_id, organization_id, hostel_id)` on memberships, so the organisation-wide (null hostel) membership can't be duplicated (PG ≥ 15).
- A `resident_billing_status` view: `resident_id, next_due_date = MIN(due_date)` over open invoices.

### Manual payments only

`Payment` stores `method` (UPI_DIRECT, CASH, BANK_TRANSFER, OTHER), `reference`, `paidOn`, `recordedById`, and `status` (RECORDED, VOIDED) with `voidedAt`, `voidedById` and `voidReason`. There are no provider ids and no WebhookEvent table. If a gateway arrives later, it adds a nullable `provider*` column set without touching history.

### Client location and generation

The schema lives at `prisma/schema.prisma` (as §3 lays out), with `prisma.config.ts` at the repo root. The client is generated into `apps/api/src/generated/prisma` (gitignored) with `moduleFormat = "cjs"` to match the API's CommonJS build and Jest. The root `postinstall` runs `prisma generate`, so a fresh clone and CI always have it.
_Alternative:_ a shared `libs/api/data` lib. Not needed yet, since only the API talks to the DB.

### PrismaService and readiness

`PrismaService extends PrismaClient` with `new PrismaPg({ connectionString })`, connecting on module init and disconnecting on shutdown. The health check runs `SELECT 1` with a 2 s timeout and maps any failure to `database: "down"` / 503, without the error text.

### Seed

`prisma/seed.ts` (run by `prisma db seed` through `tsx`) loads `prisma/pilot-hostel.yaml`. It validates the file with zod (reusing `normalizeIndianPhone` and `rupeesToPaise` from `@ninno/utils`) before opening a transaction, then upserts on natural keys (org slug, hostel slug, room number, bed label, user phone). Beds are created up to capacity and never deleted. `SEED_OWNER_PHONE` overrides the owner phone. The placeholder data is a fictional 4-room men's hostel in Kakkanad, Kochi.

### Database tests

The guide suggests Testcontainers. We use the compose Postgres locally and a Postgres service container in CI instead, which is faster on Windows and needs no Docker-in-test plumbing. DB tests are named `*.db.spec.ts` and run through a separate `api:test-db` target. `api:test` stays DB-free and fast.

**Throwaway database per run (owner decision, 2026-10-28).** The first draft ran `prisma migrate reset --force` against a shared `ninno_test`. Prisma 7 blocks destructive resets invoked by AI agents without explicit consent, and a reset of a long-lived DB is risky anyway. Instead, `DATABASE_URL_TEST` is only an admin connection. The Jest global setup creates `ninno_test_<epoch>_<pid>` and applies migrations with the non-destructive `prisma migrate deploy`. Tests truncate between cases, and the global teardown drops only a database matching `^ninno_test_\d+_\d+$`. No existing database is ever wiped, and parallel runs can't collide.

**Host port 5433.** The dev machine runs a native Windows PostgreSQL service on 5432, which answers `localhost:5432` first. The compose Postgres is published on 5433.

## Risks / Trade-offs

- [Hand-edited migration SQL can drift from `schema.prisma`] → the constraints are additive (CHECK, partial index, view), and `prisma migrate diff` in CI (a later change) can catch drift. The DB tests exercise every hand-written constraint.
- [Composite relations make Prisma writes more verbose] → acceptable for integrity; services will wrap common creates.
- [Generated client in `src/generated` could be committed by mistake] → it is gitignored and excluded from lint.
