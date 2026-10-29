# Spec Delta

## Purpose

How Ninno handles the most sensitive data it holds: residents' selfies and government ID photos. Files are private, numbers are masked, images are cleaned before storage, and every view by staff is recorded.

## ADDED Requirements

### Requirement: One ID document and a selfie

An application SHALL include a selfie and exactly one government ID of type Aadhaar, Voter ID, Passport, Driving Licence, PAN or Other. It needs the ID's number, a front photo, and a back photo for the types that have one: Aadhaar, Voter ID and Driving Licence. ID photos may be JPEG, PNG or PDF. The selfie must be JPEG or PNG.

#### Scenario: Aadhaar without back

- **WHEN** an Aadhaar is submitted with only a front photo
- **THEN** the step shows that the back photo is required

#### Scenario: PAN

- **WHEN** a PAN card is submitted with a front photo only
- **THEN** it is accepted

### Requirement: Aadhaar checks and masking

Aadhaar numbers SHALL be checked as 12 digits with a valid Verhoeff checksum, on the device and again on the server. Only the masked form `XXXX-XXXX-1234` is stored. The full number MUST NOT be stored or logged anywhere. Other ID numbers are stored masked to their last 4 characters.

#### Scenario: Typo in Aadhaar

- **WHEN** an Aadhaar number with a wrong check digit is entered
- **THEN** the field shows that the number is not a valid Aadhaar number

#### Scenario: Stored form

- **WHEN** a valid Aadhaar `2341 2341 2346` is submitted
- **THEN** the database holds `XXXX-XXXX-2346` and no record contains all 12 digits

### Requirement: Direct, private uploads

Files SHALL be uploaded from the phone straight to private storage through short-lived signed upload URLs (valid for 10 minutes or less) that fix the content type and size. Each file is at most 5 MB. Images are compressed on the phone to about 1 MB and at most 2560px before upload. Storage MUST NOT allow public reads.

#### Scenario: Oversized file

- **WHEN** an upload URL is requested for a 6 MB file
- **THEN** the request is refused with `400` and code `FILE_TOO_LARGE`

#### Scenario: Anonymous read

- **WHEN** anyone requests a stored ID object without a signed URL
- **THEN** storage denies access

### Requirement: Server-side checks and cleaning

On submission, the server SHALL confirm that each referenced file exists, is within the size limit, and starts with the signature of its declared type. It SHALL reject a mismatch with code `FILE_INVALID`. Images are re-encoded, which removes all metadata (EXIF, including location). ID images additionally receive a "For <hostel name> KYC only" watermark. Only the cleaned files are kept, and the originals are deleted.

#### Scenario: Renamed file

- **WHEN** a file declared as image/jpeg actually starts with a PDF signature
- **THEN** the submission is refused with code `FILE_INVALID`

#### Scenario: Location metadata

- **WHEN** a selfie with GPS coordinates in its EXIF data is submitted
- **THEN** the stored selfie contains no EXIF data

### Requirement: Viewing is time-limited and audited

Staff with access to the hostel SHALL view selfies and ID photos only through signed links valid for 5 minutes or less. Every such view SHALL write an audit entry (`document.viewed` or `photo.viewed`) naming the staff member, the resident and the file. Residents see only their document's type, masked number and verification status, never the images through the app.

#### Scenario: Staff views an ID

- **WHEN** a manager opens an applicant's ID front
- **THEN** the image loads through a signed link that expires within 5 minutes, and an audit entry records who viewed which file

#### Scenario: Another hostel's staff

- **WHEN** staff of another organisation request a view link for this resident's ID
- **THEN** the response is `404` with code `NOT_FOUND`

### Requirement: Abandoned uploads are removed

Files uploaded for a form that is never submitted SHALL be deleted within about a day.

#### Scenario: Abandoned form

- **WHEN** a draft's files are more than 24 hours old and were never submitted
- **THEN** the daily clean-up removes them
