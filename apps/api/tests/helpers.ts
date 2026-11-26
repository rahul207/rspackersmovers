import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LightMyRequestResponse } from 'fastify';
import { toIstDate } from '@rs/domain';
import { loadEnv, type AppEnv } from '../src/config/env';
import { buildApp, type BuiltApp } from '../src/server';
import type { ContainerAdapters } from '../src/composition-root';

export const TEST_WHATSAPP = '+91 99999 00000';

export interface TestApp extends BuiltApp {
  dir: string;
  env: AppEnv;
  logs: string[];
  csrf: { token: string; cookie: string };
  post(
    url: string,
    body: unknown,
    extra?: { cookie?: string; headers?: Record<string, string> },
  ): Promise<LightMyRequestResponse>;
  close(): Promise<void>;
}

export async function createTestApp(
  overrides: Record<string, string> = {},
  adapters?: ContainerAdapters,
): Promise<TestApp> {
  const dir = mkdtempSync(join(tmpdir(), 'rspm-api-'));
  const env = loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    PUBLIC_SITE_URL: 'http://localhost:5173',
    WHATSAPP_NUMBER: TEST_WHATSAPP,
    BUSINESS_PHONE: '+91 99999 00000',
    LOCATION_LOOKUP: 'offline',
    QUOTES_XLSX_PATH: join(dir, 'quotes.xlsx'),
    CONTACTS_XLSX_PATH: join(dir, 'contacts.xlsx'),
    CONSENTS_XLSX_PATH: join(dir, 'consents.xlsx'),
    VISITORS_XLSX_PATH: join(dir, 'visitors.xlsx'),
    SESSION_SECRET: 'test-session-secret-0123456789abcdef0123',
    COOKIE_SIGNING_SECRET: 'test-cookie-secret-0123456789abcdef0123',
    RATE_LIMIT_MAX: '1000',
    SUBMISSION_RATE_LIMIT_MAX: '1000',
    SERVE_WEB: 'false',
    ...overrides,
  });
  const logs: string[] = [];
  const built = await buildApp(env, {
    logStream: { write: (line) => void logs.push(line) },
    ...(adapters ? { adapters } : {}),
  });
  await built.app.ready();

  const cfg = await built.app.inject({ method: 'GET', url: '/api/v1/config/public' });
  const token = (cfg.json() as { data: { csrfToken: string } }).data.csrfToken;
  const csrfCookie = cfg.cookies.find((c) => c.name === 'rs_csrf')!;
  const csrf = { token, cookie: `rs_csrf=${csrfCookie.value}` };

  return {
    ...built,
    dir,
    env,
    logs,
    csrf,
    post: (url, body, extra = {}) =>
      built.app.inject({
        method: 'POST',
        url,
        payload: body as object,
        headers: {
          'x-csrf-token': csrf.token,
          cookie: [csrf.cookie, extra.cookie].filter(Boolean).join('; '),
          ...extra.headers,
        },
      }),
    async close() {
      await built.app.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Locations as the quote form submits them: an area from the offline PIN fixtures + a typed address. */
export const MUMBAI = {
  pincode: '400053',
  area: 'Andheri West',
  district: 'Mumbai',
  state: 'Maharashtra',
  streetAddress: 'Flat 4B, Sea View Apartments, Link Road',
  latitude: 19.1364,
  longitude: 72.8296,
  confidence: 'high',
};
export const PUNE = {
  pincode: '411001',
  area: 'Pune City',
  district: 'Pune',
  state: 'Maharashtra',
  streetAddress: 'House 12, Lane 3, near City Post Office',
  latitude: 18.5196,
  longitude: 73.8553,
  confidence: 'high',
};
export const BHUBANESWAR = {
  pincode: '751002',
  area: 'Sundarpada',
  district: 'Khorda',
  state: 'Odisha',
  streetAddress: 'Plot 241, Paleikuda, Uttara',
  latitude: 20.2146,
  longitude: 85.8043,
  confidence: 'high',
};

export const futureDate = (days = 3) => toIstDate(new Date(Date.now() + days * 86_400_000));

export function validQuote(overrides: Record<string, unknown> = {}) {
  return {
    pickup: MUMBAI,
    drop: PUNE,
    pickupDate: futureDate(),
    moveType: 'LOCAL_HOUSEHOLD',
    vehicleType: 'TATA_ACE',
    customerName: 'Asha Verma',
    mobile: '98765 43210',
    email: 'asha@example.com',
    notes: 'Third floor, lift available',
    consent: true,
    sourcePage: '/',
    ...overrides,
  };
}
