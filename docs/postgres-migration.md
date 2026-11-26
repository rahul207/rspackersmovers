# Migrating from XLSX to PostgreSQL

The repository ports in `packages/application` do not change. Implement the four placeholder
classes in `packages/infrastructure/src/postgres/placeholders.ts`, add a connection pool (for
example `pg`) in the composition root (`apps/api/src/composition-root.ts`), switch on
`DATABASE_URL`, and keep the Excel adapters for the one-off import below.

Proposed schema: [migrations/001_initial.sql](./migrations/001_initial.sql).

## Column -> table mapping

### `quote-requests.xlsx` -> `quote_requests`

| Workbook column                     | PostgreSQL column                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| Reference number                    | `reference_number text primary key`                                                   |
| Created timestamp                   | `created_at timestamptz not null`                                                     |
| Customer name                       | `customer_name text not null`                                                         |
| Mobile number                       | `mobile text not null` (`91XXXXXXXXXX`)                                               |
| Email                               | `email text null`                                                                     |
| Pickup address                      | `pickup_address text not null`                                                        |
| Pickup latitude/longitude           | `pickup_latitude`, `pickup_longitude numeric(9,6)` (or a PostGIS `geography`)         |
| Drop address / latitude / longitude | `drop_address`, `drop_latitude`, `drop_longitude`                                     |
| Distance (km)                       | `distance_km numeric(8,1)`                                                            |
| Move type                           | `move_type text` + check constraint                                                   |
| Vehicle type                        | `vehicle_type text` + check constraint                                                |
| Pickup date                         | `pickup_date date`                                                                    |
| Price estimate (INR)                | `estimate_total numeric(12,2) null` (null = manual quotation)                         |
| Price breakdown                     | `estimate jsonb` (store the full `PriceEstimateResult`; the workbook only holds text) |
| Notes                               | `notes text null`                                                                     |
| Consent reference                   | `consent_id uuid references consent_records(consent_id)`                              |
| Status                              | `status text` + check constraint                                                      |
| Source page                         | `source_page text`                                                                    |

### `contact-requests.xlsx` -> `contact_requests`

Request ID -> `request_id text primary key`; Created timestamp -> `created_at`; Name -> `name`;
Mobile number -> `mobile`; Email -> `email`; Subject -> `subject`; Message -> `message`;
Preferred contact method -> `preferred_contact_method`; Consent reference -> `consent_id`
(FK); Status -> `status`; Source page -> `source_page`.

### `consent-records.xlsx` -> `consent_records`

Consent ID -> `consent_id uuid primary key`; Timestamp -> `created_at timestamptz`; Anonymous
visitor ID -> `visitor_id uuid null`; Purpose -> `purpose`; Consent version -> `consent_version`;
Necessary / Analytics / Marketing cookies -> `necessary`, `analytics`, `marketing` booleans
(workbook holds `GRANTED`/`DENIED`); Location processing -> `location boolean`; Privacy notice
version -> `privacy_notice_version`.

### `visitor-analytics.xlsx` -> `visitors`

Anonymous visitor ID -> `visitor_id uuid primary key`; First visit / Last visit ->
`first_visit`, `last_visit timestamptz`; Landing page -> `landing_page`; Referral category ->
`referral_category`; Campaign source/medium/name -> `campaign_source`, `campaign_medium`,
`campaign_name`; Device category / Browser family / Operating system family ->
`device_category`, `browser_family`, `os_family`; Preferred language -> `language`;
Approximate country/region -> `region`; Consent status -> `consent_status`.

## Behavioural differences to implement

- `save` must raise `DuplicateReferenceError` on unique-violation (`23505`) so the use case
  retries with a new reference.
- `recordVisit` becomes `INSERT ... ON CONFLICT (visitor_id) DO UPDATE SET last_visit = excluded.last_visit`.
- `deleteOlderThan` becomes `DELETE ... WHERE created_at < $1` (visitors: `last_visit`).
  Schedule it (the API already runs `PurgeExpiredData` at start-up and every 24 h).
- Replace `ping()` with `SELECT 1`.
- Move idempotency (`InMemoryIdempotencyStore`) to a table or Redis when you run more than one
  instance.

## One-off import

1. Stop the API (or put the site in maintenance) and take a backup (see
   [deployment.md](./deployment.md#backup-and-restore)).
2. Run the migration SQL.
3. Read each workbook with ExcelJS (header row -> keys) and insert in a transaction in this order:
   `consent_records`, `quote_requests`, `contact_requests`, `visitors`. Convert
   `GRANTED/DENIED` to booleans, strip the leading apostrophe added by the formula guard
   (`unescapeSpreadsheetValue`), and parse ISO timestamps.
4. Verify row counts against the workbooks, deploy the PostgreSQL adapters, then archive the
   workbooks securely (they contain personal data).
