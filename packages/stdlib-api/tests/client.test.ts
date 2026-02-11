// ============================================================================
// ISL Standard Library - API Client Tests
// @isl-lang/stdlib-api
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createRestClient,
  createGraphQLClient,
  buildChain,
  authMiddleware,
  retryMiddleware,
  timeoutMiddleware,
  loggingMiddleware,
  cacheMiddleware,
  createMemoryCacheStore,
  computeDelay,
  parseRetryAfter,
  resolvePathParams,
  buildQueryString,
  networkError,
  timeoutError,
  httpError,
  parseError,
  graphqlError,
  abortError,
  unknownError,
  isRetryableStatus,
  parseHeaders,
} from '../src/index.js';
import type { Middleware, MiddlewareContext, ApiResponse } from '../src/index.js';
import type { ApiError } from '../src/errors.js';
import type { Result } from '@isl-lang/stdlib-core';

// ============================================================================
// Helpers
// ============================================================================

function mockFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
  statusText = 'OK',
): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

function mockFetchText(status: number, text: string): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'text/plain' }),
    json: () => Promise.reject(new Error('not json')),
    text: () => Promise.resolve(text),
  });
}

function mockFetchNetworkError(): typeof globalThis.fetch {
  return vi.fn().mockRejectedValue(new TypeError('fetch failed'));
}

function mockFetchNoContent(): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
    statusText: 'No Content',
    headers: new Headers({}),
    json: () => Promise.reject(new Error('no body')),
    text: () => Promise.resolve(''),
  });
}

// ============================================================================
// Error Factory Tests
// ============================================================================

