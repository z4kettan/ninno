# Spec Delta

## MODIFIED Requirements

### Requirement: Health check

The API SHALL expose `GET /health`, returning `{ status, version, uptimeSeconds, checks: { database } }`. When the database answers a trivial query within 2 seconds, the response is `200` with `status` `"ok"` and `checks.database` `"up"`. Otherwise it is `503` with `status` `"error"` and `checks.database` `"down"`. It MUST NOT require authentication and MUST NOT reveal configuration values or error details.

#### Scenario: Healthy process

- **WHEN** a probe calls `GET /health` and the database is reachable
- **THEN** the response is `200` with `status` equal to `"ok"` and `checks.database` equal to `"up"`

#### Scenario: Database unreachable

- **WHEN** a probe calls `GET /health` and the database cannot be reached
- **THEN** the response is `503` with `status` equal to `"error"`, `checks.database` equal to `"down"`, and no connection details in the body
