# Design

## Context

See proposal.md. Verified on the local dev DB (state = `init` migration only):

- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` reports exactly three statements: drop `memberships_hostel_tenant_fkey`, drop `residents_bed_tenant_fkey`, drop index `memberships_user_org_hostel_key`. Those are the objects the committed schema doesn't declare.
- A probe confirmed Prisma 7.10 accepts `Hostel? @relation(fields: [hostelId, organizationId], ...)` even though `organizationId` is required.

## Goals / Non-Goals

**Goals:** after this change, the database built from all migrations and `schema.prisma` describe the same FKs and unique indexes, so generated migrations never touch tenant rules.

**Non-Goals:** moving CHECKs, partial indexes or views into the schema (Prisma can't express them and doesn't diff them).

## Decisions

### Rename, don't recreate

When the schema declares an equivalent constraint, Prisma's diff emits `RENAME CONSTRAINT` / `ALTER INDEX … RENAME`. The definitions (including `NULLS NOT DISTINCT`) stay byte-for-byte the same, with no window where a rule is missing and no table rewrite.

### `onDelete: Restrict` on both composite relations

Prisma's default for an optional relation is `SetNull`. On a composite FK that would set `organization_id` to NULL, which is NOT NULL, so deletes would fail confusingly. `Restrict` is what the live constraints already do.

### Drift check scope

`db:drift` = `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`. In CI it runs against a fresh database after `prisma migrate deploy`. It catches schema edits without a migration and migrations that don't match the schema. It can't see hand-written-only objects, which is why every hand-written constraint also has a DB test (tenancy, hostel-inventory).

## Risks / Trade-offs

- [The migration could still contain something unexpected] → it is generated `--create-only` and reviewed by the owner **before** it is applied anywhere.
