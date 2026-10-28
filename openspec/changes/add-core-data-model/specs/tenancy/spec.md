# Spec Delta

## Purpose

Defines who owns which data in Ninno: organisations are tenants, hostels belong to exactly one organisation, and people act inside a tenant only through memberships.

## ADDED Requirements

### Requirement: Every business record belongs to one tenant

Every business record (hostels, rooms, beds, onboarding links, residents, identity documents, rent plans, invoices, payments) SHALL carry the id of the organisation that owns it. Records that live inside a hostel SHALL also carry the hostel id. Audit entries carry the organisation id whenever the action happened inside one.

#### Scenario: Record created without a tenant

- **WHEN** a business record is written without an organisation id
- **THEN** the database rejects the write

### Requirement: Child records cannot cross tenants

A record's organisation (and hostel, where it has one) SHALL match its parent's. For example, a room's organisation must equal its hostel's organisation, and an invoice's must equal its resident's. The database MUST reject any write that would link records from different tenants.

#### Scenario: Room under another organisation's hostel

- **WHEN** a room is created with organisation A but the hostel of organisation B
- **THEN** the database rejects the write

#### Scenario: Invoice for another hostel's resident

- **WHEN** an invoice is created whose hostel differs from its resident's hostel
- **THEN** the database rejects the write

### Requirement: Phone number is the unique identity

Each person SHALL have exactly one user record, identified by a unique E.164 mobile number. User records MUST NOT store passwords.

#### Scenario: Duplicate phone

- **WHEN** a second user is created with an existing phone number
- **THEN** the database rejects the write

### Requirement: Access through memberships

A user SHALL act within an organisation only through a membership that grants one role (OWNER, MANAGER, STAFF or RESIDENT), optionally limited to one hostel of that organisation. A user may hold memberships in several organisations, but at most one membership per organisation and hostel combination.

#### Scenario: Duplicate membership

- **WHEN** a second membership is created for the same user, organisation and hostel (including the organisation-wide case with no hostel)
- **THEN** the database rejects the write

#### Scenario: Membership hostel from another organisation

- **WHEN** a membership names organisation A and a hostel of organisation B
- **THEN** the database rejects the write
