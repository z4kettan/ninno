# Tasks

## 1. Schema and migration

- [x] 1.1 Declare the two composite relations (`onDelete: Restrict`) and the Membership `@@unique` in `schema.prisma`; verify `prisma validate` passes
- [x] 1.2 Generate `tenant_constraints_in_schema` with `--create-only` and show the SQL to the owner; verify it contains only renames of the three objects and drops of the two superseded single-column FKs
- [x] 1.3 After owner approval, apply with `pnpm db:migrate`; verify `db:drift` reports no difference and the unique index is still `NULLS NOT DISTINCT`
- [x] 1.4 Run the DB suite (`nx run api:test-db`); verify all tenancy and hostel-inventory tests pass unchanged

## 2. Guard

- [x] 2.1 Add the `db:drift` script and the CI "Schema drift check" step; verify `pnpm db:drift` exits 0 locally

## Workflow follow-up

- Show the owner the test results; commit and push only with their OK, then archive the change.
