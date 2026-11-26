import { randomUUID } from 'node:crypto';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Logger } from '@rs/application';
import { CORRELATION_HEADER } from '@rs/shared';
import { createContainer, type Container, type ContainerAdapters } from './composition-root';
import type { AppEnv } from './config/env';
import { registerAnalyticsRoutes } from './contexts/analytics/presentation/routes';
import { registerBookingRoutes } from './contexts/booking/presentation/routes';
import { registerConsentRoutes } from './contexts/consent/presentation/routes';
import { registerContactRoutes } from './contexts/contact/presentation/routes';
import { registerContentRoutes } from './contexts/content/presentation/routes';
import { registerLocationRoutes } from './contexts/location/presentation/routes';
import { registerErrorHandling } from './contexts/shared-kernel/presentation/error-handler';
import { fail } from './contexts/shared-kernel/presentation/http';
import { CsrfProtection } from './contexts/shared-kernel/presentation/security';
import { registerSystemRoutes } from './contexts/shared-kernel/presentation/system-routes';
import { registerWebHost } from './web-host';

const CORRELATION_ID = /^[A-Za-z0-9._-]{8,64}$/;

export interface BuiltApp {
  app: FastifyInstance;
  container: Container;
}

function adaptLogger(app: FastifyInstance): Logger {
  const log = app.log;
  return {
    debug: (event, ctx) => log.debug({ event, ...ctx }),
    info: (event, ctx) => log.info({ event, ...ctx }),
    warn: (event, ctx) => log.warn({ event, ...ctx }),
    error: (event, ctx) => log.error({ event, ...ctx }),
  };
}

export async function buildApp(
  env: AppEnv,
  options: {
    /** Replace the PIN directory / geocoder (tests use this to stay offline). */
    adapters?: ContainerAdapters;
    logStream?: { write(msg: string): void };
  } = {},
): Promise<BuiltApp> {
  const app = Fastify({
    bodyLimit: 32 * 1024,
    trustProxy:
      env.TRUST_PROXY > 0 ? (_address: string, hop: number) => hop <= env.TRUST_PROXY : false,
    genReqId: (req) => {
      const header = req.headers[CORRELATION_HEADER];
      const value = Array.isArray(header) ? header[0] : header;
      return value && CORRELATION_ID.test(value) ? value : randomUUID();
    },
    logger: {
      level: env.LOG_LEVEL,
      ...(options.logStream ? { stream: options.logStream } : {}),
      redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
        remove: true,
      },
      serializers: {
        // No query strings (may contain area names), no PIN code in the path, no IPs, no headers.
        req: (req) => ({
          method: req.method,
          url: req.url?.split('?')[0]?.replace(/\/pincode\/[^/]*/, '/pincode/:pincode'),
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    },
  });

  // Validation is performed by zod inside handlers; fastify's schemas are documentation only.
  app.setValidatorCompiler(() => (data) => ({ value: data }));
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));

  const container = createContainer(env, adaptLogger(app), options.adapters);
  const csrf = new CsrfProtection(env);
  const turnstile = env.CAPTCHA_PROVIDER === 'turnstile';
  const cloudflare = 'https://challenges.cloudflare.com';

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ...(turnstile ? [cloudflare] : [])],
        styleSrc: ["'self'"],
        styleSrcAttr: ["'unsafe-inline'"],
        imgSrc: [
          "'self'",
          'data:',
          'https://tile.openstreetmap.org',
          'https://*.tile.openstreetmap.org',
          'https://maps.googleapis.com',
          'https://maps.gstatic.com',
        ],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", ...(turnstile ? [cloudflare] : [])],
        frameSrc: turnstile ? [cloudflare] : ["'none'"],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(env.secureCookies ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: env.secureCookies ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  await app.register(cors, {
    origin: (origin, cb) =>
      cb(null, !origin || origin === env.siteOrigin || env.CORS_ALLOWED_ORIGINS.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-csrf-token', CORRELATION_HEADER],
    exposedHeaders: [CORRELATION_HEADER],
    maxAge: 600,
  });

  await app.register(cookie, { secret: env.COOKIE_SIGNING_SECRET });
  await app.register(compress, { global: true, encodings: ['br', 'gzip'] });
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    allowList: (req) => !req.url.startsWith('/api/'),
  });

  if (env.ENABLE_API_DOCS) {
    await app.register(swagger, {
      openapi: {
        openapi: '3.1.0',
        info: {
          title: `${env.BUSINESS_NAME} API`,
          version: '1.0.0',
          description:
            'Public API for quote requests, PIN code based location lookup, contact requests, consent and privacy-conscious analytics. All mutating requests require the X-CSRF-Token header issued by GET /api/v1/config/public. The API never returns prices: quotations are shared by the team on WhatsApp.',
        },
        tags: ['Booking', 'Contact', 'Consent', 'Analytics', 'Content', 'Location', 'System'].map(
          (name) => ({ name }),
        ),
      },
    });
    await app.register(swaggerUi, { routePrefix: '/api/docs' });
    app.addHook('onSend', (req, reply, payload, done) => {
      if (req.url.startsWith('/api/docs')) {
        void reply.header(
          'content-security-policy',
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
        );
      }
      done(null, payload);
    });
  }

  app.addHook('onRequest', (req, reply, done) => {
    void reply.header(CORRELATION_HEADER, req.id);
    done();
  });

  // CSRF: mutating API calls need an allowed Origin and the signed double-submit token.
  app.addHook('preHandler', (req, reply, done) => {
    const mutating = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
    if (
      mutating &&
      req.url.startsWith('/api/v1/') &&
      (!csrf.originAllowed(req) || !csrf.verify(req))
    ) {
      void reply
        .code(403)
        .send(
          fail(
            req,
            'CSRF_INVALID',
            'Your session could not be verified. Please refresh the page and try again.',
          ),
        );
      return;
    }
    done();
  });

  registerErrorHandling(app);

  const ctx = { container, csrf };
  registerSystemRoutes(app, ctx);
  registerContentRoutes(app, ctx);
  registerBookingRoutes(app, ctx);
  registerContactRoutes(app, ctx);
  registerConsentRoutes(app, ctx);
  registerAnalyticsRoutes(app, ctx);
  registerLocationRoutes(app, ctx);

  const webHost = await registerWebHost(app, container);
  app.setNotFoundHandler((req, reply) => {
    const wantsPage = req.method === 'GET' && !req.url.startsWith('/api/') && webHost;
    if (wantsPage) {
      // Unknown front-end paths get a real 404 status; the client renders its not-found page.
      return reply
        .code(404)
        .type('text/html; charset=utf-8')
        .header('cache-control', 'no-cache')
        .send(webHost.html);
    }
    return reply.code(404).send(fail(req, 'NOT_FOUND', 'The requested resource was not found.'));
  });

  return { app, container };
}
