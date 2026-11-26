import type { FastifyInstance } from 'fastify';
import { analyticsEventSchema } from '@rs/shared';
import type { RouteContext } from '../../shared-kernel/presentation/route-context';
import {
  docSchema,
  envelopeDoc,
  errorEnvelopeDoc,
  ok,
  parseWith,
} from '../../shared-kernel/presentation/http';
import { readConsentCookie, readVisitorId } from '../../shared-kernel/presentation/security';

export function registerAnalyticsRoutes(app: FastifyInstance, { container }: RouteContext): void {
  const { env } = container;

  app.post(
    '/api/v1/analytics/events',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Analytics'],
        summary: 'Record a privacy-conscious page view',
        description:
          'Stored only when the signed consent cookie proves analytics consent. Query strings are discarded. No IP address, fingerprint or coordinates are stored.',
        body: docSchema(analyticsEventSchema),
        response: { 202: envelopeDoc(), 400: errorEnvelopeDoc },
      },
    },
    async (req, reply) => {
      const event = parseWith(analyticsEventSchema, req.body);
      if (!env.ENABLE_VISITOR_ANALYTICS) return reply.code(202).send(ok(req, { recorded: false }));

      const countryHeader = req.headers[env.GEO_COUNTRY_HEADER.toLowerCase()];
      const recorded = await container.useCases.trackVisit.execute(event, {
        consent: readConsentCookie(req),
        visitorId: readVisitorId(req),
        userAgent: req.headers['user-agent'],
        acceptLanguage: req.headers['accept-language'],
        region: Array.isArray(countryHeader) ? countryHeader[0] : countryHeader,
        ownHost: new URL(env.PUBLIC_SITE_URL).hostname,
      });
      return reply.code(202).send(ok(req, { recorded }));
    },
  );
}
