# API

Interactive OpenAPI (Swagger UI): `/api/docs` (JSON: `/api/docs/json`). Disable with
`ENABLE_API_DOCS=false`.

## Conventions

- Base path `/api/v1`. JSON only (`415` otherwise), bodies up to 32 KB (`413`).
- **Envelope:** `{ "success": true, "data": ..., "meta": { "correlationId": "..." } }` or
  `{ "success": false, "error": { "code", "message", "fieldErrors?" }, "meta": { ... } }`.
- **Correlation ID:** send `X-Correlation-Id` (8-64 chars `[A-Za-z0-9._-]`) or one is generated;
  it is echoed in the response header and `meta`.
- **CSRF:** `GET /config/public` returns `data.csrfToken` and sets the signed `rs_csrf` cookie.
  Every `POST` must send `X-CSRF-Token: <token>`, and `Origin` (when present) must be allowed.
- **Error codes:** `VALIDATION_FAILED` (400, `fieldErrors` keyed by dotted path),
  `CSRF_INVALID` (403), `RATE_LIMITED` (429), `NOT_FOUND` (404), `CAPTCHA_FAILED` /
  `SUBMISSION_REJECTED` (400), `PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415),
  `STORAGE_UNAVAILABLE` (503), `UPSTREAM_UNAVAILABLE` (502), `INTERNAL_ERROR` (500). Public
  messages are generic; details are in server logs under the correlation ID.

## Endpoints

| Method | Path                   | Purpose                                                                    |
| ------ | ---------------------- | -------------------------------------------------------------------------- |
| GET    | `/config/public`       | Business details, pricing summary, flags, CSRF token (no secrets)          |
| GET    | `/content`             | Services, FAQ, **demonstration** clients and testimonials                  |
| POST   | `/price-estimates`     | Indicative estimate + breakdown, or `MANUAL_QUOTATION_REQUIRED`            |
| POST   | `/quotes`              | Validate, estimate, store, return reference + WhatsApp URL/message         |
| POST   | `/contact-requests`    | Store a contact request, return `requestId`                                |
| POST   | `/consents`            | Record cookie preferences; sets signed `rs_vid` and `rs_consent`           |
| POST   | `/analytics/events`    | Privacy-conscious page view (stored only with analytics consent)           |
| GET    | `/locations/search?q=` | Address autocomplete via the configured provider                           |
| POST   | `/locations/reverse`   | Coordinates (explicit user action) -> address; POST keeps them out of URLs |
| GET    | `/health`              | Liveness                                                                   |
| GET    | `/readiness`           | Storage + pricing configuration checks (503 when not ready)                |

Also served (not enveloped): `/robots.txt`, `/sitemap.xml`.

## Duplicate protection

A quote with the same mobile, pickup/drop coordinates, date, move type and vehicle within 10
minutes returns the original quote (concurrent requests share one execution). Contact requests
use mobile + subject + message. Single-process only (see the architecture note).
