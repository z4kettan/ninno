# pilot-seed Specification

## Purpose

Lets the team create (and later update) the pilot hostel, its rooms and beds, and its owner from one editable data file, without hand-written SQL.

## Requirements

### Requirement: Seed from a data file

Running the seed SHALL read the pilot hostel data file and create the organisation, the hostel with its address, location, policies and billing settings, every listed room with one bed per unit of capacity, and an owner user with an organisation-wide OWNER membership. Rent and deposit values in the file are in rupees and are stored as paise.

#### Scenario: Fresh database

- **WHEN** the seed runs against an empty database with a file listing a DOUBLE room `101` at ₹6,500
- **THEN** room `101` exists with capacity 2, two VACANT beds, and a default rent of 650000 paise

#### Scenario: Owner login identity

- **WHEN** the seed completes
- **THEN** a user with the file's owner phone (normalised to E.164) holds an OWNER membership for the organisation

### Requirement: Seed is repeatable

Running the seed again with the same file SHALL NOT create duplicates. Changed values for existing records (names, rents, settings) SHALL be updated, and new rooms SHALL be added. The seed MUST NOT delete rooms, beds, or anything residents depend on.

#### Scenario: Second run

- **WHEN** the seed runs twice with the same file
- **THEN** the counts of organisations, hostels, rooms, beds, users and memberships are unchanged after the second run

#### Scenario: Rent changed in the file

- **WHEN** room `101`'s rent is changed to ₹7,000 in the file and the seed runs again
- **THEN** room `101`'s default rent becomes 700000 paise and no new room is created

### Requirement: Invalid data file

The seed SHALL validate the whole file before writing anything. When the file is invalid, it MUST exit with a non-zero code, name each invalid field, and leave the database unchanged.

#### Scenario: Bad phone number

- **WHEN** the owner phone in the file is `12345`
- **THEN** the seed exits non-zero, names `owner.phone`, and writes nothing

### Requirement: Owner phone override

The owner's phone SHALL be overridable through an environment variable, so each developer can log in with their own number without editing the shared file.

#### Scenario: Override set

- **WHEN** the override variable is set to `9876543210` and the seed runs
- **THEN** the owner user's phone is `+919876543210`