describe('Error factories', () => {
  it('networkError creates retryable Network error', () => {
    const err = networkError('connection refused');
    expect(err.kind).toBe('Network');
    expect(err.retryable).toBe(true);
    expect(err.message).toBe('connection refused');
  });

  it('timeoutError creates retryable Timeout error', () => {
    const err = timeoutError('https://api.test/foo', 5000);
    expect(err.kind).toBe('Timeout');
    expect(err.retryable).toBe(true);
    expect(err.message).toContain('5000ms');
    expect(err.url).toBe('https://api.test/foo');
  });

  it('abortError creates non-retryable Abort error', () => {
    const err = abortError('https://api.test/bar');
    expect(err.kind).toBe('Abort');
    expect(err.retryable).toBe(false);
  });

  it('httpError marks 5xx as retryable', () => {
    expect(httpError(500, 'Internal Server Error', '/').retryable).toBe(true);
    expect(httpError(429, 'Too Many Requests', '/').retryable).toBe(true);
    expect(httpError(404, 'Not Found', '/').retryable).toBe(false);
    expect(httpError(400, 'Bad Request', '/').retryable).toBe(false);
  });

  it('parseError is not retryable', () => {
    const err = parseError('bad json');
    expect(err.kind).toBe('ParseError');
    expect(err.retryable).toBe(false);
  });

  it('graphqlError stores errors array in cause', () => {
    const errors = [{ message: 'field not found' }];
    const err = graphqlError('GraphQL error', errors);
    expect(err.kind).toBe('GraphQLError');
    expect(err.cause).toBe(errors);
  });

  it('unknownError wraps arbitrary causes', () => {
    const err = unknownError('oops', { detail: 42 });
    expect(err.kind).toBe('Unknown');
    expect(err.retryable).toBe(false);
  });

  it('isRetryableStatus identifies 429, 502, 503, 504', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
    expect(isRetryableStatus(500)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});

// ============================================================================
// URL Helpers
// ============================================================================

describe('URL helpers', () => {
  it('resolvePathParams replaces :param tokens', () => {
    expect(resolvePathParams('/users/:id/posts/:postId', { id: 42, postId: 'abc' }))
      .toBe('/users/42/posts/abc');
  });

  it('resolvePathParams returns url unchanged when no params', () => {
    expect(resolvePathParams('/users')).toBe('/users');
  });

  it('buildQueryString creates encoded query string', () => {
    expect(buildQueryString({ page: 1, q: 'hello world', active: true }))
      .toBe('?page=1&q=hello%20world&active=true');
  });

  it('buildQueryString omits undefined values', () => {
    expect(buildQueryString({ a: '1', b: undefined })).toBe('?a=1');
  });

  it('buildQueryString returns empty for no params', () => {
    expect(buildQueryString()).toBe('');
    expect(buildQueryString({})).toBe('');
  });
});

// ============================================================================
// Interceptor Chain Tests
// ============================================================================

describe('Interceptor chain', () => {
  it('executes middleware in order (first = outermost)', async () => {
    const order: string[] = [];

    const mw1: Middleware = {
      name: 'first',
      async execute(ctx, next) {
        order.push('first-before');
        const result = await next(ctx);
        order.push('first-after');
        return result;
      },
    };

    const mw2: Middleware = {
      name: 'second',
      async execute(ctx, next) {
        order.push('second-before');
        const result = await next(ctx);
        order.push('second-after');
        return result;
      },
    };

    const finalHandler = vi.fn().mockResolvedValue({
      ok: true,
      value: { data: 'ok', status: 200, statusText: 'OK', headers: {}, url: '/', ok: true },
    });

    const chain = buildChain([mw1, mw2], finalHandler);
    await chain({ request: { url: '/', method: 'GET' }, metadata: {} });

    expect(order).toEqual(['first-before', 'second-before', 'second-after', 'first-after']);
    expect(finalHandler).toHaveBeenCalledTimes(1);
  });

  it('middleware can short-circuit the chain', async () => {
    const blocker: Middleware = {
      name: 'blocker',
      async execute(_ctx, _next) {
        return { ok: false, error: httpError(403, 'Forbidden', '/') };
      },
    };

    const finalHandler = vi.fn();
    const chain = buildChain([blocker], finalHandler);
    const result = await chain({ request: { url: '/', method: 'GET' }, metadata: {} });

    expect(result.ok).toBe(false);
    expect(finalHandler).not.toHaveBeenCalled();
  });
});

// ============================================================================
// REST Client Tests
// ============================================================================

describe('REST Client', () => {
  it('GET request returns parsed JSON', async () => {
    const fetch = mockFetch(200, { id: 1, name: 'Alice' });
    const client = createRestClient()
      .baseUrl('https://api.test')
      .fetchFn(fetch)
      .build();

    const result = await client.get<{ id: number; name: string }>('/users/1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data).toEqual({ id: 1, name: 'Alice' });
      expect(result.value.status).toBe(200);
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('POST sends body as JSON', async () => {
    const fetch = mockFetch(201, { id: 2 });
    const client = createRestClient()
      .baseUrl('https://api.test')
      .fetchFn(fetch)
      .build();

    await client.post('/users', { body: { name: 'Bob' } });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/users',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Bob' }),
      }),
    );
  });

  it('merges builder headers with request headers', async () => {
    const fetch = mockFetch(200, {});
    const client = createRestClient()
      .baseUrl('https://api.test')
      .header('X-Global', 'yes')
      .fetchFn(fetch)
      .build();

    await client.get('/test', { headers: { 'X-Local': 'also-yes' } });

    const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = callArgs![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Global']).toBe('yes');
    expect(headers['X-Local']).toBe('also-yes');
  });

  it('resolves path params and query string', async () => {
    const fetch = mockFetch(200, []);
    const client = createRestClient()
      .baseUrl('https://api.test')
      .fetchFn(fetch)
      .build();

    await client.get('/users/:id/posts', {
      path: { id: 42 },
      query: { page: 1, limit: 10 },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/users/42/posts?page=1&limit=10',
      expect.anything(),
    );
  });

  it('returns Result.err for HTTP 404', async () => {
    const fetch = mockFetch(404, { error: 'not found' }, {}, 'Not Found');
    const client = createRestClient()
      .baseUrl('https://api.test')
      .fetchFn(fetch)
      .build();

    const result = await client.get('/missing');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('HttpError');
      expect(result.error.status).toBe(404);
    }
  });

  it('returns Result.err(Network) for fetch failure', async () => {
    const fetch = mockFetchNetworkError();
    const client = createRestClient()
      .baseUrl('https://api.test')
      .fetchFn(fetch)
      .build();

    const result = await client.get('/fail');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Network');
      expect(result.error.retryable).toBe(true);
    }
  });

  it('handles 204 No Content', async () => {
    const fetch = mockFetchNoContent();
    const client = createRestClient()
      .baseUrl('https://api.test')
      .fetchFn(fetch)
      .build();

    const result = await client.delete('/users/1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(204);
      expect(result.value.data).toBeUndefined();
    }
  });

  it('handles text/plain responses', async () => {
    const fetch = mockFetchText(200, 'hello world');
    const client = createRestClient()
      .baseUrl('https://api.test')
      .fetchFn(fetch)
      .build();

    const result = await client.get<string>('/text');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data).toBe('hello world');
    }
  });

  it('strips trailing slashes from baseUrl', async () => {
    const fetch = mockFetch(200, {});
    const client = createRestClient()
      .baseUrl('https://api.test///')
      .fetchFn(fetch)
      .build();

    await client.get('/path');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/path',
      expect.anything(),
    );
  });

  it('supports all HTTP methods', async () => {
    const fetch = mockFetch(200, {});
    const client = createRestClient()
      .baseUrl('https://api.test')
      .fetchFn(fetch)
      .build();

    await client.get('/a');
    await client.post('/b');
    await client.put('/c');
    await client.patch('/d');
    await client.delete('/e');
    await client.head('/f');
    await client.options('/g');

    expect(fetch).toHaveBeenCalledTimes(7);
    const methods = (fetch as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => (c[1] as RequestInit).method,
    );
    expect(methods).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
  });
});

