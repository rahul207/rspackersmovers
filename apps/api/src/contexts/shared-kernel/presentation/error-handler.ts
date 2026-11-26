import type { FastifyError, FastifyInstance } from 'fastify';
import { ApplicationError } from '@rs/application';
import { PickupDateError } from '@rs/domain';
import { StorageError } from '@rs/infrastructure';
import type { ErrorCode } from '@rs/shared';
import { RequestValidationError, fail } from './http';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  CSRF_INVALID: 403,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  CAPTCHA_FAILED: 400,
  SUBMISSION_REJECTED: 400,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  STORAGE_UNAVAILABLE: 503,
  UPSTREAM_UNAVAILABLE: 502,
  FEATURE_DISABLED: 404,
  INTERNAL_ERROR: 500,
};

/** Public messages are generic; details go to structured logs only (and never contain request data). */
const PUBLIC_MESSAGE: Partial<Record<ErrorCode, string>> = {
  CSRF_INVALID: 'Your session could not be verified. Please refresh the page and try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  NOT_FOUND: 'The requested resource was not found.',
  PAYLOAD_TOO_LARGE: 'The request is too large.',
  UNSUPPORTED_MEDIA_TYPE: 'Unsupported content type.',
  STORAGE_UNAVAILABLE: 'We could not save your request right now. Please try again shortly.',
  UPSTREAM_UNAVAILABLE: 'Location search is temporarily unavailable.',
  INTERNAL_ERROR: 'Something went wrong. Please try again later.',
};

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, req, reply) => {
    const send = (code: ErrorCode, message?: string, fieldErrors?: Record<string, string[]>) =>
      reply
        .code(STATUS_BY_CODE[code])
        .send(
          fail(
            req,
            code,
            message ?? PUBLIC_MESSAGE[code] ?? 'The request could not be processed.',
            fieldErrors,
          ),
        );

    if (error instanceof RequestValidationError) {
      return send('VALIDATION_FAILED', 'Please check the highlighted fields.', error.fieldErrors);
    }
    if (error instanceof PickupDateError) {
      return send('VALIDATION_FAILED', 'Please check the highlighted fields.', {
        pickupDate: [error.message],
      });
    }
    if (error instanceof ApplicationError) {
      if (error.code === 'UPSTREAM_UNAVAILABLE') req.log.warn({ event: 'upstream.unavailable' });
      return send(
        error.code,
        error.code === 'CAPTCHA_FAILED' || error.code === 'SUBMISSION_REJECTED'
          ? error.message
          : undefined,
        error.fieldErrors,
      );
    }
    if (error instanceof StorageError) {
      req.log.error({ event: 'storage.error', err: { message: error.message } });
      return send('STORAGE_UNAVAILABLE');
    }

    const statusCode = (error as FastifyError).statusCode;
    if (statusCode === 429) return send('RATE_LIMITED');
    if (statusCode === 413) return send('PAYLOAD_TOO_LARGE');
    if (statusCode === 415) return send('UNSUPPORTED_MEDIA_TYPE');
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return send('VALIDATION_FAILED', 'The request could not be understood.');
    }

    req.log.error({
      event: 'request.failed',
      err: { name: error.name, message: error.message, stack: error.stack },
    });
    return send('INTERNAL_ERROR');
  });
}
