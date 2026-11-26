# Architecture

> **Important - XLSX storage is a stop-gap.** The first version stores quotes, contact requests,
> consent records and visitor analytics in `.xlsx` workbooks under `storage/`. XLSX is suitable
> only for a **single instance with low volume**. It is **not a transactional, multi-user
> database**: every write re-reads and re-writes the whole workbook, there are no constraints, no
> indexes, no cross-process locking and no point-in-time recovery. Plan the move to PostgreSQL
> (see [postgres-migration.md](./postgres-migration.md)) before traffic or data-protection duties
> outgrow it.

## Principal assumptions

- The business is an Indian relocation/courier company; prices are in INR and the primary channel
  for finishing a booking is **WhatsApp**. The website prepares and stores a quote request; the
  operations team confirms the final price.
- One API instance serves both the JSON API and the built React app (same origin), so CSRF and
  cookie handling stay simple. A reverse proxy/CDN terminates TLS.
- No real logo, price list, business address, phone, WhatsApp number or testimonials were
  supplied. Everything is configuration (`.env`, `config/pricing.default.json`) or clearly flagged
  demonstration content.
- Distances are approximate (straight-line x configurable road factor). There is no routing
  provider, so the UI never presents a line as a driving route.

## Style: DDD + Clean/Hexagonal

Dependencies point **inward**:

```
apps/web  ─────────────► packages/shared
apps/api  ──► packages/infrastructure ──► packages/application ──► packages/domain ──► packages/shared
        └──────────────────────────────► (composition root wires adapters to ports)
```

| Package                   | Contains                                                                                                           | May import                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `packages/shared`         | zod schemas, constants, DTO types, pure utils (sanitising, phone, haversine)                                       | `zod` only                                   |
| `packages/domain`         | entities, value objects (`Money`), pricing engine, WhatsApp message builder, policies, errors                      | `shared`                                     |
| `packages/application`    | use cases, **ports** (repository/provider interfaces), `ApplicationError`                                          | `shared`, `domain`                           |
| `packages/infrastructure` | Excel repositories, JSON pricing repository, geocoding adapters, captcha, idempotency, PostgreSQL **placeholders** | `shared`, `domain`, `application`, `exceljs` |
| `apps/api`                | Fastify presentation layer, env validation, composition root, security plugins                                     | everything above                             |
| `apps/web`                | React UI                                                                                                           | `shared` only                                |

The rule is enforced twice: ESLint `no-restricted-imports` per layer (`eslint.config.js`) and an
architecture test (`tests/architecture/dependency-rules.test.ts`) that fails CI on a violation.
Domain and application never import Fastify, React, ExcelJS, PostgreSQL or Node built-ins.

## Bounded contexts

Each context is split across the layers (domain -> application -> infrastructure -> presentation):

| Context                     | domain                                                       | application                                                                                     | infrastructure                                  | presentation                                     |
| --------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| Booking & Quote Request     | `domain/src/booking`                                         | `application/src/booking`                                                                       | `infrastructure/src/booking`                    | `apps/api/src/contexts/booking`                  |
| Location & Distance         | `domain/src/location`                                        | `application/src/content/use-cases.ts` (search)                                                 | `infrastructure/src/location`                   | `apps/api/src/contexts/location`                 |
| Pricing                     | `domain/src/pricing`                                         | `application/src/pricing`                                                                       | `infrastructure/src/pricing`                    | `apps/api/src/contexts/pricing`                  |
| Contact & Lead Management   | `domain/src/contact`                                         | `application/src/contact`                                                                       | `infrastructure/src/contact`                    | `apps/api/src/contexts/contact`                  |
| Consent & Visitor Analytics | `domain/src/consent`, `domain/src/analytics`                 | `application/src/consent`, `.../analytics`                                                      | `infrastructure/src/consent`, `.../analytics`   | `apps/api/src/contexts/consent`, `.../analytics` |
| Content & Testimonials      | `domain/src/content`                                         | `application/src/content`                                                                       | `infrastructure/src/content`                    | `apps/api/src/contexts/content`                  |
| Shared Kernel               | `domain/src/shared-kernel` (Money, time, references, errors) | `application/src/shared-kernel` (Clock, IdGenerator, Logger, IdempotencyStore, CaptchaVerifier) | `infrastructure/src/shared-kernel`, `.../excel` | `apps/api/src/contexts/shared-kernel`            |

