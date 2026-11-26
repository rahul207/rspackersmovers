import type { FastifyInstance } from 'fastify';
import { quoteRequestSchema } from '@rs/shared';
import {
  submissionRateLimit,
  type RouteContext,
} from '../../shared-kernel/presentation/route-context';
import {
  docSchema,
  envelopeDoc,
  errorEnvelopeDoc,
  ok,
  parseWith,
} from '../../shared-kernel/presentation/http';
import { readVisitorId } from '../../shared-kernel/presentation/security';

export function registerBookingRoutes(app: FastifyInstance, { container }: RouteContext): void {
  app.post(
    '/api/v1/quotes',
    {
      config: submissionRateLimit(container.env),
      schema: {
        tags: ['Booking'],
        summary: 'Create a quote request',
        description:
          'Validates the request, stores it and returns a reference number plus a WhatsApp click-to-chat URL and pre-filled message. No price is calculated or returned: the team replies with a quotation on WhatsApp. Duplicate submissions of the same request return the original quote.',
        body: docSchema(quoteRequestSchema),
        response: {
          201: envelopeDoc(),
          400: errorEnvelopeDoc,
          429: errorEnvelopeDoc,
          503: errorEnvelopeDoc,
        },
      },
    },
    async (req, reply) => {
      const body = parseWith(quoteRequestSchema, req.body);
      const created = await container.useCases.createQuote.execute(body, {
        visitorId: readVisitorId(req),
      });
      return reply.code(201).send(ok(req, created));
    },
  );
}
