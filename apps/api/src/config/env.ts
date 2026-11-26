import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import { normalizeInternationalNumber } from '@rs/shared';

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional());
const bool = (fallback: boolean) =>
  z
    .preprocess(
      (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
      z.enum(['true', 'false']).default(fallback ? 'true' : 'false'),
    )
    .transform((v) => v === 'true');
const int = (min: number, max: number, fallback: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(min).max(max).default(fallback));
const httpUrl = z.url({ protocol: /^https?$/ });
const linkOrPath = z
  .string()
  .regex(/^(\/[A-Za-z0-9\-_/]*|https?:\/\/\S+)$/, 'must be a path like /privacy or an http(s) URL');

const PLACEHOLDER_SECRET = /change-me/i;

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: int(1, 65535, 3000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TRUST_PROXY: int(0, 10, 0),

    PUBLIC_SITE_URL: z
      .preprocess(blankToUndefined, httpUrl.default('http://localhost:5173'))
      .transform((v) => v.replace(/\/+$/, '')),

    BUSINESS_NAME: z.preprocess(
      blankToUndefined,
      z.string().min(2).max(80).default('RS Packers & Movers'),
    ),
    BUSINESS_PHONE: optional(z.string().max(40)),
    BUSINESS_EMAIL: optional(z.email()),
    BUSINESS_ADDRESS: optional(z.string().max(300)),
    WHATSAPP_NUMBER: z.preprocess(
      blankToUndefined,
      z
        .string()
        .transform((v, ctx) => {
          const digits = normalizeInternationalNumber(v);
          if (!digits) {
            ctx.issues.push({
              code: 'custom',
              message: 'must be a complete international number such as +91 98XXX XXXXX',
              input: v,
            });
            return z.NEVER;
          }
          return digits;
        })
        .optional(),
    ),
    SOCIAL_FACEBOOK_URL: optional(httpUrl),
    SOCIAL_INSTAGRAM_URL: optional(httpUrl),
    SOCIAL_LINKEDIN_URL: optional(httpUrl),
    SOCIAL_YOUTUBE_URL: optional(httpUrl),
    SOCIAL_X_URL: optional(httpUrl),
    PRIVACY_POLICY_URL: z.preprocess(blankToUndefined, linkOrPath.default('/privacy')),
    COOKIE_POLICY_URL: z.preprocess(blankToUndefined, linkOrPath.default('/cookie-policy')),
    TERMS_URL: z.preprocess(blankToUndefined, linkOrPath.default('/terms')),
    CANCELLATION_POLICY_URL: z.preprocess(
      blankToUndefined,
      linkOrPath.default('/cancellation-policy'),
    ),
    DATA_REQUEST_EMAIL: optional(z.email()),

    // live = India Post PIN directory + open geocoders; offline = built-in fixtures (dev/tests only)
    LOCATION_LOOKUP: z.preprocess(blankToUndefined, z.enum(['live', 'offline']).default('live')),

    QUOTES_XLSX_PATH: z.preprocess(
      blankToUndefined,
      z.string().default('./storage/quote-requests.xlsx'),
    ),
    CONTACTS_XLSX_PATH: z.preprocess(
      blankToUndefined,
      z.string().default('./storage/contact-requests.xlsx'),
    ),
    CONSENTS_XLSX_PATH: z.preprocess(
      blankToUndefined,
      z.string().default('./storage/consent-records.xlsx'),
    ),
    VISITORS_XLSX_PATH: z.preprocess(
      blankToUndefined,
      z.string().default('./storage/visitor-analytics.xlsx'),
    ),
    XLSX_BACKUPS_TO_KEEP: int(1, 365, 10),
    XLSX_BACKUP_MIN_INTERVAL_MINUTES: int(0, 10080, 60),

    ENABLE_VISITOR_ANALYTICS: bool(true),
    ENABLE_API_DOCS: bool(true),
    DATA_RETENTION_DAYS: int(1, 3650, 365),
    GEO_COUNTRY_HEADER: z.preprocess(
      blankToUndefined,
      z
        .string()
        .regex(/^[a-z0-9-]+$/i)
        .default('cf-ipcountry'),
    ),

    RATE_LIMIT_MAX: int(1, 100000, 100),
    SUBMISSION_RATE_LIMIT_MAX: int(1, 1000, 10),
    RATE_LIMIT_WINDOW_MS: int(1000, 3_600_000, 60_000),
    CORS_ALLOWED_ORIGINS: z.preprocess(blankToUndefined, z.string().default('')).transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    CAPTCHA_PROVIDER: z.preprocess(blankToUndefined, z.enum(['none', 'turnstile']).default('none')),
    CAPTCHA_SITE_KEY: optional(z.string()),
    CAPTCHA_SECRET_KEY: optional(z.string()),

    SESSION_SECRET: z.string().min(32, 'must be at least 32 characters'),
    COOKIE_SIGNING_SECRET: z.string().min(32, 'must be at least 32 characters'),

    SERVE_WEB: z
      .preprocess(blankToUndefined, z.enum(['true', 'false']).optional())
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    WEB_DIST_PATH: z.preprocess(blankToUndefined, z.string().default('./apps/web/dist')),

    DATABASE_URL: optional(z.string()),
  })
  .superRefine((env, ctx) => {
    const add = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (env.CAPTCHA_PROVIDER === 'turnstile') {
      if (!env.CAPTCHA_SITE_KEY)
        add('CAPTCHA_SITE_KEY', 'is required when CAPTCHA_PROVIDER=turnstile');
      if (!env.CAPTCHA_SECRET_KEY)
        add('CAPTCHA_SECRET_KEY', 'is required when CAPTCHA_PROVIDER=turnstile');
    }
    for (const origin of env.CORS_ALLOWED_ORIGINS) {
      if (!/^https?:\/\/[^/\s]+$/.test(origin))
        add('CORS_ALLOWED_ORIGINS', `"${origin}" must be an origin like https://example.com`);
    }
    if (env.NODE_ENV === 'production') {
      if (!env.PUBLIC_SITE_URL.startsWith('https://'))
        add('PUBLIC_SITE_URL', 'must use https in production');
      if (PLACEHOLDER_SECRET.test(env.SESSION_SECRET))
        add('SESSION_SECRET', 'must not be the example placeholder in production');
      if (PLACEHOLDER_SECRET.test(env.COOKIE_SIGNING_SECRET))
        add('COOKIE_SIGNING_SECRET', 'must not be the example placeholder in production');
      if (env.SESSION_SECRET === env.COOKIE_SIGNING_SECRET)
        add('COOKIE_SIGNING_SECRET', 'must differ from SESSION_SECRET');
    }
  });

