# Proposal

## Why

Every Ninno feature reads and writes the same multi-tenant model (organisations → hostels → rooms → beds, plus users, residents, invoices and payments). Defining it once, with tenancy and money rules built in, stops later phases from bending the schema. This is build-guide **Phase 1** (§4, §10, §11).

## What Changes

- Prisma 7 schema for every model in §4, with UUID v7 ids, `created_at`/`updated_at`, soft delete where history matters, indexes on all foreign keys, and `(hostel_id, status)` filters.
- Payments are modelled for staff-recorded entries only (method, reference, recorded_by, voided_at/void_reason). There are no gateway fields and no WebhookEvent table, since online payments are deferred by the owner.
- `User` has no `password_hash`: all logins are phone + OTP (owner decision). `phone` (E.164) is the unique login identity.
- Money columns are `bigint` paise. Calendar dates are `date` and instants are `timestamptz`.
- Hostel billing settings (`billing_mode`, `fixed_due_day`, `grace_days`, `invoice_lead_days`, late-fee settings) live on Hostel, as §7 requires.
- The first migration is committed to git. Migrations are applied with `prisma migrate deploy`, never `db push` outside local prototyping.
- A Nest `PrismaModule` and a database readiness check on `/health`.
- A `resident_billing_status` view that exposes each resident's next due date, as §4 describes.
- An idempotent seed (`prisma/seed.ts`) that reads `prisma/pilot-hostel.yaml`: a placeholder hostel in Kochi with rooms, beds, and an OWNER user identified by phone number, to be swapped for real §11 data later.

## Capabilities

### New Capabilities

- `tenancy`: how organisations, hostels and memberships scope data, and the rule that every business record belongs to exactly one tenant.
- `hostel-inventory`: hostels, rooms and beds, with bed occupancy status and hostel billing settings.
- `pilot-seed`: repeatable creation of the pilot hostel and its owner from an editable data file.

### Modified Capabilities

- `api-platform`: `/health` also reports database readiness.

## Out of scope

- Any HTTP endpoints for these models (later changes add them per feature).
- Postgres Row Level Security (only needed once a second tenant exists, §9).
- PostGIS (Phase 4 finder).

## Impact

- New `prisma/` directory, `@prisma/client` and `prisma` dependencies, and a Postgres container required for tests that touch the DB.
- `api` gains `PrismaModule` and `DATABASE_URL` becomes a required env var (already validated).
