# shared-formatting Specification

## Purpose

One shared set of rules for converting money, dates and phone numbers between storage and display, so the web app and API never disagree about what a value means.

## Requirements

### Requirement: Money stored as integer paise

Monetary amounts SHALL be represented as integer paise. Conversion from rupee input SHALL reject values with more than two decimal places, negative values and non-numeric text, and MUST NOT use floating-point arithmetic for the stored result.

#### Scenario: Rupee input to paise

- **WHEN** the rupee input `"6500.50"` is converted
- **THEN** the result is `650050` paise

#### Scenario: Too many decimals

- **WHEN** the rupee input `"10.005"` is converted
- **THEN** the conversion fails with an invalid-amount error

### Requirement: INR display format

Amounts SHALL be displayed in Indian digit grouping with the ₹ symbol, without decimals when the paise part is zero and with exactly two decimals otherwise.

#### Scenario: Whole rupees

- **WHEN** `650000` paise is formatted
- **THEN** the output is `₹6,500`

#### Scenario: Lakh grouping with paise

- **WHEN** `12345678` paise is formatted
- **THEN** the output is `₹1,23,456.78`

### Requirement: IST calendar dates

Calendar dates (due dates, check-in dates) SHALL be computed in the `Asia/Kolkata` time zone regardless of the server or device time zone, and SHALL be displayed as `D MMM YYYY`.

#### Scenario: UTC instant late in the day

- **WHEN** the instant `2026-03-09T20:00:00Z` is converted to an IST calendar date
- **THEN** the date is `2026-03-10`

#### Scenario: Display

- **WHEN** the date `2026-03-10` is formatted for display
- **THEN** the output is `10 Mar 2026`

### Requirement: Indian phone normalisation

Phone input SHALL be normalised to E.164 `+91XXXXXXXXXX`. Ten-digit mobile numbers starting with 6–9 are accepted with or without `+91`, `91`, `0`, spaces or dashes. Anything else MUST be rejected. Masked display SHALL show only the last four digits.

#### Scenario: Local format

- **WHEN** `098765 43210` is normalised
- **THEN** the result is `+919876543210`

#### Scenario: Invalid leading digit

- **WHEN** `5876543210` is normalised
- **THEN** normalisation fails with an invalid-phone error

#### Scenario: Masked display

- **WHEN** `+919876543210` is masked
- **THEN** the output is `+91 ••••••3210`