export type AppEnv = z.output<typeof schema> & {
  /** Resolved flag: defaults to true in production. */
  serveWeb: boolean;
  secureCookies: boolean;
  siteOrigin: string;
};

export class EnvValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n - ${problems.join('\n - ')}`);
    this.name = 'EnvValidationError';
  }
}

const PATH_KEYS = [
  'QUOTES_XLSX_PATH',
  'CONTACTS_XLSX_PATH',
  'CONSENTS_XLSX_PATH',
  'VISITORS_XLSX_PATH',
  'WEB_DIST_PATH',
] as const;

/** Relative paths in .env are resolved from the repository root, whichever workspace is the cwd. */
function findProjectRoot(start: string): string {
  let dir = start;
  for (;;) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        workspaces?: unknown;
      };
      if (pkg.workspaces) return dir;
    } catch {
      // no package.json here; keep walking up
    }
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

/** Validates variables once at startup. Secrets are never echoed in error messages. */
export function loadEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`),
    );
  }
  const env = { ...result.data };
  const root = findProjectRoot(process.cwd());
  for (const key of PATH_KEYS) {
    env[key] = isAbsolute(env[key]) ? env[key] : resolve(root, env[key]);
  }
  return {
    ...env,
    serveWeb: env.SERVE_WEB ?? env.NODE_ENV === 'production',
    secureCookies: env.PUBLIC_SITE_URL.startsWith('https://'),
    siteOrigin: new URL(env.PUBLIC_SITE_URL).origin,
  };
}