// ============================================================================
// GraphQL Client Tests
// ============================================================================

describe('GraphQL Client', () => {
  it('sends query and returns typed data', async () => {
    const fetch = mockFetch(200, {
      data: { users: [{ id: 1, name: 'Alice' }] },
    });

    const gql = createGraphQLClient()
      .url('https://api.test/graphql')
      .fetchFn(fetch)
      .build();

    const result = await gql.query<{ users: Array<{ id: number; name: string }> }>(
      '{ users { id name } }',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data!.users).toHaveLength(1);
      expect(result.value.data!.users[0]!.name).toBe('Alice');
    }
  });

  it('sends mutation with variables', async () => {
    const fetch = mockFetch(200, { data: { createUser: { id: 2 } } });

    const gql = createGraphQLClient()
      .url('https://api.test/graphql')
      .fetchFn(fetch)
      .build();

    await gql.mutation(
      'mutation CreateUser($name: String!) { createUser(name: $name) { id } }',
      { variables: { name: 'Bob' } },
    );

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1]!.body as string);
    expect(body.query).toContain('mutation CreateUser');
    expect(body.variables).toEqual({ name: 'Bob' });
  });

  it('returns GraphQLError when errors[] present and no data', async () => {
    const fetch = mockFetch(200, {
      errors: [
        { message: 'Cannot query field "foo"', locations: [{ line: 1, column: 3 }] },
      ],
    });

    const gql = createGraphQLClient()
      .url('https://api.test/graphql')
      .fetchFn(fetch)
      .build();

    const result = await gql.query('{ foo }');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('GraphQLError');
      expect(result.error.message).toContain('Cannot query field');
      const errors = result.error.cause as Array<{ message: string }>;
      expect(errors).toHaveLength(1);
    }
  });

  it('returns ok with partial errors (data + errors)', async () => {
    const fetch = mockFetch(200, {
      data: { user: { id: 1 } },
      errors: [{ message: 'deprecated field' }],
    });

    const gql = createGraphQLClient()
      .url('https://api.test/graphql')
      .fetchFn(fetch)
      .build();

    const result = await gql.query('{ user { id deprecated_field } }');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data).toBeDefined();
      expect(result.value.errors).toHaveLength(1);
    }
  });

  it('returns error for empty response body', async () => {
    const fetch = mockFetchNoContent();
    const gql = createGraphQLClient()
      .url('https://api.test/graphql')
      .fetchFn(fetch)
      .build();

    const result = await gql.query('{ users { id } }');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('GraphQLError');
    }
  });
});

// ============================================================================
// Auth Middleware Tests
// ============================================================================

