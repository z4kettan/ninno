# Proposal

## Why

Ninno starts from an empty folder. Every later feature (onboarding, rent, payments) depends on a shared workspace, a running API skeleton, local infrastructure and an automated quality gate. Building those first means each later change only adds domain behaviour. This is the first slice of build-guide **Phase 1: Foundations** (§10).

## What Changes

- Nx 24 monorepo on pnpm with `apps/api` (NestJS), `apps/web` (Angular, as a bare app; the shell comes in `add-web-app-shell`), `libs/shared/contracts` and `libs/shared/utils`.
- Strict TypeScript, ESLint + Prettier, and husky + lint-staged + commitlint (Conventional Commits).
- `docker-compose.yml` with Postgres, Redis, MinIO and Mailpit, plus `.env.example`.
- API runtime: environment config validated at startup, `/api/v1` versioned prefix, global validation pipe (whitelist + forbid unknown fields), one error envelope `{ code, message, details, requestId }`, JSON logs with request ids and PII redaction, `helmet`, strict CORS, body size limits, a global rate limit, `/health`, and Swagger at `/api/docs` outside production.
- Shared utils: INR paise formatting, IST date helpers, Indian phone normalisation to E.164, all with unit tests.
- GitHub Actions CI: install → lint → typecheck → test → build, using affected-only runs on PRs.
- `pnpm dev` starts the API and the web app together.

## Capabilities

### New Capabilities

- `api-platform`: cross-cutting HTTP behaviour every endpoint inherits: versioned base path, health check, error envelope, input validation, startup config validation, security headers, CORS, rate limits, request ids, log redaction, and API docs exposure.
- `shared-formatting`: the shared rules for turning paise, IST dates and Indian phone numbers into display or storage formats, used identically by web and API.

### Modified Capabilities

- None (greenfield).

## Out of scope

- Database schema, Prisma client and seed (`add-core-data-model`).
- Authentication and guards (`add-authentication`).
- Angular routing, design system, layouts and PWA (`add-web-app-shell`).
- Deployment and Sentry (Phase 4).

## Impact

- New repository structure, root `package.json`, `pnpm-workspace.yaml`, `nx.json`, `tsconfig.base.json`.
- New dev dependencies: Nx 24, Angular 22, NestJS 12, ESLint, Prettier, husky, commitlint, Jest/Vitest.
- Developers need Docker Desktop running for the infrastructure services.
