import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  RATE_LIMIT_MESSAGE,
  apiGet,
  apiPost,
  mapFieldErrors,
  setCsrfToken,
} from './apiClient';

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiClient', () => {
  it('unwraps the success envelope and sends the CSRF header on POST', async () => {
    setCsrfToken('token-123');
    const fetchMock = stubFetch(
      json({ success: true, data: { ok: 1 }, meta: { correlationId: 'c1' } }, 201),
    );
    await expect(apiPost('/quotes', { a: 1 })).resolves.toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/quotes');
    const headers = init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers['x-csrf-token']).toBe('token-123');
  });

  it('throws a typed ApiError carrying field errors and the correlation id', async () => {
    stubFetch(
      json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid',
            fieldErrors: { mobile: ['Bad number'] },
          },
          meta: { correlationId: 'abc' },
        },
        400,
      ),
    );
    const error = await apiPost('/quotes', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.code).toBe('VALIDATION_FAILED');
    expect(apiError.fieldErrors).toEqual({ mobile: ['Bad number'] });
    expect(apiError.correlationId).toBe('abc');
  });

  it('uses the friendly rate-limit message for HTTP 429', async () => {
    stubFetch(
      json(
        {
          success: false,
          error: { code: 'RATE_LIMITED', message: 'x' },
          meta: { correlationId: 'r' },
        },
        429,
      ),
    );
    const error = (await apiGet('/content').catch((e: unknown) => e)) as ApiError;
    expect(error.message).toBe(RATE_LIMIT_MESSAGE);
  });

  it('reports network failures and non-JSON responses without leaking details', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    const network = (await apiGet('/content').catch((e: unknown) => e)) as ApiError;
    expect(network.isNetworkError).toBe(true);

    stubFetch(new Response('<html>Bad gateway</html>', { status: 502 }));
    const bad = (await apiGet('/content').catch((e: unknown) => e)) as ApiError;
    expect(bad.status).toBe(502);
    expect(bad.message).not.toContain('html');
  });
});

describe('mapFieldErrors', () => {
  it('maps dotted server paths onto form fields and keeps the rest', () => {
    const mapped = mapFieldErrors(
      {
        mobile: ['Enter a valid mobile'],
        'pickup.latitude': ['Choose your area from the list'],
        'unknownField.value': ['Unexpected value'],
      },
      ['mobile', 'pickup', 'drop'] as const,
    );
    expect(mapped.fields).toEqual({
      mobile: 'Enter a valid mobile',
      pickup: 'Choose your area from the list',
    });
    expect(mapped.unmapped).toEqual(['Unexpected value']);
  });
});
