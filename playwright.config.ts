import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;

// The suite runs against the PRODUCTION build served by the API (npm run build first).
export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  use: { baseURL: BASE, trace: 'retain-on-failure', serviceWorkers: 'block' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'node apps/api/dist/main.js',
    url: `${BASE}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NODE_ENV: 'development',
      SERVE_WEB: 'true',
      PORT: String(PORT),
      HOST: '127.0.0.1',
      LOG_LEVEL: 'warn',
      PUBLIC_SITE_URL: BASE,
      BUSINESS_NAME: 'RS Packers & Movers',
      BUSINESS_PHONE: '+91 99999 00000',
      WHATSAPP_NUMBER: '+91 99999 00000',
      LOCATION_LOOKUP: 'offline',
      QUOTES_XLSX_PATH: './storage/e2e/quote-requests.xlsx',
      CONTACTS_XLSX_PATH: './storage/e2e/contact-requests.xlsx',
      CONSENTS_XLSX_PATH: './storage/e2e/consent-records.xlsx',
      VISITORS_XLSX_PATH: './storage/e2e/visitor-analytics.xlsx',
      RATE_LIMIT_MAX: '5000',
      SUBMISSION_RATE_LIMIT_MAX: '500',
      SESSION_SECRET: 'e2e-session-secret-0123456789abcdef0123456789',
      COOKIE_SIGNING_SECRET: 'e2e-cookie-secret-0123456789abcdef0123456789',
    },
  },
});
