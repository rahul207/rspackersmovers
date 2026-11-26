import type { FastifyInstance } from 'fastify';
import { contactRequestSchema } from '@rs/shared';
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

export function registerContactRoutes(app: FastifyInstance, { container }: RouteContext): void {
  app.post(
    '/api/v1/contact-requests',
    {
      config: submissionRateLimit(container.env),
      schema: {
        tags: ['Contact'],
        summary: 'Submit a contact request',
        body: docSchema(contactRequestSchema),
        response: {
          201: envelopeDoc(),
          400: errorEnvelopeDoc,
          429: errorEnvelopeDoc,
          503: errorEnvelopeDoc,
        },
      },
    },
    async (req, reply) => {
      const body = parseWith(contactRequestSchema, req.body);
      const created = await container.useCases.submitContact.execute(body, {
        visitorId: readVisitorId(req),
      });
      return reply.code(201).send(ok(req, created));
    },
  );
}