Repository ports: `QuoteRepository`, `ContactRequestRepository`, `ConsentRepository`,
`VisitorAnalyticsRepository`, `PricingConfigurationRepository` (plus `ContentRepository` and
`LocationSearchProvider`). Excel adapters implement them today; `infrastructure/src/postgres`
holds documented placeholders that throw `PostgresNotImplementedError`.

## Key flows

**Quote:** form -> `POST /api/v1/quotes` -> Zod validation (server) -> bot checks (honeypot +
optional Turnstile) -> idempotency guard (same customer/route/date/vehicle = same quote) ->
server-side distance + price estimate -> quotation consent record -> unique reference
`RSPM-YYYYMMDD-XXXX` -> Excel append (mutex + atomic rename) -> WhatsApp message + `wa.me` URL ->
client opens WhatsApp and always shows a copyable fallback.

**Consent:** the banner decision is stored in `localStorage` (UI state) and `POST /consents`
(record + signed HttpOnly `rs_consent`/`rs_vid` cookies). The server only accepts analytics when
the **signed cookie** proves consent - a request body can never grant it. Quotation/contact
consent is recorded separately and never turns on an optional category.

## Pricing model

`subtotal = baseCharge + extraDistanceCharge + helperCharge + floorCharge + packingCharge +
unpackingCharge + insuranceCharge + applicableSurcharges`, then discount -> tax -> minimum order ->
rounding. Details and the configuration schema: `packages/shared/src/schemas/pricing-config.ts`,
sample values: `config/pricing.default.json` (**sample numbers, not real rates**).
"Base charge" includes the vehicle base plus an additional-load (extra rooms) line. Manual
quotation is returned above the distance, room-count or amount thresholds.

## Excel storage design

`WorkbookStore` (`packages/infrastructure/src/excel/workbook-store.ts`):

- **Process-level mutex** per file (`withFileLock`), FIFO, failure-isolated.
- **Atomic writes:** write `.tmp-*.xlsx` in the same directory, then `rename` (with retries for
  transient Windows/OneDrive locks).
- **Formula-injection protection:** text starting with `=`, `+`, `-`, `@`, tab or CR is stored
  with a leading apostrophe and cells are text-typed.
- **Backups:** timestamped copy into `storage/backups/` at most once per
  `XLSX_BACKUP_MIN_INTERVAL_MINUTES`, keeping `XLSX_BACKUPS_TO_KEEP`.
- **Corruption safety:** an unreadable workbook is never overwritten; the API reports
  `STORAGE_UNAVAILABLE` and `/readiness` fails.
- Missing worksheets/columns are created/added automatically.
- **Limits:** single process only; O(n) per write; no transactions across the four workbooks.

## Security summary

Helmet + strict CSP (`script-src 'self'`, no inline scripts), CORS allowlist, Origin check and
signed double-submit CSRF token on every mutating call, rate limiting (global + stricter on
submissions), 32 KB body limit, JSON-only parsing, server-side Zod validation and text
sanitising, signed HttpOnly SameSite cookies, honeypot + Turnstile adapter, idempotency,
structured logs without personal data (query strings, IPs, bodies, coordinates are never
logged), generic public errors with correlation IDs. No upload endpoint exists; the logo
pipeline is an offline script that only accepts PNG/JPEG/WebP by magic bytes (SVG is rejected).

## Observability

`GET /api/v1/health` (liveness), `GET /api/v1/readiness` (all four workbooks + pricing
config). Every response carries `X-Correlation-Id`, echoed in the error envelope.
