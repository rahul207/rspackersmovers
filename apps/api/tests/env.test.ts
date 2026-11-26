import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../src/config/env';

const secrets = {
  SESSION_SECRET: 'a'.repeat(40),
  COOKIE_SIGNING_SECRET: 'b'.repeat(40),
};

describe('environment validation', () => {
  it('applies safe defaults', () => {
    const env = loadEnv({ ...secrets });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      LOCATION_LOOKUP: 'live',
      ENABLE_VISITOR_ANALYTICS: true,
      DATA_RETENTION_DAYS: 365,
      serveWeb: false,
      CAPTCHA_PROVIDER: 'none',
    });
    expect(env.WHATSAPP_NUMBER).toBeUndefined();
  });

  it('treats blank optional values as not configured and strips trailing slashes', () => {
    const env = loadEnv({
      ...secrets,
      BUSINESS_PHONE: '  ',
      WHATSAPP_NUMBER: '',
      PUBLIC_SITE_URL: 'https://rs.example.com/',
      CORS_ALLOWED_ORIGINS: '',
    });
    expect(env.BUSINESS_PHONE).toBeUndefined();
    expect(env.PUBLIC_SITE_URL).toBe('https://rs.example.com');
    expect(env.CORS_ALLOWED_ORIGINS).toEqual([]);
  });

  it('normalises the WhatsApp number to digits only', () => {
    expect(loadEnv({ ...secrets, WHATSAPP_NUMBER: '+91 (98765) 43-210' }).WHATSAPP_NUMBER).toBe(
      '919876543210',
    );
  });

  it('collects every problem and never echoes secret values', () => {
    try {
      loadEnv({
        SESSION_SECRET: 'short-secret-value',
        COOKIE_SIGNING_SECRET: 'b'.repeat(40),
        PORT: '99999',
        WHATSAPP_NUMBER: '98765 43210',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = (error as Error).message;
      for (const key of ['SESSION_SECRET', 'PORT', 'WHATSAPP_NUMBER'])
        expect(message).toContain(key);
      expect(message).not.toContain('short-secret-value');
    }
  });

  it('validates cross-field requirements', () => {
    expect(() => loadEnv({ ...secrets, LOCATION_LOOKUP: 'satellite' })).toThrow(/LOCATION_LOOKUP/);
    expect(loadEnv({ ...secrets, LOCATION_LOOKUP: 'offline' }).LOCATION_LOOKUP).toBe('offline');
    expect(() => loadEnv({ ...secrets, CAPTCHA_PROVIDER: 'turnstile' })).toThrow(
      /CAPTCHA_SITE_KEY/,
    );
    expect(() => loadEnv({ ...secrets, CORS_ALLOWED_ORIGINS: 'not-an-origin' })).toThrow(
      /CORS_ALLOWED_ORIGINS/,
    );
  });

  it('is strict in production', () => {
    const prod = { NODE_ENV: 'production', PUBLIC_SITE_URL: 'https://rs.example.com' };
    expect(() =>
      loadEnv({
        ...prod,
        SESSION_SECRET: 'change-me-'.padEnd(40, 'x'),
        COOKIE_SIGNING_SECRET: 'b'.repeat(40),
      }),
    ).toThrow(/SESSION_SECRET/);
    expect(() =>
      loadEnv({ ...prod, SESSION_SECRET: 'a'.repeat(40), COOKIE_SIGNING_SECRET: 'a'.repeat(40) }),
    ).toThrow(/must differ/);
    expect(() =>
      loadEnv({ ...secrets, NODE_ENV: 'production', PUBLIC_SITE_URL: 'http://rs.example.com' }),
    ).toThrow(/https/);
    const env = loadEnv({ ...prod, ...secrets });
    expect(env.serveWeb).toBe(true);
    expect(env.secureCookies).toBe(true);
  });

  it('the shipped .env.example is valid outside production', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const parsed: Record<string, string> = {};
    for (const line of readFileSync(resolve(__dirname, '../../../.env.example'), 'utf8').split(
      /\r?\n/,
    )) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line);
      if (m) parsed[m[1]!] = m[2]!;
    }
    expect(() => loadEnv(parsed)).not.toThrow();
    for (const key of [
      'NODE_ENV',
      'PORT',
      'PUBLIC_SITE_URL',
      'BUSINESS_NAME',
      'BUSINESS_PHONE',
      'WHATSAPP_NUMBER',
      'BUSINESS_EMAIL',
      'BUSINESS_ADDRESS',
      'LOCATION_LOOKUP',
      'QUOTES_XLSX_PATH',
      'CONTACTS_XLSX_PATH',
      'CONSENTS_XLSX_PATH',
      'VISITORS_XLSX_PATH',
      'ENABLE_VISITOR_ANALYTICS',
      'DATA_RETENTION_DAYS',
      'LOG_LEVEL',
      'RATE_LIMIT_MAX',
      'RATE_LIMIT_WINDOW_MS',
      'CORS_ALLOWED_ORIGINS',
      'SESSION_SECRET',
      'COOKIE_SIGNING_SECRET',
      'DATABASE_URL',
    ]) {
      expect(parsed, key).toHaveProperty(key);
    }
  });
});
