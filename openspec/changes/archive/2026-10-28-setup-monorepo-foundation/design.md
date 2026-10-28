# Design

## Context

The repository is empty apart from OpenSpec and the build guide. The local machine has Node 24, pnpm 12, Docker 29, Angular CLI 22, and OpenSpec 1.14. Current stable versions are Nx 24, Angular 22, NestJS 12, Prisma 7 (8 is still an RC), and Tailwind 4. See proposal.md for motivation.

**Implementation notes (deviations found while applying):**

- `@nx/nest` 24 generates **NestJS 11.2**, not 12. We keep 11 because that's what the plugin is tested against, and pin companion packages to Nest-11-compatible majors (`@nestjs/swagger@11`).
- `create-nx-workspace` now maps presets onto demo templates, so the workspace was assembled by hand (`package.json`, `nx.json`, `tsconfig.base.json`) and then filled with the official `@nx/angular`, `@nx/nest` and `@nx/js` generators. The Nx daemon hangs on this Windows machine, so commands run with `NX_DAEMON=false`.
- MinIO no longer publishes images on Docker Hub or Quay, so local S3 uses **RustFS 1.0.4** (Apache-2.0, MinIO-compatible). Its own `curl --aws-sigv4` creates the bucket, so there's no extra image.
- Nx loads the root `.env` into every task, and Angular's dev server lets `PORT` override its configured port. The API therefore reads **`API_PORT`**, and the web dev server is pinned to **4300**, because 4200 is often taken by other projects on this machine. The `/api` proxy targets `127.0.0.1:3000` to avoid IPv6/IPv4 `localhost` ambiguity.
- Body-parser errors happen before Nest's filters run, so the request-id middleware and a small Express error handler run first and share the same envelope builder (`toErrorEnvelope`) as `AllExceptionsFilter`.

## Goals / Non-Goals

**Goals:**

- One command (`pnpm dev`) for daily work, and one pipeline (CI) that matches what developers run locally.
- Cross-cutting API behaviour (errors, validation, logging, security) built once, so domain modules never reimplement it.

**Non-Goals:**

- Production deployment, container images, and Sentry wiring (Phase 4).
- Any persistence. Prisma arrives in `add-core-data-model`.

## Decisions

### Nx integrated monorepo on pnpm

Use `create-nx-workspace` (preset `apps`, pnpm), then the `@nx/angular` and `@nx/nest` plugins. Libraries are non-buildable and consumed through `tsconfig.base.json` path aliases (`@ninno/contracts`, `@ninno/utils`, later `@ninno/ui`).
_Alternative:_ buildable/publishable libs. Rejected: there's no external consumer, and buildable libs slow the inner loop.

### Environment validation with zod

The API config module parses `process.env` with a zod schema at bootstrap and exposes a typed `AppConfig`. The error names the failing keys but not their values.
_Alternative:_ Joi through `@nestjs/config`. Rejected: zod is already a candidate for shared contract validation, and its types infer directly.
DTO validation still uses `class-validator`, as §2 specifies, because Nest's `ValidationPipe` and Swagger integrate with it.

### Error envelope through one global filter

A single `AllExceptionsFilter` maps `HttpException`, validation errors, throttler errors, and unknown errors to `{ code, message, details, requestId }`. Domain code throws a small `AppException(code, status, message, details?)`, so codes stay stable. The validation pipe uses a custom `exceptionFactory` that flattens nested errors into `details: [{ field, errors[] }]`.

### Logging with nestjs-pino

`pino-http` uses `genReqId`, which honours an incoming `x-request-id` when it matches `^[A-Za-z0-9._-]{1,128}$` and otherwise generates a UUID. Redaction paths cover `req.headers.authorization`, `req.headers.cookie`, and `*.password`, `*.otp`, `*.token`, `*.refreshToken`, `*.phone`, `*.aadhaar*`, `*.idNumber`, `*.address*`. Request bodies are not logged by default, and redaction is the second line of defence. Logs are pretty-printed in development and JSON elsewhere.

### Versioning and health

Use `app.setGlobalPrefix('api', { exclude: ['health'] })` with `VersioningType.URI` and default version `1`. Health is a plain controller that reports version and uptime. The readiness check for the database is added with Prisma in the next change.

### Security defaults

`helmet()`, `enableCors({ origin: WEB_ORIGINS list, credentials: true })` (credentials are needed for the refresh cookie later), `express.json({ limit: '100kb' })`, and `@nestjs/throttler` at 100 requests/min per IP globally. Stricter per-route limits for OTP and login arrive with auth.

### Shared utils are framework-free

`libs/shared/utils` uses only TypeScript and `date-fns` / `@date-fns/tz` (date-fns v4 TZ support), so both Angular and Nest import it. Money helpers parse strings with a regex and integer math (`BigInt`-safe), and never use `parseFloat` for storage.

### Tests

- API: Jest (Nx Nest default) unit tests, plus Supertest e2e tests against an in-process app for the platform behaviour.
- Web: whatever runner Nx 24 generates for Angular 22 (Vitest), kept as is.
- Utils: Jest/Vitest unit tests for every spec scenario.

### Local infra

`docker-compose.yml` runs `postgres:17-alpine` (5432), `redis:7-alpine` (6379), RustFS S3 (9000/9001, with the private `ninno-private` bucket created by an init container), and Mailpit (1025/8025). Volumes are named so data survives restarts.

### CI

GitHub Actions: checkout, pnpm setup, Node 24, `pnpm install --frozen-lockfile`, then `nx affected -t lint typecheck test build` on PRs (with `nx run-many` on `main`). `pnpm audit --prod --audit-level high` runs as a separate non-blocking job for now. Dependabot handles npm and actions.

### Commit hooks

husky `pre-commit` runs lint-staged (Prettier + ESLint on staged files), and `commit-msg` runs commitlint with `@commitlint/config-conventional`.

## Risks / Trade-offs

- [Very new majors (Nx 24 / Angular 22 / Nest 12) may have plugin gaps] → pin exact versions in the lockfile, and fall back to manual config where a generator is missing.
- [Windows dev machine; CI is Linux] → keep scripts cross-platform (no bash-only npm scripts), and use `.gitattributes` for LF line endings.
- [Global throttling behind a proxy keys on the proxy IP] → set `trust proxy` from config at deploy time (Phase 4).
