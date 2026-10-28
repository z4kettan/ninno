# api-platform Specification

## Purpose

Defines the HTTP behaviour every Ninno API endpoint inherits: addressing, health, errors, validation, configuration, security headers and observability.

## Requirements

### Requirement: Versioned base path

All business endpoints SHALL be served under `/api/v1`. The health endpoint SHALL be served at `/health`, outside the versioned prefix, so infrastructure probes never change with API versions.

#### Scenario: Versioned route

- **WHEN** a client calls a business endpoint such as `GET /api/v1/<resource>`
- **THEN** the request is routed to that endpoint

#### Scenario: Unversioned route is not served

- **WHEN** a client calls `GET /api/<resource>` without a version segment
- **THEN** the API responds `404` with the standard error envelope

### Requirement: Health check

The API SHALL expose `GET /health`, returning `{ status, version, uptimeSeconds, checks: { database } }`. When the database answers a trivial query within 2 seconds, the response is `200` with `status` `"ok"` and `checks.database` `"up"`. Otherwise it is `503` with `status` `"error"` and `checks.database` `"down"`. It MUST NOT require authentication and MUST NOT reveal configuration values or error details.

#### Scenario: Healthy process

- **WHEN** a probe calls `GET /health` and the database is reachable
- **THEN** the response is `200` with `status` equal to `"ok"` and `checks.database` equal to `"up"`

#### Scenario: Database unreachable

- **WHEN** a probe calls `GET /health` and the database cannot be reached
- **THEN** the response is `503` with `status` equal to `"error"`, `checks.database` equal to `"down"`, and no connection details in the body

### Requirement: Uniform error envelope

Every error response SHALL have the JSON body `{ code, message, details, requestId }`. `code` is a stable UPPER_SNAKE_CASE identifier, `message` is human readable, `details` is `null` or structured data, and `requestId` matches the `x-request-id` response header. Unexpected errors MUST return `500` with code `INTERNAL_ERROR` and MUST NOT leak stack traces or internal messages.

#### Scenario: Unknown route

- **WHEN** a client calls a path that does not exist
- **THEN** the response is `404` with `code` `NOT_FOUND` and a `requestId`

#### Scenario: Unhandled exception

- **WHEN** a handler throws an unexpected error
- **THEN** the response is `500` with `code` `INTERNAL_ERROR`, a generic message, and no stack trace

### Requirement: Strict input validation

Request bodies, query strings and route params SHALL be validated against declared DTOs. Unknown properties MUST be rejected. A validation failure SHALL return `400` with code `VALIDATION_FAILED` and `details` listing each failing field and its reasons.

#### Scenario: Unknown property

- **WHEN** a client sends a body containing a property the DTO does not declare
- **THEN** the response is `400` with `code` `VALIDATION_FAILED` and the property named in `details`

#### Scenario: Invalid field

- **WHEN** a required field is missing or has the wrong type
- **THEN** the response is `400` with `code` `VALIDATION_FAILED` and that field listed in `details`

### Requirement: Startup configuration validation

The API SHALL validate all environment configuration at startup and MUST refuse to start when a required value is missing or malformed. The error MUST name each offending variable and MUST NOT print secret values.

#### Scenario: Missing required variable

- **WHEN** the API starts without a required variable such as `DATABASE_URL`
- **THEN** the process exits with a non-zero code and an error naming `DATABASE_URL`

### Requirement: Request correlation

Every response SHALL carry an `x-request-id` header. If the client sends a well-formed `x-request-id`, the API SHALL reuse it; otherwise it generates one. Every log line for that request MUST include the same id.

#### Scenario: Client-supplied id

- **WHEN** a client sends `x-request-id: abc-123`
- **THEN** the response header `x-request-id` is `abc-123`

#### Scenario: Generated id

- **WHEN** a client sends no `x-request-id`
- **THEN** the response carries a newly generated non-empty `x-request-id`

### Requirement: PII redaction in logs

Logs SHALL be structured JSON. Authorization headers, cookies, passwords, OTPs, tokens, phone numbers, Aadhaar or ID numbers and addresses MUST be redacted before they are written.

#### Scenario: Sensitive body field

- **WHEN** a request containing a `password` or `phone` field is logged
- **THEN** the log entry shows that field as `[REDACTED]`

### Requirement: Transport security defaults

The API SHALL send standard security headers, SHALL allow cross-origin requests only from the configured web origin(s), SHALL reject JSON bodies larger than the configured limit with `413`, and SHALL rate-limit clients globally, returning `429` with code `RATE_LIMITED` when exceeded.

#### Scenario: Disallowed origin

- **WHEN** a browser preflight comes from an origin that is not configured
- **THEN** the response carries no `Access-Control-Allow-Origin` header for that origin

#### Scenario: Rate limit exceeded

- **WHEN** a client exceeds the global request limit within the window
- **THEN** the response is `429` with `code` `RATE_LIMITED`

### Requirement: API documentation exposure

The API SHALL serve OpenAPI documentation at `/api/docs` when `NODE_ENV` is not `production`, and MUST NOT serve it in production.

#### Scenario: Production

- **WHEN** the API runs with `NODE_ENV=production` and a client requests `/api/docs`
- **THEN** the response is `404`

#### Scenario: Development

- **WHEN** the API runs with `NODE_ENV=development` and a client requests `/api/docs`
- **THEN** the OpenAPI UI is returned