describe('Auth middleware', () => {
  it('injects Bearer token', async () => {
    const fetch = mockFetch(200, {});
    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(authMiddleware({ type: 'bearer', token: 'my-token' }))
      .fetchFn(fetch)
      .build();

    await client.get('/secure');

    const headers = ((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-token');
  });

  it('injects Basic auth', async () => {
    const fetch = mockFetch(200, {});
    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(authMiddleware({ type: 'basic', username: 'user', password: 'pass' }))
      .fetchFn(fetch)
      .build();

    await client.get('/secure');

    const headers = ((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Basic ${btoa('user:pass')}`);
  });

  it('injects API key header', async () => {
    const fetch = mockFetch(200, {});
    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(authMiddleware({ type: 'apiKey', token: 'key123', headerName: 'X-Api-Key' }))
      .fetchFn(fetch)
      .build();

    await client.get('/secure');

    const headers = ((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers['X-Api-Key']).toBe('key123');
  });

  it('supports async token function', async () => {
    const fetch = mockFetch(200, {});
    const tokenFn = vi.fn().mockResolvedValue('dynamic-token');

    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(authMiddleware({ type: 'bearer', token: tokenFn }))
      .fetchFn(fetch)
      .build();

    await client.get('/secure');

    expect(tokenFn).toHaveBeenCalledTimes(1);
    const headers = ((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer dynamic-token');
  });
});

// ============================================================================
// Retry Middleware Tests
// ============================================================================

describe('Retry middleware', () => {
  it('retries on 500 errors up to maxRetries', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false, status: 500, statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}), text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: false, status: 500, statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}), text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ ok: true }), text: () => Promise.resolve(''),
      });

    const delays: number[] = [];
    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(retryMiddleware({
        maxRetries: 3,
        baseDelayMs: 100,
        jitter: false,
        delayFn: async (ms) => { delays.push(ms); },
      }))
      .fetchFn(fetch as unknown as typeof globalThis.fetch)
      .build();

    const result = await client.get('/flaky');

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
    // Exponential backoff: 100 * 2^0 = 100, 100 * 2^1 = 200
    expect(delays).toEqual([100, 200]);
  });

  it('does not retry non-retryable errors (404)', async () => {
    const fetch = mockFetch(404, {}, {}, 'Not Found');
    const delayFn = vi.fn();

    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(retryMiddleware({
        maxRetries: 3,
        delayFn,
      }))
      .fetchFn(fetch)
      .build();

    const result = await client.get('/missing');

    expect(result.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(delayFn).not.toHaveBeenCalled();
  });

  it('respects custom retryOnStatusCodes', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false, status: 409, statusText: 'Conflict',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}), text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ ok: true }), text: () => Promise.resolve(''),
      });

    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(retryMiddleware({
        maxRetries: 2,
        retryOnStatusCodes: [409],
        jitter: false,
        baseDelayMs: 10,
        delayFn: async () => {},
      }))
      .fetchFn(fetch as unknown as typeof globalThis.fetch)
      .build();

    const result = await client.get('/conflict');
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('computeDelay with jitter stays within bounds', () => {
    const mockRandom = vi.fn().mockReturnValue(0.5);
    const delay = computeDelay(2, 1000, 30000, true, mockRandom);
    // 1000 * 2^2 = 4000, jitter: floor(0.5 * 4000) = 2000
    expect(delay).toBe(2000);
    expect(mockRandom).toHaveBeenCalledTimes(1);
  });

  it('computeDelay caps at maxDelay', () => {
    const delay = computeDelay(10, 1000, 5000, false, Math.random);
    expect(delay).toBe(5000);
  });

  it('parseRetryAfter parses seconds', () => {
    expect(parseRetryAfter('5')).toBe(5000);
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('parseRetryAfter returns undefined for invalid input', () => {
    expect(parseRetryAfter(undefined)).toBeUndefined();
    expect(parseRetryAfter('not-a-number-or-date')).toBeUndefined();
  });
});

// ============================================================================
// Timeout Middleware Tests
// ============================================================================

describe('Timeout middleware', () => {
  it('returns Timeout error when request exceeds timeout', async () => {
    // Simulate a slow fetch that hangs until aborted
    const slowFetch: typeof globalThis.fetch = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            if (signal.aborted) {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
              return;
            }
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
        }),
    );

    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(timeoutMiddleware({ timeoutMs: 50 }))
      .fetchFn(slowFetch)
      .build();

    const result = await client.get('/slow');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Timeout');
      expect(result.error.message).toContain('50ms');
    }
  }, 15000);

  it('does not timeout for fast requests', async () => {
    const fetch = mockFetch(200, { fast: true });
    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(timeoutMiddleware({ timeoutMs: 5000 }))
      .fetchFn(fetch)
      .build();

    const result = await client.get('/fast');

    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// Logging Middleware Tests
// ============================================================================

describe('Logging middleware', () => {
  it('logs request and response details', async () => {
    const logs: Array<{ method: string; url: string; status?: number; durationMs: number }> = [];
    const fetch = mockFetch(200, {});

    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(loggingMiddleware({
        logger: (entry) => logs.push(entry),
      }))
      .fetchFn(fetch)
      .build();

    await client.get('/logged');

    // Should have 2 log entries: request + response
    expect(logs).toHaveLength(2);
    expect(logs[0]!.method).toBe('GET');
    expect(logs[0]!.url).toBe('https://api.test/logged');
    expect(logs[1]!.status).toBe(200);
    expect(logs[1]!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('logs errors', async () => {
    const logs: Array<{ error?: string }> = [];
    const fetch = mockFetch(500, {}, {}, 'Internal Server Error');

    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(loggingMiddleware({
        logger: (entry) => logs.push(entry),
      }))
      .fetchFn(fetch)
      .build();

    await client.get('/error');

    const responseLog = logs[1];
    expect(responseLog!.error).toBeDefined();
  });
});

// ============================================================================
// Cache Middleware Tests
// ============================================================================

describe('Cache middleware', () => {
  it('caches GET responses and returns cached on second call', async () => {
    const fetch = mockFetch(200, { cached: true });
    let now = 1000;

    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(cacheMiddleware({
        ttlMs: 5000,
        nowFn: () => now,
      }))
      .fetchFn(fetch)
      .build();

    const r1 = await client.get('/cacheable');
    const r2 = await client.get('/cacheable');

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    // fetch should only be called once — second call is cached
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('cache expires after TTL', async () => {
    const fetch = mockFetch(200, { data: 'fresh' });
    let now = 1000;

    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(cacheMiddleware({
        ttlMs: 5000,
        nowFn: () => now,
      }))
      .fetchFn(fetch)
      .build();

    await client.get('/ttl');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Advance time past TTL
    now = 7000;
    await client.get('/ttl');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not cache POST requests by default', async () => {
    const fetch = mockFetch(200, {});

    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(cacheMiddleware({ ttlMs: 5000 }))
      .fetchFn(fetch)
      .build();

    await client.post('/data', { body: { a: 1 } });
    await client.post('/data', { body: { a: 1 } });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not cache error responses', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false, status: 500, statusText: 'Error',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}), text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ ok: true }), text: () => Promise.resolve(''),
      });

    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(cacheMiddleware({ ttlMs: 5000 }))
      .fetchFn(fetch as unknown as typeof globalThis.fetch)
      .build();

    const r1 = await client.get('/maybe-fail');
    expect(r1.ok).toBe(false);

    const r2 = await client.get('/maybe-fail');
    expect(r2.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('createMemoryCacheStore supports get/set/delete/clear', () => {
    const store = createMemoryCacheStore();
    const entry = {
      response: { ok: true as const, value: { data: 1, status: 200, statusText: 'OK', headers: {}, url: '/', ok: true } },
      expiresAt: Date.now() + 5000,
    };

    store.set('key1', entry);
    expect(store.get('key1')).toBe(entry);

    store.delete('key1');
    expect(store.get('key1')).toBeUndefined();

    store.set('key2', entry);
    store.clear();
    expect(store.get('key2')).toBeUndefined();
  });
});

// ============================================================================
// Middleware Composition Tests
// ============================================================================

describe('Middleware composition', () => {
  it('auth + retry + logging work together', async () => {
    const logs: Array<{ method: string; url: string }> = [];
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false, status: 503, statusText: 'Service Unavailable',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}), text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true }), text: () => Promise.resolve(''),
      });

    const client = createRestClient()
      .baseUrl('https://api.test')
      .middleware(loggingMiddleware({ logger: (e) => logs.push(e) }))
      .middleware(authMiddleware({ type: 'bearer', token: 'tok' }))
      .middleware(retryMiddleware({
        maxRetries: 2,
        jitter: false,
        baseDelayMs: 10,
        delayFn: async () => {},
      }))
      .fetchFn(fetch as unknown as typeof globalThis.fetch)
      .build();

    const result = await client.get('/composed');

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    // Auth header should be present on both calls
    for (const call of (fetch as ReturnType<typeof vi.fn>).mock.calls) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer tok');
    }
  });
});

// ============================================================================
// parseHeaders Tests
// ============================================================================

describe('parseHeaders', () => {
  it('converts Headers to plain object', () => {
    const h = new Headers({ 'Content-Type': 'application/json', 'X-Custom': 'value' });
    const parsed = parseHeaders(h);
    expect(parsed['content-type']).toBe('application/json');
    expect(parsed['x-custom']).toBe('value');
  });
});
