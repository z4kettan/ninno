# pwa Specification

## Purpose

Lets residents and staff add Ninno to their phone's home screen and open it like an app, loading fast on slow connections, without ever caching personal data.

## Requirements

### Requirement: Installable

The production build SHALL be installable from Chrome on Android: a web manifest with the name "Ninno", a short name, the green theme colour, standalone display, a start URL inside the app, and 192px and 512px icons including maskable versions, served over HTTPS with a registered service worker.

#### Scenario: Chrome installability check

- **WHEN** Chrome's installability check runs against the production build
- **THEN** it reports no installability errors

### Requirement: Install prompt

When the browser offers installation, the app SHALL show a dismissible "Add Ninno to your home screen" prompt once per device, and on iOS Safari (which offers no prompt) it SHALL show the manual steps instead. Dismissal is remembered on the device.

#### Scenario: Dismissed

- **WHEN** a user dismisses the install prompt
- **THEN** it does not appear again on that device

### Requirement: Caching rules

The service worker SHALL cache only the app shell and static assets (scripts, styles, fonts, icons). It MUST NOT cache any API response, and MUST NOT cache uploaded documents or images from storage.

#### Scenario: API response

- **WHEN** the app fetches `/api/v1/auth/me` while a service worker is active
- **THEN** the response is not stored in any service-worker cache

### Requirement: Offline behaviour

When the network is unavailable, the app SHALL still open from the home screen and show an offline screen that says the connection is lost, with a Retry action. It never shows the browser's own error page for app routes.

#### Scenario: Opened offline

- **WHEN** an installed user opens Ninno with no connection
- **THEN** the app shell loads and shows the offline screen with Retry

### Requirement: Update prompt

When a new version of the app has been downloaded in the background, the app SHALL show a banner offering to reload into the new version. It never reloads on its own while the user is working.

#### Scenario: New version deployed

- **WHEN** a new build is detected by the service worker
- **THEN** a banner "A new version of Ninno is ready" with a "Reload" action appears
