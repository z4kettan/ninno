# Spec Delta

## Purpose

The Ninno web app's frame: how people sign in, how the app keeps them signed in, which area each role sees, and the visual and accessibility baseline every screen inherits.

## ADDED Requirements

### Requirement: Sign in with phone and code

The login screen SHALL ask for a 10-digit Indian mobile number (with +91 shown as a fixed prefix), request a code, and then show a 6-digit code screen with the masked number, a resend countdown, a "Change number" action and SMS autofill. A correct code signs the user in. The screen MUST NOT reveal whether the number has an account.

#### Scenario: Request a code

- **WHEN** a user enters `98765 43210` and taps "Send code"
- **THEN** the code screen shows "Sent to +91 ••••••3210" and a resend countdown starting at 30 seconds

#### Scenario: Invalid number

- **WHEN** a user enters `12345` and taps "Send code"
- **THEN** an inline error under the field says the number must be a 10-digit Indian mobile number, and no request is sent

#### Scenario: Correct code

- **WHEN** the user enters the code they received
- **THEN** they are signed in and taken to their area without a full page reload

### Requirement: Plain-language login errors

Login failures SHALL be shown in plain language next to the code input, keeping the entered number: a wrong or expired code, a locked code (with a prompt to request a new one), a cooldown (with the remaining seconds), a delivery failure (asking to try again), and a rate limit.

#### Scenario: Wrong code

- **WHEN** the API answers `401 OTP_INVALID`
- **THEN** the screen says the code is wrong or expired, clears the boxes, and keeps focus in the first box

#### Scenario: Locked

- **WHEN** the API answers `401 OTP_LOCKED`
- **THEN** the screen says there were too many wrong attempts and offers "Send a new code"

### Requirement: Session kept in memory and restored by cookie

The access token SHALL be held only in memory, never in localStorage or sessionStorage. On app start the client SHALL try to restore the session through the refresh cookie. When an API call returns 401, the client refreshes once and retries the call. If the refresh fails, the user is returned to the login screen. Logout ends the session on the server and in the client.

#### Scenario: Reopening the app

- **WHEN** a signed-in user closes and reopens the app within 30 days
- **THEN** they land in their area without entering a code

#### Scenario: Expired access token mid-use

- **WHEN** an API call returns 401 and the refresh succeeds
- **THEN** the call is retried once with the new token and the user notices nothing

#### Scenario: Nothing in web storage

- **WHEN** a user is signed in
- **THEN** neither localStorage nor sessionStorage contains an access or refresh token

### Requirement: Areas by role

Users whose memberships include OWNER, MANAGER or STAFF SHALL land in the staff area (`/admin`). Users who are only residents SHALL land in the resident area (`/home`). Each area MUST refuse users without the matching role and send them to their own area. Signed-out users opening any area are sent to login, then back to where they were going.

#### Scenario: Owner signs in

- **WHEN** the seeded owner completes login
- **THEN** the staff overview opens with the hostel's name in the shell

#### Scenario: Resident opens a staff link

- **WHEN** a resident navigates to `/admin`
- **THEN** they are redirected to `/home`

#### Scenario: Deep link while signed out

- **WHEN** a signed-out user opens `/admin/residents`
- **THEN** they see the login screen, and after signing in they land on `/admin/residents`

### Requirement: Navigation shells

The resident area SHALL use a bottom tab bar (Home, Payments, Profile). The staff area SHALL use a bottom tab bar on screens narrower than 1024px (Overview, Residents, Beds, More) and a labelled sidebar from 1024px (Overview, Residents, Approvals, Beds, Payments, Settings), with the product mark and the hostel's name. The active destination is marked by the hue's pale tint and its text, never by colour alone.

#### Scenario: Phone width

- **WHEN** the staff area is shown at 360px wide
- **THEN** a bottom tab bar is visible, no sidebar is shown, and nothing scrolls sideways

#### Scenario: Desktop width

- **WHEN** the staff area is shown at 1280px wide
- **THEN** a labelled sidebar shows the six destinations and the hostel's name, and there is no bottom bar

### Requirement: Honest empty states

Screens whose features arrive in later phases SHALL keep their title and frame and show one plain sentence about what will appear there. They MUST NOT show sample or invented data.

#### Scenario: Residents before onboarding exists

- **WHEN** staff open Residents in Phase 1
- **THEN** the screen shows the title "Residents" and a sentence that residents appear here once they join by QR code, with no fake rows

### Requirement: Accessibility and reach baseline

Every screen SHALL work at 360px wide without sideways scrolling, give every tap target at least 44×44px, keep text contrast at 4.5:1 or more in light and dark themes, show a visible focus ring for keyboard users, and label every control for screen readers. The theme follows the device setting.

#### Scenario: Dark device setting

- **WHEN** the device prefers a dark colour scheme
- **THEN** the app uses the dark tokens and all text still meets 4.5:1

#### Scenario: Keyboard only

- **WHEN** a keyboard user tabs through the login screen
- **THEN** every control receives a visible focus ring in order, and the code can be entered and submitted without a mouse

### Requirement: Indian formats

Money SHALL be shown from paise as `₹6,500` (Indian grouping, no decimals for whole rupees) and dates as `10 Mar 2026` in IST, using the shared formatting rules.

#### Scenario: Rent amount

- **WHEN** an amount of 650000 paise is displayed
- **THEN** it reads `₹6,500` in the app's own typeface, including the ₹ sign
