/**
 * Fetch wrapper with automatic correlation ID propagation
 * 
 * Automatically:
 * - Injects correlation IDs into request headers
 * - Creates spans for outgoing HTTP requests
 * - Propagates trace context across service boundaries
 */

import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { injectCorrelationToHeaders } from '../correlation.js';

/**
 * Options for traced fetch
 */
export interface TracedFetchOptions extends RequestInit {
  /**
   * Service name for the target service
   */
  serviceName?: string;

  /**
   * Whether to create a span for this request
   */
  createSpan?: boolean;

  /**
   * Custom span name (defaults to HTTP method + URL)
   */
  spanName?: string;

  /**
   * Additional attributes to add to span
   */
  spanAttributes?: Record<string, string | number | boolean>;

  /**
   * Whether to record request/response bodies in span
   */
  recordBody?: boolean;
}

/**
 * Original fetch function type (standard fetch)
 */
type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Traced fetch function type (accepts TracedFetchOptions)
 */
export type TracedFetchFunction = (input: RequestInfo | URL, init?: TracedFetchOptions) => Promise<Response>;

/**
 * Create a traced fetch wrapper
 * 
 * @param baseFetch - Base fetch function (defaults to global fetch)
 * @param defaultServiceName - Default service name for spans
 * 
 * @example
 * ```typescript
 * import { createTracedFetch } from '@isl-lang/distributed-tracing/adapters/fetch';
 * 
 * const tracedFetch = createTracedFetch(fetch, 'my-service');
 * 
 * // Use like normal fetch, but with automatic correlation ID propagation
 * const response = await tracedFetch('https://api.example.com/users', {
 *   method: 'GET',
 *   headers: { 'Authorization': 'Bearer token' },
 * });
 * ```
 */
export function createTracedFetch(
  baseFetch: FetchFunction = fetch as FetchFunction,
  defaultServiceName: string = 'http-client'
): TracedFetchFunction {
  return async function tracedFetch(
    input: RequestInfo | URL,
    init?: TracedFetchOptions
  ): Promise<Response> {
    const {
      serviceName = defaultServiceName,
      createSpan = true,
      spanName,
      spanAttributes = {},
      recordBody = false,
      ...fetchOptions
    } = init ?? {};

    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = fetchOptions.method || 'GET';

    // Inject correlation headers
    const headers = new Headers(fetchOptions.headers);
    const correlationHeaders = injectCorrelationToHeaders({});
    for (const [key, value] of Object.entries(correlationHeaders)) {
      headers.set(key, value);
    }

    // Create span if enabled
    if (!createSpan) {
      return baseFetch(input, { ...fetchOptions, headers });
    }

    const tracer = trace.getTracer(serviceName);
    const spanNameFinal = spanName || `${method} ${url}`;

    return tracer.startActiveSpan(
      spanNameFinal,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'http.method': method,
          'http.url': url,
          'http.target': new URL(url).pathname,
          'http.host': new URL(url).hostname,
          'http.scheme': new URL(url).protocol.replace(':', ''),
          ...spanAttributes,
        },
      },
      async (span) => {
        try {
          // Record request body if enabled
          if (recordBody && fetchOptions.body) {
            try {
              const bodyStr = typeof fetchOptions.body === 'string' 
                ? fetchOptions.body 
                : JSON.stringify(fetchOptions.body);
              span.setAttribute('http.request.body', bodyStr.slice(0, 1024));
            } catch {
              // Ignore serialization errors
            }
          }

          // Make request
          const response = await baseFetch(input, { ...fetchOptions, headers });

          // Record response status
          span.setAttribute('http.status_code', response.status);
          span.setAttribute('http.status_text', response.statusText);

          // Record response body if enabled
          if (recordBody && response.body) {
            try {
              const clonedResponse = response.clone();
              const bodyText = await clonedResponse.text();
              span.setAttribute('http.response.body', bodyText.slice(0, 1024));
            } catch {
              // Ignore errors reading response body
            }
          }

          // Set span status
          if (response.status >= 500) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${response.status}`,
            });
          } else if (response.status >= 400) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${response.status}`,
            });
          } else {
            span.setStatus({ code: SpanStatusCode.OK });
          }

          return response;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          span.setAttribute('error', true);
          throw error;
        } finally {
          span.end();
        }
      }
    );
  };
}

/**
 * Default traced fetch instance
 * Uses global fetch and creates spans automatically
 */
export const tracedFetch = createTracedFetch();

/**
 * Get correlation headers for manual injection
 * Useful when you need to add correlation IDs to custom HTTP clients
 * 
 * @example
 * ```typescript
 * import { getCorrelationHeaders } from '@isl-lang/distributed-tracing/adapters/fetch';
 * 
 * const headers = {
 *   'Authorization': 'Bearer token',
 *   ...getCorrelationHeaders(),
 * };
 * ```
 */
export function getCorrelationHeaders(): Record<string, string> {
  return injectCorrelationToHeaders({});
}
