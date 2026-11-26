import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CSRF_HEADER } from '@rs/shared';
import type { AppEnv } from '../../../config/env';

export const COOKIE = {
  csrf: 'rs_csrf',
  visitor: 'rs_vid',
  consent: 'rs_consent',
} as const;

const DAY = 24 * 60 * 60;

export interface ConsentCookie {
  analytics: boolean;
  marketing: boolean;
  location: boolean;
  version: string;
}

export function cookieOptions(env: AppEnv, maxAgeDays?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.secureCookies,
    path: '/',
    signed: true,
    ...(maxAgeDays ? { maxAge: maxAgeDays * DAY } : {}),
  };
}

export function readSignedCookie(req: FastifyRequest, name: string): string | undefined {
  const raw = req.cookies[name];
  if (!raw) return undefined;
  const result = req.unsignCookie(raw);
  return result.valid && result.value ? result.value : undefined;
}

export function readConsentCookie(req: FastifyRequest): ConsentCookie | undefined {
  const value = readSignedCookie(req, COOKIE.consent);
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<ConsentCookie>;
    return {
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      location: parsed.location === true,
      version: String(parsed.version ?? ''),
    };
  } catch {
    return undefined;
  }
}

export function readVisitorId(req: FastifyRequest): string | undefined {
  const id = readSignedCookie(req, COOKIE.visitor);
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined;
}

/**
 * CSRF protection: a signed, HttpOnly, SameSite cookie holds a random nonce and the client
 * must echo `nonce.HMAC(nonce)` in the `X-CSRF-Token` header. Combined with the Origin check
 * and the CORS allowlist this blocks cross-site form posts.
 */
export class CsrfProtection {
  constructor(private readonly env: AppEnv) {}

  private sign(nonce: string): string {
    return createHmac('sha256', this.env.SESSION_SECRET).update(nonce).digest('base64url');
  }

  /** Returns the current token, creating the cookie when needed. */
  issue(req: FastifyRequest, reply: FastifyReply): string {
    let nonce = readSignedCookie(req, COOKIE.csrf);
    if (!nonce || !/^[A-Za-z0-9_-]{16,}$/.test(nonce)) {
      nonce = randomBytes(18).toString('base64url');
      void reply.setCookie(COOKIE.csrf, nonce, { ...cookieOptions(this.env), sameSite: 'strict' });
    }
    return `${nonce}.${this.sign(nonce)}`;
  }

  verify(req: FastifyRequest): boolean {
    const header = req.headers[CSRF_HEADER];
    const token = Array.isArray(header) ? header[0] : header;
    const nonce = readSignedCookie(req, COOKIE.csrf);
    if (!token || !nonce) return false;
    const expected = `${nonce}.${this.sign(nonce)}`;
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  originAllowed(req: FastifyRequest): boolean {
    const origin = req.headers.origin;
    if (!origin) return true;
    const own = `${req.protocol}://${req.headers.host ?? ''}`;
    return (
      origin === own ||
      origin === this.env.siteOrigin ||
      this.env.CORS_ALLOWED_ORIGINS.includes(origin)
    );
  }
}
