# Spec Delta

## Purpose

The QR code a hostel prints at reception: an unguessable link that opens Ninno's self-registration for that hostel, and that staff can rotate or switch off at any time.

## ADDED Requirements

### Requirement: One active link per hostel

Each hostel SHALL have at most one active onboarding link. Owners and managers can view it, and rotating it SHALL deactivate the current link and create a new one with a fresh token. The token MUST be at least 128 bits of randomness, encoded URL-safe, and the link reads `https://<app>/join/<token>`.

#### Scenario: First visit to the QR screen

- **WHEN** an owner opens the onboarding QR screen for a hostel with no active link
- **THEN** a new active link is created and its QR code is shown

#### Scenario: Rotate

- **WHEN** an owner rotates the link
- **THEN** the old token stops working and the QR code shows the new one

#### Scenario: Staff role

- **WHEN** a STAFF user calls the rotate endpoint
- **THEN** the response is `403` with code `FORBIDDEN`

### Requirement: Link validity

A link SHALL be usable only while it is active, not past its optional expiry, and below its optional maximum number of uses. Opening a valid link returns the hostel's public details only: name, address, city, gender policy, amenities and house rules. An invalid, expired, used-up or unknown token SHALL return `404` with code `LINK_INVALID`, the same for every case.

#### Scenario: Valid link

- **WHEN** someone opens a valid join link
- **THEN** they see the hostel's name, address and rules, and nothing about its residents or staff

#### Scenario: Rotated link

- **WHEN** someone opens a link that was rotated away
- **THEN** the response is `404` with code `LINK_INVALID`

### Requirement: Use counting

Each successful registration through a link SHALL increase its use count by one, and a link at its maximum uses SHALL stop accepting registrations.

#### Scenario: Max uses reached

- **WHEN** a link with a maximum of 1 use has been used once and another person submits through it
- **THEN** the submission is refused with code `LINK_INVALID`

### Requirement: Printable poster

The QR screen SHALL offer a printable A4 poster with the hostel's name, the QR code and the words "Scan to join", printing in black on white without the app's navigation.

#### Scenario: Print

- **WHEN** an owner chooses "Print poster"
- **THEN** the browser's print view shows a single A4 page with the hostel name, the QR code and "Scan to join"
