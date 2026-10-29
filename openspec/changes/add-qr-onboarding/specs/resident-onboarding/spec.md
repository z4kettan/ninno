# Spec Delta

## Purpose

A new resident registers from their own phone by scanning the hostel's QR code: a short guided form whose submission, confirmed by an SMS code, is their signup.

## ADDED Requirements

### Requirement: Guided form

The join page SHALL collect, in six steps with a progress indicator:

1. **About you:** full name, date of birth, gender and a selfie.
2. **Contact:** mobile number, optional alternate number and email, and permanent address.
3. **Work or study:** student, working or other, with the institution or company.
4. **Emergency contact:** name, phone and relation.
5. **ID document:** see identity-documents.
6. **Review and consent.**

Each step validates before moving on, and the rules match the API's.

#### Scenario: Missing required field

- **WHEN** a resident tries to leave step 1 without a date of birth
- **THEN** an inline error under that field explains what is missing and the step does not advance

#### Scenario: Too young

- **WHEN** the date of birth makes the resident younger than 16
- **THEN** the step shows that residents must be at least 16

### Requirement: Draft kept on the device

Entered text SHALL be saved on the device as the resident types, so closing the tab does not lose it, and SHALL be removed from the device after a successful submission. Uploaded files are referenced only by their storage keys and are never copied into device storage.

#### Scenario: Tab closed mid-way

- **WHEN** a resident fills in step 2, closes the tab and opens the same link again
- **THEN** their earlier answers are back and they continue from where they were

#### Scenario: After submitting

- **WHEN** the submission succeeds
- **THEN** no part of the draft remains in the device's storage

### Requirement: Pincode autofill

Entering a valid 6-digit pincode SHALL fill in city and state from India Post's public pincode service when it answers within 4 seconds. Otherwise the resident types them. Only the pincode is sent to that service.

#### Scenario: Known pincode

- **WHEN** the resident enters `682030`
- **THEN** city and state are filled in (for example Ernakulam, Kerala) and stay editable

#### Scenario: Service unavailable

- **WHEN** the pincode service fails or is slow
- **THEN** city and state stay empty for the resident to type, with no error blocking the step

### Requirement: Consent

The review step SHALL show plain-language consent text covering why the data is collected, who can see it (the hostel's staff), how long it is kept, and how to ask for deletion. Submission requires the resident to tick the consent box, and the accepted text's version and time are stored with the application.

#### Scenario: Consent not given

- **WHEN** the resident taps "Verify and submit" without ticking consent
- **THEN** nothing is sent and the consent box is marked as required

### Requirement: Submission is signup

Submitting SHALL first send a 6-digit SMS code (purpose SIGNUP, with the otp-delivery rules) to the mobile number in the form. A correct code then creates, in one step: the user (or reuses the existing user with that number), a RESIDENT membership for the hostel, and an application with status PENDING_REVIEW. The resident is then signed in. A wrong code changes nothing.

#### Scenario: Successful signup

- **WHEN** a new resident submits a complete form and enters the correct code
- **THEN** they are signed in and see "Submitted, waiting for approval", and the application appears in the staff approvals queue

#### Scenario: Wrong code

- **WHEN** the code is wrong
- **THEN** no user, membership or application is created and the resident can retry

#### Scenario: Number already used by staff

- **WHEN** the mobile number belongs to an existing user (for example a staff member)
- **THEN** that user is reused and gains a RESIDENT membership, and no second user is created

### Requirement: No duplicate applications

A number that already has a PENDING_REVIEW or ACTIVE application at the hostel SHALL be refused with `409` code `ALREADY_REGISTERED` and a prompt to sign in instead. A previously REJECTED or MOVED_OUT resident MAY apply again, and the earlier record is kept.

#### Scenario: Pending applicant tries again

- **WHEN** someone whose application is pending submits again with the same number
- **THEN** the response is `409` with code `ALREADY_REGISTERED`

#### Scenario: Rejected applicant re-applies

- **WHEN** a resident whose earlier application was rejected submits a new one
- **THEN** a new PENDING_REVIEW application is created and the rejected one remains in history

### Requirement: Applicant status at home

A signed-in resident whose latest application is PENDING_REVIEW SHALL see that it is waiting for approval. One whose latest is REJECTED SHALL see the hostel's reason and how to re-apply (scan the QR again). One whose latest is ACTIVE SHALL see their room and bed.

#### Scenario: Rejected

- **WHEN** a resident whose application was rejected with "ID photo is blurry" signs in
- **THEN** their home shows that reason and says to scan the hostel's QR code to apply again
