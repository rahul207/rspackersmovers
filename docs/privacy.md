# Privacy and consent

> **Not legal advice.** The wording, categories, retention periods and policy pages in this
> project are working drafts. They must be reviewed by qualified counsel for every jurisdiction
> in which the site operates (for example India's DPDP Act, and GDPR/ePrivacy if EU/UK visitors
> are in scope) before launch. The shipped policy pages are placeholders.

## What is collected, why, and where

| Data                         | Purpose                           | Stored in                        | Condition                             |
| ---------------------------- | --------------------------------- | -------------------------------- | ------------------------------------- |
| Quote form fields            | Prepare and follow up a quotation | `quote-requests.xlsx`            | Quotation consent checkbox            |
| Contact form fields          | Respond to an enquiry             | `contact-requests.xlsx`          | Contact consent checkbox              |
| Consent decisions + versions | Prove consent                     | `consent-records.xlsx`           | Always (necessary)                    |
| Anonymous visitor profile    | Understand site usage             | `visitor-analytics.xlsx`         | **Analytics consent only**            |
| Browser geolocation          | Fill an address once              | Not stored; sent to the geocoder | User clicks "Use my current location" |

Quotation/contact consent is recorded as its own consent record (purpose `QUOTATION`/`CONTACT`)
with every optional cookie category denied - it can never act as marketing or analytics consent.

## Visitor analytics

Stored only with analytics consent: anonymous visitor ID, first/last visit, landing **path**
(query string removed), referral category, UTM source/medium/campaign, device category, browser
family, OS family, language, approximate country/region (only from a trusted CDN header,
`GEO_COUNTRY_HEADER`) and consent status.

**Never stored:** IP addresses, raw user agents, fingerprints, advertising IDs, precise
coordinates, hardware identifiers, URLs with query strings. Bots are ignored.

## Cookies

| Cookie       | Category   | Lifetime | Purpose                                                     |
| ------------ | ---------- | -------- | ----------------------------------------------------------- |
| `rs_csrf`    | Necessary  | session  | Signed CSRF nonce (HttpOnly, SameSite=Strict)               |
| `rs_vid`     | Necessary* | 180 days | Anonymous ID that links your consent record (HttpOnly, Lax) |
| `rs_consent` | Necessary  | 180 days | Signed copy of your decision so the server can enforce it   |

\* Set only after you make a cookie choice. Analytics code reads it only if you consented.
`localStorage` key `rs_consent_v1` holds the decision for the banner UI.

## Consent UX rules implemented

- Banner appears before any optional processing; **Accept all**, **Reject non-essential** and
  **Customize preferences** have equal prominence; nothing optional is pre-selected.
- Analytics and marketing stay disabled until accepted; the server rejects analytics without the
  signed cookie. No marketing scripts are bundled - a placeholder shows where to gate one.
- A permanent **Cookie settings** control in the footer lets users change or withdraw consent.
- Geolocation is requested only after an explicit click with an explanation, never on load.
- Consent and privacy-notice versions (`CONSENT_VERSION`, `PRIVACY_NOTICE_VERSION` in
  `packages/shared/src/constants.ts`) are stored with each decision; bump them to re-ask.

## Data subject requests and retention

- `DATA_REQUEST_EMAIL` (falls back to `BUSINESS_EMAIL`) is surfaced as the data-request contact.
  Handling access/erasure requests is a manual process on the workbooks until PostgreSQL.
- `DATA_RETENTION_DAYS` (default 365) is applied automatically to all four workbooks. Choose the
  real period with legal advice; backups must follow the same policy.

## Logging

Structured logs contain event names, status codes and correlation IDs only. Request bodies,
query strings (which may hold typed addresses), cookies, IP addresses and coordinates are never
logged; a test (`apps/api/tests/api.test.ts`, "privacy of logs") enforces this.
