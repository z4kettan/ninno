# hostel-inventory Specification

## Purpose

Describes a hostel's physical inventory (rooms and beds), their occupancy, and the per-hostel settings that later drive billing.

## Requirements

### Requirement: Rooms and beds

A hostel SHALL contain rooms identified by a number unique within the hostel. Each room has a floor, a type (SINGLE, DOUBLE, TRIPLE or DORM), a capacity of at least 1, and a default monthly rent per bed in paise. Each bed belongs to one room, has a label unique within that room, and has a status of VACANT, OCCUPIED or MAINTENANCE (VACANT by default).

#### Scenario: Duplicate room number

- **WHEN** a second room numbered `101` is created in the same hostel
- **THEN** the database rejects the write

#### Scenario: New bed

- **WHEN** a bed is created without a status
- **THEN** its status is VACANT

### Requirement: One active resident per bed

A bed SHALL be assigned to at most one ACTIVE resident at a time. Residents who have moved out keep their historical bed reference.

#### Scenario: Second active resident on a bed

- **WHEN** a resident is set ACTIVE on a bed that already has an ACTIVE resident
- **THEN** the database rejects the write

#### Scenario: Former resident on the same bed

- **WHEN** a MOVED_OUT resident and an ACTIVE resident reference the same bed
- **THEN** the write is accepted

### Requirement: Hostel billing settings

Each hostel SHALL store its billing settings with these defaults: billing mode CHECKIN_ANNIVERSARY, grace days 5, invoice lead days 7, late fees off, and partial payments off. When the billing mode is FIXED_DAY, the fixed due day MUST be between 1 and 28.

#### Scenario: Defaults

- **WHEN** a hostel is created without billing settings
- **THEN** it uses CHECKIN_ANNIVERSARY, 5 grace days, 7 lead days, no late fee and no partial payments

#### Scenario: Invalid fixed day

- **WHEN** a hostel is saved with billing mode FIXED_DAY and fixed due day 31
- **THEN** the database rejects the write

### Requirement: Amounts in paise

Every monetary value (rents, deposits, invoice amounts, late fees, payments) SHALL be stored as a non-negative integer number of paise.

#### Scenario: Negative rent

- **WHEN** a room is saved with a negative monthly rent
- **THEN** the database rejects the write

### Requirement: Next rent due date is derived

A resident's next rent due date SHALL be derived from their earliest unpaid invoice (status UPCOMING, DUE, OVERDUE or PARTIALLY_PAID), not stored on the resident.

#### Scenario: Two open invoices

- **WHEN** a resident has open invoices due on 15 Apr and 15 May
- **THEN** their next due date reads as 15 Apr

#### Scenario: All paid

- **WHEN** all of a resident's invoices are PAID or CANCELLED
- **THEN** their next due date is empty
