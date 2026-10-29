# Spec Delta

## Purpose

Decides who may call what: every endpoint requires a signed-in user unless explicitly public, roles gate actions, and the tenant a request acts on always comes from the caller's own memberships.

## ADDED Requirements

### Requirement: Authenticated by default

Every endpoint SHALL require a valid access token unless it is explicitly marked public. Public endpoints include health, the OTP request and verify endpoints, refresh and logout.

#### Scenario: No token

- **WHEN** a protected endpoint is called without a token
- **THEN** the response is `401` with code `UNAUTHORIZED`

#### Scenario: Public endpoint

- **WHEN** `/health` is called without a token
- **THEN** it is served normally

### Requirement: Tenant derived from memberships

For tenant-scoped endpoints, the acting organisation (and hostel, where relevant) SHALL be resolved from the caller's active memberships. A caller with several memberships selects one with the `X-Organization-Id` header, which is accepted only if they hold a membership there. Tenant ids in request bodies MUST be ignored for scoping.

#### Scenario: Single membership

- **WHEN** a user with one membership calls a tenant-scoped endpoint without the header
- **THEN** the request acts within that membership's organisation

#### Scenario: Foreign organisation

- **WHEN** a user sends `X-Organization-Id` for an organisation they don't belong to
- **THEN** the response is `403` with code `FORBIDDEN`

#### Scenario: Ambiguous

- **WHEN** a user with memberships in two organisations calls a tenant-scoped endpoint without the header
- **THEN** the response is `400` with code `TENANT_REQUIRED`

### Requirement: Role checks

Endpoints SHALL declare the roles allowed to call them, and a caller whose membership in the acting tenant lacks those roles SHALL get `403` with code `FORBIDDEN`. An organisation-wide membership applies to every hostel in that organisation, and a hostel membership applies only to its hostel.

#### Scenario: Resident calls a staff endpoint

- **WHEN** a RESIDENT calls an endpoint allowed for OWNER and MANAGER
- **THEN** the response is `403` with code `FORBIDDEN`
