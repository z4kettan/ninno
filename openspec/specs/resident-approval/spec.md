# resident-approval Specification

## Purpose

Where hostel staff turn an application into a resident: review the details and ID, choose a bed, set the rent, and approve, or reject with a reason the applicant will see.

## Requirements

### Requirement: Approvals queue

Owners, managers and staff SHALL see the hostel's PENDING_REVIEW applications, oldest first, with name, phone (masked), occupation and submission time. The navigation shows the number waiting. Only applications of hostels the user has access to are listed.

#### Scenario: Two pending

- **WHEN** two applications are waiting
- **THEN** the Approvals item shows 2 and the queue lists both, oldest first

#### Scenario: Nothing waiting

- **WHEN** no application is waiting
- **THEN** the queue says there is nothing to review, and the navigation shows no number

### Requirement: Application detail

The detail view SHALL show everything the applicant entered, the selfie, the ID type and masked number, and buttons to view the ID photos (see identity-documents).

#### Scenario: Open an application

- **WHEN** staff open a pending application
- **THEN** they see the applicant's details, selfie and masked ID number, with buttons to view the ID front and back

### Requirement: Approve with bed and rent

Owners and managers SHALL approve an application by choosing a vacant bed of the same hostel, a check-in date, the monthly rent and the security deposit. Rent defaults to the room's rent per bed, and the deposit to the hostel's default.

#### Scenario: Defaults offered

- **WHEN** a manager picks a bed in a room whose rent is ₹6,500 per bed, in a hostel whose default deposit is ₹5,000
- **THEN** the form proposes rent ₹6,500 and deposit ₹5,000, both editable

#### Scenario: Staff role

- **WHEN** a STAFF user tries to approve
- **THEN** the response is `403` with code `FORBIDDEN`

### Requirement: What approval does

Approval SHALL, in one step:

- make the resident ACTIVE with the chosen bed and check-in date
- mark the bed OCCUPIED
- create the rent plan from the check-in date, with the billing day set by the hostel's billing mode
- mark the ID document VERIFIED
- write an audit entry

Generating invoices is Phase 3.

#### Scenario: Approve

- **WHEN** a manager approves an application with bed 101-A, check-in 10 Mar 2026, rent ₹6,500 and deposit ₹5,000
- **THEN** the resident is ACTIVE in bed 101-A, the bed is OCCUPIED, and a rent plan of 650000 paise per month exists from 2026-03-10 with billing day 10

#### Scenario: Bed taken meanwhile

- **WHEN** the chosen bed became OCCUPIED after the form was opened
- **THEN** approval fails with `409` code `BED_UNAVAILABLE` and nothing changes

### Requirement: Reject with a reason

Owners and managers SHALL reject an application with a reason of 5 to 300 characters that the applicant will see. The application becomes REJECTED, its ID document REJECTED, and an audit entry is written. No bed or rent plan is touched.

#### Scenario: Reject

- **WHEN** a manager rejects with "ID photo is blurry, please retake it"
- **THEN** the application is REJECTED with that reason and leaves the queue

### Requirement: Decisions are final per application

Only PENDING_REVIEW applications SHALL be approved or rejected. Acting on an application that is no longer pending returns `409` code `NOT_PENDING`.

#### Scenario: Double approval

- **WHEN** two managers approve the same application at the same time
- **THEN** one approval succeeds and the other receives `409` with code `NOT_PENDING`
