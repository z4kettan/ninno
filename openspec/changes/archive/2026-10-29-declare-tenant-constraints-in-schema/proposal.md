# Proposal

## Why

Three tenant-safety rules exist only as hand-written SQL in the `init` migration, and are not declared in `prisma/schema.prisma`:

- memberships: `(hostel_id, organization_id)` → hostels (a membership can't name another organisation's hostel)
- residents: `(bed_id, hostel_id, organization_id)` → beds (a resident can't be put in another hostel's bed)
- memberships: unique `(user_id, organization_id, hostel_id)` `NULLS NOT DISTINCT` (no duplicate memberships, including organisation-wide ones)

Prisma treats anything it can express but doesn't see in the schema as drift, so the **next generated migration would drop all three**. This happened with the first draft of the login migration, which was discarded. The `add-core-data-model` design wrongly assumed Prisma couldn't express optional composite relations; Prisma 7.10 can.

This is a Phase 1 maintenance fix, done before `add-authentication` adds the next migration.

## What Changes

- Declare both composite relations in `schema.prisma` with `onDelete: Restrict`. That matches the live constraints, whereas Prisma's optional-relation default (`SetNull`) would try to null `organization_id`.
- Declare `@@unique([userId, organizationId, hostelId])` on Membership.
- One migration, `tenant_constraints_in_schema`, that only **renames** the three existing objects to Prisma's names and drops the two single-column FKs the composite ones supersede. No constraint is weakened; the unique index keeps `NULLS NOT DISTINCT`.
- A `db:drift` script and a CI step that fail when the database built from all migrations differs from `schema.prisma`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- None. The `tenancy` and `hostel-inventory` rules are unchanged; only where they are declared moves. The existing DB tests prove the behaviour is preserved.

## Out of scope

- Any login, OTP or other new tables (`add-authentication`).
- CHECK constraints, the partial unique index on residents, and the billing view. Prisma ignores these when diffing, so they stay safely in SQL.

## Impact

- `prisma/schema.prisma`, one new migration, `package.json` (`db:drift`), `.github/workflows/ci.yml`.
- Local dev databases pick it up with `pnpm db:migrate`. No data changes.
