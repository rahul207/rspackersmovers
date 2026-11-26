import type { FastifyInstance } from 'fastify';
import { areaQuerySchema, pincodeSchema } from '@rs/shared';
import { z } from 'zod';
import type { RouteContext } from '../../shared-kernel/presentation/route-context';
import {
  docSchema,
  envelopeDoc,
  errorEnvelopeDoc,
  ok,
  parseWith,
} from '../../shared-kernel/presentation/http';

const pincodeParamsSchema = z.object({ pincode: pincodeSchema });

/**
 * Two-step location flow. Step 1 lists the India Post post offices (area names) for a PIN code;
 * step 2 finds the coordinates of the one the customer picked. Both are GET: they carry only
 * public area names, never what the customer typed as their street address. Query strings are
 * stripped from logs by the request serializer in server.ts.
 */
export function registerLocationRoutes(app: FastifyInstance, { container }: RouteContext): void {
  app.get(
    '/api/v1/locations/pincode/:pincode',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Location'],
        summary: 'List the post offices (area names) of a PIN code',
        description:
          'Uses the India Post PIN code directory. Returns an empty `offices` list for an unknown PIN code.',
        params: docSchema(pincodeParamsSchema),
        response: { 200: envelopeDoc(), 400: errorEnvelopeDoc, 502: errorEnvelopeDoc },
      },
    },
    async (req) => {
      const { pincode } = parseWith(pincodeParamsSchema, req.params);
      const controller = new AbortController();
      req.raw.once('close', () => controller.abort());
      return ok(req, await container.useCases.lookupPincode.execute(pincode, controller.signal));
    },
  );

  app.get(
    '/api/v1/locations/area',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['Location'],
        summary: 'Find the coordinates of a chosen post-office area',
        description:
          'Looks the area up in open geocoders (Open-Meteo, Photon, Nominatim), checking that district, state or PIN code match. `confidence` says how precise the result is.',
        querystring: docSchema(areaQuerySchema),
        response: { 200: envelopeDoc(), 400: errorEnvelopeDoc, 502: errorEnvelopeDoc },
      },
    },
    async (req) => {
      const query = parseWith(areaQuerySchema, req.query);
      const controller = new AbortController();
      req.raw.once('close', () => controller.abort());
      return ok(req, await container.useCases.resolveArea.execute(query, controller.signal));
    },
  );
}
