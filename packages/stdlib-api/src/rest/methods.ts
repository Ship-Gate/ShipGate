// ============================================================================
// ISL Standard Library - REST HTTP Method Helpers
// @isl-lang/stdlib-api
// ============================================================================

import type { Result } from '@isl-lang/stdlib-core';
import type { HttpMethod, ApiResponse, RequestConfig, MiddlewareContext } from '../types.js';
import type { ApiError } from '../errors.js';
import { networkError, timeoutError, abortError, httpError, parseError, unknownError } from '../errors.js';

/**
 * Resolve path parameters in a URL template.
 * e.g. "/users/:id" + { id: "123" } => "/users/123"
 */
export function resolvePathParams(url: string, params?: Record<string, string | number>): string {
  if (!params) return url;
  let resolved = url;
  for (const [key, value] of Object.entries(params)) {
    resolved = resolved.replace(`:${key}`, encodeURIComponent(String(value)));
  }
  return resolved;
}

/**
 * Build a query string from params, omitting undefined values.
 */
export function buildQueryString(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
  );
  if (entries.length === 0) return '';
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `?${qs}`;
}

/**
 * Parse response headers from a fetch Response into a plain object.
 */
export function parseHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value: string, key: string) => {
    result[key] = value;
  });
  return result;
}

/**
 * Execute a raw fetch request and return a Result.
 * This is the "final handler" at the bottom of the middleware chain.
 */
export async function executeFetch(
  config: RequestConfig,
  fetchFn: typeof globalThis.fetch,
): Promise<Result<ApiResponse, ApiError>> {
  let controller: AbortController | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    // Set up timeout via AbortController
    if (config.timeout && config.timeout > 0 && !config.signal) {
      controller = new AbortController();
      timeoutId = setTimeout(() => controller!.abort(), config.timeout);
    }

    const signal = config.signal ?? controller?.signal;

    const init: RequestInit = {
      method: config.method,
      headers: config.headers,
      signal,
    };

    if (config.body !== undefined && config.method !== 'GET' && config.method !== 'HEAD') {
      init.body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
    }

    const response = await fetchFn(config.url, init);

    if (timeoutId !== undefined) clearTimeout(timeoutId);

    const responseHeaders = parseHeaders(response.headers);
    const contentType = responseHeaders['content-type'] ?? '';

    let data: unknown;
    if (response.status === 204 || response.status === 205) {
      data = undefined;
    } else if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (e) {
        return { ok: false, error: parseError('Failed to parse JSON response', e) };
      }
    } else {
      data = await response.text();
    }

    const apiResponse: ApiResponse = {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      url: config.url,
      ok: response.ok,
    };

    if (!response.ok) {
      return { ok: false, error: httpError(response.status, response.statusText, config.url) };
    }

    return { ok: true, value: apiResponse };
  } catch (err: unknown) {
    if (timeoutId !== undefined) clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === 'AbortError') {
      // Distinguish user abort from timeout
      if (config.signal?.aborted) {
        return { ok: false, error: abortError(config.url) };
      }
      return { ok: false, error: timeoutError(config.url, config.timeout ?? 0) };
    }

    if (err instanceof TypeError) {
      // fetch throws TypeError for network failures
      return { ok: false, error: networkError(err.message, err) };
    }

    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: unknownError(message, err) };
  }
}

/**
 * Create a MiddlewareContext from a RequestConfig.
 */
export function createContext(config: RequestConfig): MiddlewareContext {
  return { request: config, metadata: {} };
}
