import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ApiFailure, ApiSuccess, ErrorCode } from '@rs/shared';

export class RequestValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string[]>) {
    super('Request validation failed');
    this.name = 'RequestValidationError';
  }
}

export function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_form';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Validates untrusted input on the server, regardless of any client-side validation. */
export function parseWith<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) throw new RequestValidationError(fieldErrorsFrom(result.error));
  return result.data;
}

export const ok = <T>(req: FastifyRequest, data: T): ApiSuccess<T> => ({
  success: true,
  data,
  meta: { correlationId: req.id },
});

export const fail = (
  req: FastifyRequest,
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ApiFailure => ({
  success: false,
  error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
  meta: { correlationId: req.id },
});

/** JSON Schema for OpenAPI documentation only. Validation itself is done by parseWith. */
export function docSchema(
  schema: z.ZodType,
  io: 'input' | 'output' = 'input',
): Record<string, unknown> {
  try {
    const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, {
      io,
      unrepresentable: 'any',
    }) as Record<string, unknown>;
    return rest;
  } catch {
    return { type: 'object' };
  }
}

export const envelopeDoc = (data: Record<string, unknown> = { type: 'object' }) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data,
    meta: { type: 'object', properties: { correlationId: { type: 'string' } } },
  },
});

export const errorEnvelopeDoc = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        fieldErrors: {
          type: 'object',
          additionalProperties: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    meta: { type: 'object', properties: { correlationId: { type: 'string' } } },
  },
};
