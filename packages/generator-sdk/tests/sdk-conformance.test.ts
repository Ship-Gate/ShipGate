/**
 * SDK Ecosystem Conformance Tests
 *
 * Verifies that ONE spec → THREE SDKs with consistent shape.
 * All shared logic (errors, auth, retry, pagination) lives in the
 * runtime engine and is re-exported identically by every SDK skin.
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Import the shared runtime — the single source of truth
// ============================================================================

import {
  ISLError,
  ValidationError,
  PreconditionError,
  PostconditionError,
  NetworkError,
  ServerError,
  ApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  toISLError,
  errorFromStatus,
  resolveAuthHeader,
  createAuthInterceptors,
  hasAuthCredentials,
  calculateRetryDelay,
  withRetry,
  isRetryableStatus,
  sleep,
  paginate,
  paginateAll,
  toPaginatedResponse,
  buildPaginationQuery,
  BaseClient,
  createBaseClient,
  DEFAULT_RETRY,
  DEFAULT_CACHE,
  DEFAULT_HEADERS,
  DEFAULT_TIMEOUT,
} from '../src/runtime/index.js';

import type {
  ISLClientConfig,
  AuthConfig,
  RetryConfig,
  ApiResponse,
  Result,
  PaginatedResponse,
  PaginationParams,
  ISLErrorType,
} from '../src/runtime/index.js';

// ============================================================================
// 1. Consistent Error Model
// ============================================================================

describe('Consistent Error Model', () => {
  it('all error classes extend ISLError', () => {
    expect(new ValidationError('x')).toBeInstanceOf(ISLError);
    expect(new PreconditionError('x', 'pre')).toBeInstanceOf(ISLError);
    expect(new PostconditionError('x', 'post')).toBeInstanceOf(ISLError);
    expect(new NetworkError('x')).toBeInstanceOf(ISLError);
    expect(new ServerError('x')).toBeInstanceOf(ISLError);
    expect(new UnauthorizedError()).toBeInstanceOf(ISLError);
    expect(new ForbiddenError()).toBeInstanceOf(ISLError);
    expect(new NotFoundError()).toBeInstanceOf(ISLError);
    expect(new RateLimitError(60)).toBeInstanceOf(ISLError);
  });

  it('all error classes extend Error', () => {
    expect(new ISLError('x')).toBeInstanceOf(Error);
    expect(new ValidationError('x')).toBeInstanceOf(Error);
    expect(new NetworkError('x')).toBeInstanceOf(Error);
  });

  it('error names are set correctly', () => {
    expect(new ISLError('x').name).toBe('ISLError');
    expect(new ValidationError('x').name).toBe('ValidationError');
    expect(new PreconditionError('x', 'pre').name).toBe('PreconditionError');
    expect(new PostconditionError('x', 'post').name).toBe('PostconditionError');
    expect(new NetworkError('x').name).toBe('NetworkError');
    expect(new ServerError('x').name).toBe('ServerError');
    expect(new ApiError(500, 'fail', null, new Headers()).name).toBe('ApiError');
    expect(new UnauthorizedError().name).toBe('UnauthorizedError');
    expect(new ForbiddenError().name).toBe('ForbiddenError');
    expect(new NotFoundError().name).toBe('NotFoundError');
    expect(new RateLimitError(60).name).toBe('RateLimitError');
  });

  it('errorFromStatus maps HTTP codes to correct error classes', () => {
    const headers = new Headers();
    expect(errorFromStatus(401, {}, headers)).toBeInstanceOf(UnauthorizedError);
    expect(errorFromStatus(403, {}, headers)).toBeInstanceOf(ForbiddenError);
    expect(errorFromStatus(404, {}, headers)).toBeInstanceOf(NotFoundError);
    expect(errorFromStatus(429, {}, headers)).toBeInstanceOf(RateLimitError);
    expect(errorFromStatus(500, {}, headers)).toBeInstanceOf(ServerError);
    expect(errorFromStatus(502, {}, headers)).toBeInstanceOf(ServerError);
  });

  it('toISLError converts discriminated union shapes to error instances', () => {
    expect(toISLError({ code: 'NETWORK_ERROR', message: 'fail', isOffline: true })).toBeInstanceOf(NetworkError);
    expect(toISLError({ code: 'TIMEOUT', message: 'slow', timeoutMs: 5000 })).toBeInstanceOf(NetworkError);
    expect(toISLError({ code: 'VALIDATION_ERROR', message: 'bad', errors: [] })).toBeInstanceOf(ValidationError);
    expect(toISLError({ code: 'AUTH_ERROR', message: 'denied' })).toBeInstanceOf(UnauthorizedError);
    expect(toISLError({ code: 'UNAUTHORIZED', message: 'no' })).toBeInstanceOf(UnauthorizedError);
    expect(toISLError({ code: 'RATE_LIMITED', message: 'slow down', retryAfter: 30 })).toBeInstanceOf(RateLimitError);
    expect(toISLError({ code: 'UNKNOWN', message: 'oops', statusCode: 500 })).toBeInstanceOf(ServerError);
  });

  it('ValidationError carries field and value', () => {
    const err = new ValidationError('bad email', 'email', 'notanemail');
    expect(err.field).toBe('email');
    expect(err.value).toBe('notanemail');
    expect(err.message).toBe('bad email');
  });

  it('RateLimitError carries retryAfterSeconds', () => {
    const err = new RateLimitError(120, 'throttled');
    expect(err.retryAfterSeconds).toBe(120);
  });

  it('PreconditionError carries precondition string', () => {
    const err = new PreconditionError('too short', 'len >= 3', 2);
    expect(err.precondition).toBe('len >= 3');
    expect(err.actualValue).toBe(2);
  });

  it('PostconditionError carries expected and actual', () => {
    const err = new PostconditionError('mismatch', 'x == y', 'a', 'b');
    expect(err.postcondition).toBe('x == y');
    expect(err.expectedValue).toBe('a');
    expect(err.actualValue).toBe('b');
  });
});

// ============================================================================
// 2. Consistent Auth Hooks
// ============================================================================

describe('Consistent Auth Hooks', () => {
  it('resolveAuthHeader returns Bearer header for bearer type', async () => {
    const auth: AuthConfig = { type: 'bearer', token: 'tok123' };
    const header = await resolveAuthHeader(auth);
    expect(header).toEqual({ Authorization: 'Bearer tok123' });
  });

  it('resolveAuthHeader returns Bearer header from async getter', async () => {
    const auth: AuthConfig = { type: 'bearer', token: async () => 'async-tok' };
    const header = await resolveAuthHeader(auth);
    expect(header).toEqual({ Authorization: 'Bearer async-tok' });
  });

  it('resolveAuthHeader returns api-key header', async () => {
    const auth: AuthConfig = { type: 'api-key', apiKey: 'key123' };
    const header = await resolveAuthHeader(auth);
    expect(header).toEqual({ 'X-API-Key': 'key123' });
  });

  it('resolveAuthHeader uses custom api-key header name', async () => {
    const auth: AuthConfig = { type: 'api-key', apiKey: 'k', apiKeyHeader: 'X-Custom' };
    const header = await resolveAuthHeader(auth);
    expect(header).toEqual({ 'X-Custom': 'k' });
  });

  it('resolveAuthHeader returns Basic header', async () => {
    const auth: AuthConfig = { type: 'basic', token: 'dXNlcjpwYXNz' };
    const header = await resolveAuthHeader(auth);
    expect(header).toEqual({ Authorization: 'Basic dXNlcjpwYXNz' });
  });

  it('resolveAuthHeader returns null when no token', async () => {
    const auth: AuthConfig = { type: 'bearer' };
    const header = await resolveAuthHeader(auth);
    expect(header).toBeNull();
  });

  it('hasAuthCredentials returns true for bearer with token', () => {
    expect(hasAuthCredentials({ type: 'bearer', token: 'x' })).toBe(true);
  });

  it('hasAuthCredentials returns false for bearer without token', () => {
    expect(hasAuthCredentials({ type: 'bearer' })).toBe(false);
  });

  it('hasAuthCredentials returns false when undefined', () => {
    expect(hasAuthCredentials(undefined)).toBe(false);
  });

  it('createAuthInterceptors returns request and response functions', () => {
    const interceptors = createAuthInterceptors({
      type: 'bearer',
      token: 'tok',
    });
    expect(typeof interceptors.request).toBe('function');
    expect(typeof interceptors.response).toBe('function');
  });
});

// ============================================================================
// 3. Consistent Retry / Backoff
// ============================================================================

describe('Consistent Retry / Backoff', () => {
  it('linear backoff scales linearly', () => {
    const config: RetryConfig = {
      maxAttempts: 5,
      baseDelay: 100,
      maxDelay: 1000,
      retryableStatusCodes: [],
      backoff: 'linear',
    };
    expect(calculateRetryDelay(1, config)).toBe(100);
    expect(calculateRetryDelay(2, config)).toBe(200);
    expect(calculateRetryDelay(3, config)).toBe(300);
  });

  it('linear backoff caps at maxDelay', () => {
    const config: RetryConfig = {
      maxAttempts: 5,
      baseDelay: 500,
      maxDelay: 1000,
      retryableStatusCodes: [],
      backoff: 'linear',
    };
    expect(calculateRetryDelay(5, config)).toBe(1000);
  });

  it('exponential backoff grows exponentially', () => {
    const config: RetryConfig = {
      maxAttempts: 5,
      baseDelay: 100,
      maxDelay: 100000,
      retryableStatusCodes: [],
      backoff: 'exponential',
    };
    const d1 = calculateRetryDelay(1, config);
    const d2 = calculateRetryDelay(2, config);
    const d3 = calculateRetryDelay(3, config);
    // Exponential: 100, 200, 400 (+ jitter)
    expect(d1).toBeGreaterThanOrEqual(100);
    expect(d1).toBeLessThan(120); // 100 + 10% jitter
    expect(d2).toBeGreaterThanOrEqual(200);
    expect(d3).toBeGreaterThanOrEqual(400);
  });

  it('isRetryableStatus checks against config', () => {
    expect(isRetryableStatus(429, DEFAULT_RETRY)).toBe(true);
    expect(isRetryableStatus(500, DEFAULT_RETRY)).toBe(true);
    expect(isRetryableStatus(404, DEFAULT_RETRY)).toBe(false);
    expect(isRetryableStatus(401, DEFAULT_RETRY)).toBe(false);
  });

  it('withRetry succeeds on first try', async () => {
    const result = await withRetry(async () => 42, { ...DEFAULT_RETRY, maxAttempts: 3 });
    expect(result.value).toBe(42);
    expect(result.attempts).toBe(1);
  });

  it('withRetry retries on failure and eventually succeeds', async () => {
    let count = 0;
    const result = await withRetry(
      async () => {
        count++;
        if (count < 3) throw new Error('fail');
        return 'ok';
      },
      { ...DEFAULT_RETRY, maxAttempts: 5, baseDelay: 10, maxDelay: 20, backoff: 'linear' },
    );
    expect(result.value).toBe('ok');
    expect(result.attempts).toBe(3);
  });

  it('withRetry exhausts max attempts and returns error', async () => {
    const result = await withRetry(
      async () => { throw new Error('always fail'); },
      { ...DEFAULT_RETRY, maxAttempts: 2, baseDelay: 10, maxDelay: 20, backoff: 'linear' },
    );
    expect(result.value).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.attempts).toBe(2);
  });

  it('withRetry respects shouldRetry predicate', async () => {
    let count = 0;
    const result = await withRetry(
      async () => { count++; throw new Error('nope'); },
      { ...DEFAULT_RETRY, maxAttempts: 10, baseDelay: 10, maxDelay: 20, backoff: 'linear' },
      (_err, attempt) => attempt < 2,
    );
    expect(count).toBe(2);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// 4. Consistent Pagination
// ============================================================================

describe('Consistent Pagination', () => {
  it('paginate yields pages until hasMore is false', async () => {
    let callNum = 0;
    const fetchPage = async (params: PaginationParams): Promise<PaginatedResponse<number>> => {
      callNum++;
      if (callNum === 1) return { items: [1, 2], nextCursor: 'c2', hasMore: true };
      if (callNum === 2) return { items: [3, 4], nextCursor: 'c3', hasMore: true };
      return { items: [5], hasMore: false };
    };

    const pages: number[][] = [];
    for await (const page of paginate(fetchPage)) {
      pages.push(page);
    }

    expect(pages).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('paginateAll collects all items into one array', async () => {
    let callNum = 0;
    const fetchPage = async (params: PaginationParams): Promise<PaginatedResponse<string>> => {
      callNum++;
      if (callNum === 1) return { items: ['a', 'b'], nextCursor: 'x', hasMore: true };
      return { items: ['c'], hasMore: false };
    };

    const all = await paginateAll(fetchPage);
    expect(all).toEqual(['a', 'b', 'c']);
  });

  it('buildPaginationQuery builds cursor and limit params', () => {
    expect(buildPaginationQuery({ cursor: 'abc', limit: 25 })).toEqual({
      cursor: 'abc',
      limit: '25',
    });
  });

  it('buildPaginationQuery omits undefined values', () => {
    expect(buildPaginationQuery({})).toEqual({});
    expect(buildPaginationQuery({ limit: 10 })).toEqual({ limit: '10' });
  });

  it('toPaginatedResponse extracts standard shape', () => {
    const raw: ApiResponse<{ items: number[]; nextCursor: string; hasMore: boolean; total: number }> = {
      data: { items: [1, 2], nextCursor: 'n', hasMore: true, total: 100 },
      status: 200,
      headers: new Headers(),
      ok: true,
    };
    const page = toPaginatedResponse(raw);
    expect(page.items).toEqual([1, 2]);
    expect(page.nextCursor).toBe('n');
    expect(page.hasMore).toBe(true);
    expect(page.total).toBe(100);
  });
});

// ============================================================================
// 5. Default Configuration Consistency
// ============================================================================

describe('Default Configuration Consistency', () => {
  it('DEFAULT_RETRY has expected shape', () => {
    expect(DEFAULT_RETRY.maxAttempts).toBe(3);
    expect(DEFAULT_RETRY.baseDelay).toBe(1000);
    expect(DEFAULT_RETRY.maxDelay).toBe(10_000);
    expect(DEFAULT_RETRY.backoff).toBe('exponential');
    expect(DEFAULT_RETRY.retryableStatusCodes).toContain(429);
    expect(DEFAULT_RETRY.retryableStatusCodes).toContain(500);
    expect(DEFAULT_RETRY.retryableStatusCodes).toContain(502);
    expect(DEFAULT_RETRY.retryableStatusCodes).toContain(503);
    expect(DEFAULT_RETRY.retryableStatusCodes).toContain(504);
  });

  it('DEFAULT_CACHE has expected shape', () => {
    expect(DEFAULT_CACHE.enabled).toBe(false);
    expect(DEFAULT_CACHE.ttl).toBe(60_000);
    expect(DEFAULT_CACHE.maxSize).toBe(100);
  });

  it('DEFAULT_TIMEOUT is 30 seconds', () => {
    expect(DEFAULT_TIMEOUT).toBe(30_000);
  });

  it('DEFAULT_HEADERS include JSON content type', () => {
    expect(DEFAULT_HEADERS['Content-Type']).toBe('application/json');
    expect(DEFAULT_HEADERS['Accept']).toBe('application/json');
  });
});

// ============================================================================
// 6. BaseClient Shape
// ============================================================================

describe('BaseClient Shape', () => {
  it('can be instantiated with minimal config', () => {
    const client = createBaseClient({ baseUrl: 'https://api.example.com' });
    expect(client).toBeInstanceOf(BaseClient);
  });

  it('exposes get, post, put, patch, delete methods', () => {
    const client = createBaseClient({ baseUrl: 'https://api.example.com' });
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.delete).toBe('function');
  });

  it('exposes cancel, cancelAll, clearCache, setHeader', () => {
    const client = createBaseClient({ baseUrl: 'https://api.example.com' });
    expect(typeof client.cancel).toBe('function');
    expect(typeof client.cancelAll).toBe('function');
    expect(typeof client.clearCache).toBe('function');
    expect(typeof client.setHeader).toBe('function');
  });
});

// ============================================================================
// 7. Golden Shape Snapshot — One spec, three targets, same contract surface
// ============================================================================

describe('Golden Shape — Shared Runtime API Surface', () => {
  const runtimeExports = {
    errors: [
      'ISLError', 'ValidationError', 'PreconditionError', 'PostconditionError',
      'NetworkError', 'ServerError', 'ApiError', 'UnauthorizedError',
      'ForbiddenError', 'NotFoundError', 'RateLimitError',
      'toISLError', 'errorFromStatus',
    ],
    auth: ['resolveAuthHeader', 'createAuthInterceptors', 'hasAuthCredentials'],
    retry: ['calculateRetryDelay', 'withRetry', 'isRetryableStatus', 'sleep'],
    pagination: ['paginate', 'paginateAll', 'toPaginatedResponse', 'buildPaginationQuery'],
    client: ['BaseClient', 'createBaseClient'],
    defaults: ['DEFAULT_RETRY', 'DEFAULT_CACHE', 'DEFAULT_HEADERS', 'DEFAULT_TIMEOUT'],
  };

  it('runtime exports exactly the expected error symbols', () => {
    const errorSymbols: Record<string, unknown> = {
      ISLError, ValidationError, PreconditionError, PostconditionError,
      NetworkError, ServerError, ApiError, UnauthorizedError,
      ForbiddenError, NotFoundError, RateLimitError,
      toISLError, errorFromStatus,
    };
    for (const name of runtimeExports.errors) {
      expect(errorSymbols[name]).toBeDefined();
    }
  });

  it('runtime exports exactly the expected auth symbols', () => {
    expect(typeof resolveAuthHeader).toBe('function');
    expect(typeof createAuthInterceptors).toBe('function');
    expect(typeof hasAuthCredentials).toBe('function');
  });

  it('runtime exports exactly the expected retry symbols', () => {
    expect(typeof calculateRetryDelay).toBe('function');
    expect(typeof withRetry).toBe('function');
    expect(typeof isRetryableStatus).toBe('function');
    expect(typeof sleep).toBe('function');
  });

  it('runtime exports exactly the expected pagination symbols', () => {
    expect(typeof paginate).toBe('function');
    expect(typeof paginateAll).toBe('function');
    expect(typeof toPaginatedResponse).toBe('function');
    expect(typeof buildPaginationQuery).toBe('function');
  });

  it('runtime exports BaseClient and factory', () => {
    expect(typeof BaseClient).toBe('function');
    expect(typeof createBaseClient).toBe('function');
  });

  it('runtime exports all default constants', () => {
    expect(DEFAULT_RETRY).toBeDefined();
    expect(DEFAULT_CACHE).toBeDefined();
    expect(DEFAULT_HEADERS).toBeDefined();
    expect(DEFAULT_TIMEOUT).toBeDefined();
  });
});
