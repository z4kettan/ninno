# Proposal

## Why

Hostel data collected for operations can also help people find a place to stay, and gives hostels a reason to list on Ninno. This is the second half of build-guide **Phase 4** (§10).

## What Changes

- A public `/find` page with a map (Leaflet + OpenStreetMap), a "near me" search using browser geolocation, and a list view.
- PostGIS `geography(Point)` on Hostel with a GiST index, and a distance-ordered search API.
- Filters: gender policy, price range (derived from rent plans and room rates), and amenities.
- Only hostels with `is_listed_publicly = true` appear, and only public fields are exposed. Resident data never is.
- An SEO-friendly page per hostel (Angular SSR for the `/find` and `/h/:slug` routes).

## Capabilities

### New Capabilities

- `hostel-discovery`: public search and listing of hostels by location and filters.

### Modified Capabilities

- `hostel-inventory`: public listing flag and public profile fields.

## Out of scope

- Booking or enquiries through the finder, and reviews.

## Impact

- PostGIS extension migration, a public unauthenticated API with tight rate limits, and SSR hosting for the public routes.
