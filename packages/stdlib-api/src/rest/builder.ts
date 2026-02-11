// ============================================================================
// ISL Standard Library - REST Client Builder
// @isl-lang/stdlib-api
// ============================================================================

import type { Result } from '@isl-lang/stdlib-core';
import type { HttpMethod, ApiResponse, Middleware, ClientConfig } from '../types.js';
import type { ApiError } from '../errors.js';
import type { RestClient, RestClientBuilder, RestRequestParams } from './types.js';
import { resolvePathParams, buildQueryString, executeFetch, createContext } from './methods.js';
import { buildChain } from '../interceptors.js';

/**
 * Create a REST client builder.
 *
 * Usage:
 * ```ts
 * const client = createRestClient()
 *   .baseUrl('https://api.example.com')
 *   .header('Authorization', 'Bearer token')
 *   .middleware(retryMiddleware({ maxRetries: 3 }))
 *   .build();
 *
 * const result = await client.get<User[]>('/users', { query: { page: '1' } });
 * ```
 */
export function createRestClient(): RestClientBuilder {
  const config: ClientConfig = {
    baseUrl: '',
    headers: {},
    timeout: 30_000,
    middleware: [],
    fetchFn: globalThis.fetch?.bind(globalThis),
  };

  const builder: RestClientBuilder = {
    baseUrl(url: string) {
      config.baseUrl = url.replace(/\/+$/, '');
      return builder;
    },
    header(name: string, value: string) {
      config.headers[name] = value;
      return builder;
    },
    headers(headers: Record<string, string>) {
      Object.assign(config.headers, headers);
      return builder;
    },
    timeout(ms: number) {
      config.timeout = ms;
      return builder;
    },
    middleware(mw: Middleware) {
      config.middleware.push(mw);
      return builder;
    },
    fetchFn(fn: typeof globalThis.fetch) {
      config.fetchFn = fn;
      return builder;
    },
    build(): RestClient {
      const snapshot: ClientConfig = {
        baseUrl: config.baseUrl,
        headers: { ...config.headers },
        timeout: config.timeout,
        middleware: [...config.middleware],
        fetchFn: config.fetchFn,
      };

      function makeRequest<T>(
        method: HttpMethod,
        url: string,
        params?: RestRequestParams,
      ): Promise<Result<ApiResponse<T>, ApiError>> {
        const resolvedPath = resolvePathParams(url, params?.path);
        const qs = buildQueryString(params?.query);
        const fullUrl = `${snapshot.baseUrl}${resolvedPath}${qs}`;

        const mergedHeaders: Record<string, string> = {
          ...snapshot.headers,
          ...params?.headers,
        };

        // Auto-set Content-Type for JSON bodies
        if (params?.body !== undefined && !mergedHeaders['content-type'] && !mergedHeaders['Content-Type']) {
          mergedHeaders['Content-Type'] = 'application/json';
        }

        const requestConfig = {
          url: fullUrl,
          method,
          headers: mergedHeaders,
          body: params?.body,
          timeout: params?.timeout ?? snapshot.timeout,
          signal: params?.signal,
        };

        const ctx = createContext(requestConfig);

        const finalHandler = (c: import('../types.js').MiddlewareContext) => executeFetch(c.request, snapshot.fetchFn);

        const chain = buildChain(snapshot.middleware, finalHandler);

        return chain(ctx) as Promise<Result<ApiResponse<T>, ApiError>>;
      }

      return {
        get: <T = unknown>(url: string, params?: RestRequestParams) =>
          makeRequest<T>('GET', url, params),
        post: <T = unknown>(url: string, params?: RestRequestParams) =>
          makeRequest<T>('POST', url, params),
        put: <T = unknown>(url: string, params?: RestRequestParams) =>
          makeRequest<T>('PUT', url, params),
        patch: <T = unknown>(url: string, params?: RestRequestParams) =>
          makeRequest<T>('PATCH', url, params),
        delete: <T = unknown>(url: string, params?: RestRequestParams) =>
          makeRequest<T>('DELETE', url, params),
        head: (url: string, params?: RestRequestParams) =>
          makeRequest<void>('HEAD', url, params),
        options: (url: string, params?: RestRequestParams) =>
          makeRequest<unknown>('OPTIONS', url, params),
        request: <T = unknown>(method: HttpMethod, url: string, params?: RestRequestParams) =>
          makeRequest<T>(method, url, params),
      };
    },
  };

  return builder;
}
