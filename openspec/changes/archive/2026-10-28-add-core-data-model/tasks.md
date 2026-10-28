# Tasks

## 1. Prisma setup

- [x] 1.1 Install `prisma@7`, `@prisma/client@7`, `@prisma/adapter-pg`, `pg`, `tsx` and `yaml`; add `prisma.config.ts`, the root `postinstall: prisma generate`, and gitignore `apps/api/src/generated`; verify `pnpm prisma generate` produces the client
- [x] 1.2 Add `DATABASE_URL_TEST` to `.env.example`, create the `ninno_test` admin database on the compose Postgres, and add the `api:test-db` target whose global setup creates a throwaway per-run database (migrate deploy) and whose teardown drops it; verify the target runs

## 2. Schema and migration (`tenancy`, `hostel-inventory`)

- [x] 2.1 Write `prisma/schema.prisma` with all §4 models (minus payment-gateway fields and WebhookEvent, plus manual-payment fields), composite tenant keys, enums, snake_case mapping and FK indexes; verify `prisma validate` passes
- [x] 2.2 Generate the first migration with `--create-only`, add the CHECK constraints, partial unique bed index, NULLS NOT DISTINCT membership index and the `resident_billing_status` view; verify `prisma migrate dev` applies it cleanly to the dev DB
- [x] 2.3 DB tests for every tenancy scenario (missing tenant, room/invoice across tenants, duplicate phone, duplicate and cross-org membership); verify `api:test-db` passes
- [x] 2.4 DB tests for every hostel-inventory scenario (duplicate room, bed default, one active resident per bed, billing defaults, invalid fixed day, negative rent, next due date view); verify `api:test-db` passes

## 3. API integration (`api-platform`)

- [x] 3.1 `PrismaModule`/`PrismaService` using the pg adapter with lifecycle hooks; verify the API boots against the dev DB
- [x] 3.2 Health check reports `checks.database` with a 2 s timeout and 503 when down; update the platform e2e test with a stubbed Prisma, and add a DB test for the reachable case

## 4. Pilot seed (`pilot-seed`)

- [x] 4.1 Write `prisma/pilot-hostel.yaml` with placeholder Kochi data and the zod schema for it; unit-test that an invalid owner phone names `owner.phone`
- [x] 4.2 Implement `prisma/seed.ts` (validate first, then upsert in one transaction, beds up to capacity, `SEED_OWNER_PHONE` override); DB tests for the fresh-run, repeat-run, rent-change and override scenarios
- [x] 4.3 Add `db:migrate`, `db:migrate:new`, `db:seed`, `db:reset` and `db:studio` root scripts and document them in the README; verify `pnpm db:migrate` and two `pnpm db:seed` runs leave the dev DB migrated and seeded without duplicates (`db:reset` is destructive and left for humans to run)

## 5. CI

- [x] 5.1 Add a Postgres service and the `api:test-db` step to `ci.yml`; verify locally that `pnpm exec nx run-many -t lint typecheck test build` and `nx run api:test-db` are green

## Workflow follow-up

- Run `openspec validate add-core-data-model --strict`, then archive the change once all tasks are checked.
