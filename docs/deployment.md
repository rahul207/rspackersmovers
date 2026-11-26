# Deployment

## Local development

```powershell
npm install
Copy-Item .env.example .env        # edit values; set WHATSAPP_NUMBER to test the redirect
npm run dev                        # API on :3000, web (Vite) on :5173 with /api proxied
```

Open <http://localhost:5173>. API docs (Swagger UI): <http://localhost:3000/api/docs>.

Quality gates: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
`npm run test:e2e` (needs `npx playwright install chromium` once, and `npm run build` first).
`npm run check` runs lint + typecheck + tests + build.

## Production build

```powershell
npm ci
npm run build                      # web -> apps/web/dist, api -> apps/api/dist
$env:NODE_ENV = 'production'       # plus the variables from .env.example
npm start                          # node apps/api/dist/main.js
```

In production the API serves the built web app, injects the canonical URL and JSON-LD into
`index.html`, sets long-lived immutable caching on `/assets/*`, and compresses responses
(brotli/gzip). Production refuses to start with an `http://` `PUBLIC_SITE_URL`, placeholder
secrets, or identical secrets.

## Docker

```powershell
docker compose up --build -d       # reads .env; ./storage is mounted at /app/storage
docker compose logs -f app
```

The container runs as the non-root `node` user, read-only root filesystem, no capabilities,
with a `/api/v1/health` health check. Terminate TLS at a reverse proxy (Caddy, nginx, a cloud
load balancer) and set `TRUST_PROXY=1` so rate limiting sees client IPs. Run **one** replica
only while storage is XLSX.

## Hosting checklist

- HTTPS everywhere; HSTS is sent automatically when `PUBLIC_SITE_URL` is https.
- Forward the CDN country header configured in `GEO_COUNTRY_HEADER` (optional).
- Keep `storage/` on a persistent, access-restricted, encrypted volume. It contains personal data.
- Alert on `/api/v1/readiness` returning 503.

## Backup and restore

Workbooks live in `storage/`; rotating backups are written to `storage/backups/` as
`<name>.<UTC timestamp>.xlsx` (at most one per `XLSX_BACKUP_MIN_INTERVAL_MINUTES`, newest
`XLSX_BACKUPS_TO_KEEP` kept). The rotated copy is the file **before** the latest change, so it
can lag by up to one interval - copy `storage/` off the host as well.

**Backup (recommended, daily, off-host and encrypted):**

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Compress-Archive -Path storage\*.xlsx -DestinationPath "backup-$stamp.zip"
```

**Restore:**

1. Stop the API (`docker compose stop app` or stop the process) - it holds no lock across
   processes, so never replace files while it is running.
2. Copy the chosen workbook over `storage/<file>.xlsx` (for example from
   `storage/backups/quote-requests.20261126T053000Z.xlsx`).
3. Start the API and check `GET /api/v1/readiness`.

If a workbook is corrupt the API refuses to write to it (it never overwrites unreadable data)
and `/readiness` reports `storage_error`; restore from backup.

**Retention:** personal data older than `DATA_RETENTION_DAYS` is deleted at start-up and every
24 hours (all four workbooks). Backups are copies - delete or rotate them under the same policy.

## Logo assets

Place the supplied logo in `assets/original/` and run `npm run assets:logo`. See
[brand-assets.md](./brand-assets.md).
