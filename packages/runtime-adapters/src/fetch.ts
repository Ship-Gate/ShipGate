/**
 * Fetch Adapter for Verification
 * 
 * Wraps fetch to capture outbound HTTP calls for verification.
 * 
 * @example
 * ```typescript
 * import { createVerificationFetch } from '@isl-lang/runtime-adapters/fetch';
 * 
 * const fetchWithVerification = createVerificationFetch({
 *   domain: 'Auth',
 *   behaviorExtractor: (url, options) => `fetch ${options?.method || 'GET'} ${url}`,
 * });
 * 
 * // Use instead of global fetch
 * const response = await fetchWithVerification('https://api.example.com/users', {
 *   method: 'GET',
 * });
 * ```
 */

import type { TraceEvent } from '@isl-lang/trace-format';
import { getCollector } from './collector.js';
import { randomUUID } from 'node:crypto';

/**
 * Options for Fetch verification adapter
 */
export interface FetchVerificationOptions {
  /**
   * Domain name for traces (e.g., 'Auth', 'Payments')
   */
  domain: string;

  /**
   * Extract behavior name from URL and options
   * Default: `fetch ${options?.method || 'GET'} ${url}`
   */
  behaviorExtractor?: (url: string, options?: RequestInit) => string;

  /**
   * Extract correlation ID from headers or generate new one
   * Default: checks 'x-correlation-id' header or generates new UUID
   */
  correlationIdExtractor?: (options?: RequestInit) => string;

  /**
   * Whether to capture request body
   * Default: false (for security)
   */
  captureRequestBody?: boolean;

  /**
   * Whether to capture response body
   * Default: false (for security)
   */
  captureResponseBody?: boolean;

  /**
   * URLs to ignore (e.g., health checks, metrics)
   */
  ignoreUrls?: string[];

  /**
   * Custom filter to skip tracing
   */
  shouldTrace?: (url: string, options?: RequestInit) => boolean;
}

/**
 * Create a fetch function with verification tracing
 */
export function createVerificationFetch(
  options: FetchVerificationOptions
): typeof fetch {
  const {
    domain,
    behaviorExtractor = (url, options) => `fetch ${options?.method || 'GET'} ${url}`,
    correlationIdExtractor = (options) => {
      const headers = options?.headers as HeadersInit | undefined;
      if (headers) {
        const headerMap = headers instanceof Headers ? headers : new Headers(headers);
        const correlationId = headerMap.get('x-correlation-id');
        if (correlationId) {
          return correlationId;
        }
      }
      return randomUUID();
    },
    captureRequestBody = false,
    captureResponseBody = false,
    ignoreUrls = [],
    shouldTrace,
  } = options;

  const collector = getCollector();

  return async function verificationFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const options = init || {};

    // Check if we should trace this request
    if (shouldTrace && !shouldTrace(url, options)) {
      return fetch(input, options);
    }

    // Check ignore URLs
    if (ignoreUrls.some((ignoreUrl) => url.includes(ignoreUrl))) {
      return fetch(input, options);
    }

    const correlationId = correlationIdExtractor(options);
    const behavior = behaviorExtractor(url, options);
    const startTime = Date.now();

    // Create handler_call event
    const startEvent: TraceEvent = {
      time: new Date().toISOString(),
      kind: 'handler_call',
      correlationId,
      handler: behavior,
      inputs: {
        url,
        method: options.method || 'GET',
        headers: captureRequestBody
          ? Object.fromEntries(
              Object.entries(options.headers || {}).filter(
                ([key]) => !key.toLowerCase().includes('authorization')
              )
            )
          : {},
        ...(captureRequestBody && options.body ? { body: sanitizeBody(options.body) } : {}),
      },
      outputs: {},
      events: [],
      timing: {
        startMs: startTime,
        sequence: 0,
      },
    };

    collector.addEvent(startEvent);

    try {
      // Make the actual fetch call
      const response = await fetch(input, options);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Capture response body if enabled
      let responseBody: unknown = undefined;
      if (captureResponseBody) {
        try {
          const clonedResponse = response.clone();
          const contentType = clonedResponse.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            responseBody = await clonedResponse.json();
          } else {
            responseBody = await clonedResponse.text();
          }
        } catch {
          // Ignore body parsing errors
        }
      }

      // Create handler_return event
      const endEvent: TraceEvent = {
        time: new Date().toISOString(),
        kind: response.status >= 400 ? 'handler_error' : 'handler_return',
        correlationId,
        handler: behavior,
        inputs: {},
        outputs: response.status >= 400
          ? {
              error: {
                name: `HTTP ${response.status}`,
                message: `Request failed with status ${response.status}`,
                code: String(response.status),
              },
            }
          : {
              result: responseBody,
              duration,
              status: response.status,
              statusText: response.statusText,
            },
        events: [],
        timing: {
          startMs: startTime,
          endMs: endTime,
          durationMs: duration,
          sequence: 1,
        },
      };

      collector.addEvent(endEvent);

      return response;
    } catch (error) {
      const endTime = Date.now();

      // Create handler_error event
      const errorEvent: TraceEvent = {
        time: new Date().toISOString(),
        kind: 'handler_error',
        correlationId,
        handler: behavior,
        inputs: {},
        outputs: {
          error: {
            name: error instanceof Error ? error.name : 'FetchError',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        },
        events: [],
        timing: {
          startMs: startTime,
          endMs: endTime,
          durationMs: endTime - startTime,
          sequence: 1,
        },
      };

      collector.addEvent(errorEvent);

      throw error;
    }
  };
}

/**
 * Sanitize request/response body for tracing
 * Removes sensitive fields and limits size
 */
function sanitizeBody(body: unknown): unknown {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return sanitizeBody(parsed);
    } catch {
      // Not JSON, return as-is but limit size
      return body.length > 1024 ? body.substring(0, 1024) + '...' : body;
    }
  }

  if (typeof body !== 'object' || body === null) {
    return body;
  }

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'api_key', 'apikey'];

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  // Limit size
  const json = JSON.stringify(sanitized);
  if (json.length > 1024) {
    return { ...sanitized, _truncated: true };
  }

  return sanitized;
}
