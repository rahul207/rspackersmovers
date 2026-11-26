# Production-readiness checklist

Tick every item before launch. Items marked (blocker) must not ship unresolved.

## Business content

- [ ] (blocker) Replace `config/pricing.default.json` sample numbers with real, approved rates.
- [ ] (blocker) Set `BUSINESS_PHONE`, `BUSINESS_EMAIL`, `BUSINESS_ADDRESS`, `WHATSAPP_NUMBER` and social URLs in `.env`.
- [ ] (blocker) Replace the fictional demonstration clients and testimonials (`packages/infrastructure/src/content/static-content-repository.ts`) with verified, permission-cleared content - or remove the sections.
- [ ] Supply the logo in `assets/original/`, run `npm run assets:logo`, review output on light/dark backgrounds; commission a vector redraw if quality is insufficient.
- [ ] Review About/FAQ copy for claims that cannot be evidenced.
- [ ] Update `publicHolidays` in the pricing configuration each year.

## Legal and privacy

- [ ] (blocker) Legal review of privacy policy, cookie policy, terms, cancellation policy (shipped pages are placeholders) and of banner wording for each operating jurisdiction.
- [ ] Decide `DATA_RETENTION_DAYS`; align backup retention.
- [ ] Define the process for access/erasure requests (`DATA_REQUEST_EMAIL`).
- [ ] Confirm the geocoding provider's terms and privacy position (addresses/coordinates are sent to it).

## Security

- [ ] Generate unique `SESSION_SECRET` and `COOKIE_SIGNING_SECRET` (>= 32 chars, different) - production refuses placeholders.
- [ ] `PUBLIC_SITE_URL` is `https://...`; TLS terminated at the proxy; `TRUST_PROXY` set to the proxy hop count.
- [ ] `CORS_ALLOWED_ORIGINS` limited to real origins (empty for same-origin only).
- [ ] Enable `CAPTCHA_PROVIDER=turnstile` (with keys) if bot submissions appear.
- [ ] `npm run audit:deps` is clean (or exceptions documented); Dependabot/Renovate enabled.
- [ ] `storage/` volume encrypted, access-restricted and backed up off-host.
- [ ] `ENABLE_API_DOCS=false` if public API docs are not wanted.

## Reliability

- [ ] Exactly **one** API replica while storage is XLSX; restore procedure rehearsed ([deployment.md](./deployment.md)).
- [ ] Monitoring/alerts on `/api/v1/readiness`; log shipping (structured JSON, no PII).
- [ ] The default `MAP_PROVIDER=india` calls several public, fair-use endpoints (Photon,
      Open-Meteo, Nominatim, India Post); for high-volume production traffic, self-host Photon,
      sign up for LocationIQ's free tier (`MAP_PROVIDER=locationiq`, no credit card), or switch
      `MAP_PROVIDER=google` (with a restricted key) instead.
- [ ] Plan the PostgreSQL migration before volume grows ([postgres-migration.md](./postgres-migration.md)).

## Quality gates

- [ ] CI green: lint, format check, typecheck, unit/integration tests, production build, audit, browser tests.
- [ ] Lighthouse (mobile, production build, throttled): Performance >= 90; Accessibility, Best Practices, SEO >= 95. LCP < 2.5 s, CLS < 0.1, INP < 200 ms.
- [ ] Manual accessibility pass: keyboard-only, screen reader (NVDA/VoiceOver), 200% zoom, 320 px width, reduced motion.
- [ ] Cross-browser check including Safari/iOS and a low-end Android device (3D layer is skipped on low-power devices).
- [ ] End-to-end test of the WhatsApp hand-off from a real phone with the real business number.
