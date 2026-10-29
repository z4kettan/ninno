# Spec Delta

## Purpose

Keeps a signed-in user signed in safely: short-lived access tokens, rotating refresh tokens that detect theft, logout, and a way for the app to learn who is signed in.

## ADDED Requirements

### Requirement: Access tokens

A successful login or refresh SHALL return a signed access token valid for 15 minutes, identifying only the user. Protected endpoints SHALL accept it as `Authorization: Bearer <token>`.

#### Scenario: Expired access token

- **WHEN** a request carries an access token older than 15 minutes
- **THEN** the response is `401` with code `UNAUTHORIZED`

### Requirement: Rotating refresh tokens

A login SHALL set a refresh token in an httpOnly, SameSite=Strict cookie scoped to the auth path, valid for 30 days and Secure outside development. `POST /api/v1/auth/refresh` SHALL exchange it for a new access token and a new refresh token, invalidating the old one. Refresh tokens MUST be stored only as hashes.

#### Scenario: Refresh

- **WHEN** a client calls refresh with a valid refresh cookie
- **THEN** it gets a new access token and a different refresh cookie

#### Scenario: Missing cookie

- **WHEN** a client calls refresh without a refresh cookie
- **THEN** the response is `401` with code `UNAUTHORIZED`

### Requirement: Refresh token reuse detection

Presenting a refresh token that has already been rotated SHALL revoke every token in its family (that login's chain), and return `401`. The legitimate holder must sign in again.

#### Scenario: Stolen token replayed

- **WHEN** an already-rotated refresh token is presented
- **THEN** the response is `401`, and the newest token of that family no longer works

### Requirement: Logout

`POST /api/v1/auth/logout` SHALL revoke the current refresh token family and clear the cookie. It succeeds even without a valid session.

#### Scenario: Logout then refresh

- **WHEN** a user logs out and the old refresh cookie is presented again
- **THEN** the refresh is rejected with `401`

### Requirement: Current user

`GET /api/v1/auth/me` SHALL return the signed-in user's id, name, masked phone and active memberships (organisation id and name, hostel id and name or null, role).

#### Scenario: Owner

- **WHEN** the seeded owner calls `GET /api/v1/auth/me`
- **THEN** the response lists one OWNER membership for the pilot organisation with hostel `null`
