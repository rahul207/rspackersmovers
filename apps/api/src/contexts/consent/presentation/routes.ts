import type { FastifyInstance } from 'fastify';
import { consentPreferencesSchema } from '@rs/shared';
import type { RouteContext } from '../../shared-kernel/presentation/route-context';
import {
  docSchema,
  envelopeDoc,
  errorEnvelopeDoc,
  ok,
  parseWith,
} from '../../shared-kernel/presentation/http';
import { COOKIE, cookieOptions, readVisitorId } from '../../shared-kernel/presentation/security';

const CONSENT_COOKIE_DAYS = 180;

export function registerConsentRoutes(app: FastifyInstance, { container }: RouteContext): void {
  const { env } = container;

  app.post(
    '/api/v1/consents',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['Consent'],
        summary: 'Record a cookie/consent decision',
        description:
          'Stores the decision (with consent and privacy-notice versions), and sets signed HttpOnly cookies that later gate analytics on the server. Necessary cookies do not depend on this decision.',
        body: docSchema(consentPreferencesSchema),
        response: { 201: envelopeDoc(), 400: errorEnvelopeDoc },
      },
    },
    async (req, reply) => {
      const prefs = parseWith(consentPreferencesSchema, req.body);
      const { result, visitorId } = await container.useCases.recordConsent.execute(prefs, {
        visitorId: readVisitorId(req),
      });
      const opts = cookieOptions(env, CONSENT_COOKIE_DAYS);
      void reply.setCookie(COOKIE.visitor, visitorId, opts);
      void reply.setCookie(
        COOKIE.consent,
        JSON.stringify({
          analytics: result.analytics,
          marketing: result.marketing,
          location: result.location,
          version: prefs.consentVersion,
        }),
        opts,
      );
      return reply.code(201).send(ok(req, result));
    },
  );
}
