import { CSRF_HEADER, type ApiResponse } from '@rs/shared';

export type ApiErrorCode = string;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;
  readonly correlationId?: string;

  constructor(init: {
    code: ApiErrorCode;
    message: string;
    status?: number;
    fieldErrors?: Record<string, string[]>;
    correlationId?: string;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status ?? 0;
    this.fieldErrors = init.fieldErrors ?? {};
    if (init.correlationId !== undefined) this.correlationId = init.correlationId;
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  get isAborted(): boolean {
    return this.code === 'ABORTED';
  }
}

export const RATE_LIMIT_MESSAGE = 'Too many requests, please wait a minute and try again.';
export const NETWORK_ERROR_MESSAGE =
  'We could not reach the server. Please check your connection and try again.';
const GENERIC_ERROR_MESSAGE = 'Something went wrong on our side. Please try again in a moment.';

let csrfToken = '';

export function setCsrfToken(token: string): void {
  csrfToken = token;
}

interface RequestOptions {
  signal?: AbortSignal;
}

function isEnvelope(value: unknown): value is ApiResponse<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as { success: unknown }).success === 'boolean'
  );
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  options: RequestOptions,
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (method === 'POST') {
    headers['content-type'] = 'application/json';
    headers[CSRF_HEADER] = csrfToken;
  }

  let response: Response;
  try {
    const init: RequestInit = { method, headers, credentials: 'same-origin' };
    if (body !== undefined) init.body = JSON.stringify(body);
    if (options.signal) init.signal = options.signal;
    response = await fetch(`/api/v1${path}`, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError({ code: 'ABORTED', message: 'Request cancelled' });
    }
    throw new ApiError({ code: 'NETWORK_ERROR', message: NETWORK_ERROR_MESSAGE });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (isEnvelope(payload)) {
    if (payload.success) {
      if (response.ok) return payload.data as T;
    } else {
      const { error, meta } = payload;
      const limited = response.status === 429 || error.code === 'RATE_LIMITED';
      throw new ApiError({
        code: error.code,
        message: limited ? RATE_LIMIT_MESSAGE : error.message,
        status: response.status,
        fieldErrors: error.fieldErrors ?? {},
        correlationId: meta?.correlationId,
      });
    }
  }

  if (response.status === 429) {
    throw new ApiError({ code: 'RATE_LIMITED', message: RATE_LIMIT_MESSAGE, status: 429 });
  }
  throw new ApiError({
    code: 'INTERNAL_ERROR',
    message: GENERIC_ERROR_MESSAGE,
    status: response.status,
  });
}

export function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

export function apiPost<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  return request<T>('POST', path, body, options);
}

/** Friendly message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return GENERIC_ERROR_MESSAGE;
}

export interface MappedFieldErrors<F extends string> {
  fields: Partial<Record<F, string>>;
  /** Messages for server field paths that have no matching form control. */
  unmapped: string[];
}

/**
 * Maps dotted server paths (`pickup.latitude`, `drop.streetAddress`) onto the top-level
 * form fields they belong to. The first message per field wins.
 */
export function mapFieldErrors<F extends string>(
  fieldErrors: Record<string, string[]>,
  knownFields: readonly F[],
): MappedFieldErrors<F> {
  const fields: Partial<Record<F, string>> = {};
  const unmapped: string[] = [];
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const message = messages[0];
    if (!message) continue;
    const head = path.split('.')[0] ?? path;
    const field = knownFields.find((f) => f === head);
    if (field) {
      if (fields[field] === undefined) fields[field] = message;
    } else {
      unmapped.push(message);
    }
  }
  return { fields, unmapped };
}
