# Spec Delta

## Purpose

Lets every Ninno user (owners, managers, staff and residents) sign in with their mobile number and a one-time code, without passwords and without revealing who has an account.

## ADDED Requirements

### Requirement: Request a login code

`POST /api/v1/auth/otp` with a phone number SHALL respond `202` with `{ expiresInSeconds, resendAfterSeconds }` whether or not the number belongs to an account. A code is delivered only when the number belongs to an existing, non-deleted user. Invalid phone formats get `400` `VALIDATION_FAILED`.

#### Scenario: Registered number

- **WHEN** a registered user requests a code
- **THEN** the response is `202` and a code is delivered to their phone

#### Scenario: Unknown number

- **WHEN** a number with no account requests a code
- **THEN** the response is `202` with the same body shape, and no SMS is sent

#### Scenario: Malformed number

- **WHEN** the phone `12345` is submitted
- **THEN** the response is `400` with code `VALIDATION_FAILED`

### Requirement: Sign in with the code

`POST /api/v1/auth/otp/verify` with the phone and code SHALL, on success, start a session (see auth-sessions) and return the access token and the user's profile. Any failure (wrong, expired, replaced or locked code, or unknown number) SHALL return `401` code `OTP_INVALID` with the same message, so callers can't tell the cases apart. After a lockout the code is `OTP_LOCKED`.

#### Scenario: Successful login

- **WHEN** a registered user submits the code they received
- **THEN** the response is `200` with an access token and their memberships, and a refresh cookie is set

#### Scenario: Wrong code

- **WHEN** a wrong code is submitted
- **THEN** the response is `401` with code `OTP_INVALID`

#### Scenario: Unknown number

- **WHEN** a number with no account submits any code
- **THEN** the response is `401` with code `OTP_INVALID`

### Requirement: Login audit

Code requests, successful logins, failed verifications and lockouts SHALL be written to the audit log with the masked phone, the IP address and, when known, the user and their organisation.

#### Scenario: Failed attempt

- **WHEN** a wrong code is submitted for a registered user
- **THEN** an audit entry `auth.otp_failed` records the user, masked phone and IP
