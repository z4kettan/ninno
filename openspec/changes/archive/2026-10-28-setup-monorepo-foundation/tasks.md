# Tasks

## 1. Workspace scaffolding

- [x] 1.1 Generate the Nx 24 workspace on pnpm with `apps/api` (NestJS) and `apps/web` (Angular 22, standalone, zoneless if offered); verify `pnpm nx show projects` lists `api` and `web`
- [x] 1.2 Enable strict TypeScript in `tsconfig.base.json` and add `.editorconfig`, `.gitattributes` (LF), `.nvmrc` (24) and `.gitignore`; verify `pnpm nx run-many -t typecheck` passes
- [x] 1.3 Configure ESLint + Prettier at the root; verify `pnpm nx run-many -t lint` passes
- [x] 1.4 Add husky, lint-staged and commitlint (conventional); verify a commit with message `bad message` is rejected and `chore: scaffold` is accepted

## 2. Shared utils (`shared-formatting`)

- [x] 2.1 Create `libs/shared/contracts` and `libs/shared/utils` with `@ninno/contracts` and `@ninno/utils` aliases; verify both import from `api` and `web`
- [x] 2.2 Implement paise parsing/formatting with unit tests for every money scenario in the spec
- [x] 2.3 Implement IST date helpers with unit tests for the IST scenarios in the spec
- [x] 2.4 Implement phone normalisation and masking with unit tests for the phone scenarios in the spec

## 3. Local infrastructure

- [x] 3.1 Add `docker-compose.yml` (Postgres 17, Redis 7, S3-compatible storage with a private bucket, Mailpit) and `.env.example`; verify `docker compose up -d` brings all services to healthy
- [x] 3.2 Add root scripts `dev`, `infra:up`, `infra:down`, `lint`, `test`, `build`; verify `pnpm dev` serves web on 4300 and api on 3000

## 4. API platform (`api-platform`)

- [x] 4.1 Config module with a zod env schema; verify with an e2e test that a missing `DATABASE_URL` stops bootstrap with a named error
- [x] 4.2 Global prefix `/api`, URI versioning v1 and `/health`; e2e tests for the versioned-route, unversioned-404 and health scenarios
- [x] 4.3 `AppException`, global exception filter and validation pipe `exceptionFactory`; e2e tests for not-found, unhandled-exception, unknown-property and invalid-field scenarios
- [x] 4.4 nestjs-pino with request-id handling and redaction paths; e2e test for the request-id echo/generation and a unit test that redaction masks `password` and `phone`
- [x] 4.5 helmet, CORS allow-list, body size limit and global throttler; e2e tests for disallowed-origin, 413 and 429 scenarios
- [x] 4.6 Swagger at `/api/docs` outside production; e2e tests for the production and development scenarios

## 5. CI

- [x] 5.1 Add `.github/workflows/ci.yml` (install → lint → typecheck → test → build, affected on PRs) and `.github/dependabot.yml`; verify the same targets pass locally with `pnpm nx run-many -t lint typecheck test build`
- [x] 5.2 Write `README.md` covering prerequisites, `pnpm infra:up`, `pnpm dev` and the OpenSpec workflow; verify the steps run as written on a fresh clone

## Workflow follow-up

- Run `openspec validate setup-monorepo-foundation --strict`, then archive the change once all tasks are checked.
