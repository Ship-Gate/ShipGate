/**
 * Express Adapter for Verification
 * 
 * Intercepts requests/responses and captures traces for temporal/coverage analysis.
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { expressVerificationMiddleware } from '@isl-lang/runtime-adapters/express';
 * 
 * const app = express();
 * 
 * // One line of adapter wiring
 * app.use(expressVerificationMiddleware({
 *   domain: 'Auth',
 *   behaviorExtractor: (req) => `${req.method} ${req.path}`,
 * }));
 * ```
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Trace, TraceEvent } from '@isl-lang/trace-format';
import { getCollector } from './collector.js';
import { randomUUID } from 'node:crypto';

/**
 * Options for Express verification middleware
 */
export interface ExpressVerificationOptions {
  /**
   * Domain name for traces (e.g., 'Auth', 'Payments')
   */
  domain: string;

  /**
   * Extract behavior name from request
   * Default: `${req.method} ${req.path}`
   */
  behaviorExtractor?: (req: Request) => string;

  /**
   * Extract correlation ID from request headers
   * Default: checks 'x-correlation-id' or generates new UUID
   */
  correlationIdExtractor?: (req: Request) => string;

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
   * Paths to ignore (e.g., health checks)
   */
  ignorePaths?: string[];

  /**
   * Custom filter to skip tracing
   */
  shouldTrace?: (req: Request) => boolean;
}

/**
 * Express middleware for verification tracing
 */
export function expressVerificationMiddleware(
  options: ExpressVerificationOptions
): RequestHandler {
  const {
    domain,
    behaviorExtractor = (req) => `${req.method} ${req.path}`,
    correlationIdExtractor = (req) => {
      const header = req.headers['x-correlation-id'];
      return typeof header === 'string' ? header : randomUUID();
    },
    captureRequestBody = false,
    captureResponseBody = false,
    ignorePaths = ['/health', '/metrics'],
    shouldTrace,
  } = options;

  const collector = getCollector();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if we should trace this request
    if (shouldTrace && !shouldTrace(req)) {
      next();
      return;
    }

    // Check ignore paths
    if (ignorePaths.some((path) => req.path.startsWith(path))) {
      next();
      return;
    }

    const correlationId = correlationIdExtractor(req);
    const behavior = behaviorExtractor(req);
    const traceId = randomUUID();
    const startTime = Date.now();

    // Create handler_call event
    const startEvent: TraceEvent = {
      time: new Date().toISOString(),
      kind: 'handler_call',
      correlationId,
      handler: behavior,
      inputs: {
        method: req.method,
        url: req.originalUrl || req.url,
        path: req.path,
        headers: captureRequestBody
          ? Object.fromEntries(
              Object.entries(req.headers).filter(
                ([key]) => !key.toLowerCase().includes('authorization')
              )
            )
          : {},
        ...(captureRequestBody && req.body ? { body: sanitizeBody(req.body) } : {}),
      },
      outputs: {},
      events: [],
      timing: {
        startMs: startTime,
        sequence: 0,
      },
    };

    // Store context on request
    (req as Request & { __traceContext?: TraceContext }).__traceContext = {
      traceId,
      correlationId,
      behavior,
      startTime,
      startEvent,
    };

    // Create initial trace
    const trace: Trace = {
      id: traceId,
      name: `${behavior} - ${req.method} ${req.path}`,
      domain,
      startTime: new Date(startTime).toISOString(),
      correlationId,
      events: [startEvent],
    };

    collector.addTrace(trace);

    // Override res.end to capture response
    const originalEnd = res.end.bind(res);
    res.end = function (
      this: Response,
      chunk?: unknown,
      encoding?: BufferEncoding | (() => void),
      callback?: () => void
    ): Response {
      const context = (req as Request & { __traceContext?: TraceContext }).__traceContext;
      if (context) {
        const endTime = Date.now();
        const duration = endTime - context.startTime;

        // Create handler_return event
        const endEvent: TraceEvent = {
          time: new Date().toISOString(),
          kind: res.statusCode >= 400 ? 'handler_error' : 'handler_return',
          correlationId: context.correlationId,
          handler: context.behavior,
          inputs: {},
          outputs: res.statusCode >= 400
            ? {
                error: {
                  name: `HTTP ${res.statusCode}`,
                  message: `Request failed with status ${res.statusCode}`,
                  code: String(res.statusCode),
                },
              }
            : {
                result: captureResponseBody ? sanitizeBody(chunk) : undefined,
                duration,
              },
          events: [],
          timing: {
            startMs: context.startTime,
            endMs: endTime,
            durationMs: duration,
            sequence: 1,
          },
        };

        // Update trace with end event
        const traces = collector.getTracesForDomain(domain);
        const trace = traces.find((t) => t.id === context.traceId);
        if (trace) {
          trace.events.push(endEvent);
          trace.endTime = new Date(endTime).toISOString();
        } else {
          collector.addEvent(endEvent);
        }
      }

      // Handle overloaded parameters
      if (typeof encoding === 'function') {
        return originalEnd(chunk, encoding);
      }
      return originalEnd(chunk, encoding ?? 'utf8', callback);
    } as Response['end'];

    // Handle errors
    res.on('error', (error: Error) => {
      const context = (req as Request & { __traceContext?: TraceContext }).__traceContext;
      if (!context) return;

      const endTime = Date.now();

      // Create handler_error event
      const errorEvent: TraceEvent = {
        time: new Date().toISOString(),
        kind: 'handler_error',
        correlationId: context.correlationId,
        handler: context.behavior,
        inputs: {},
        outputs: {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        },
        events: [],
        timing: {
          startMs: context.startTime,
          endMs: endTime,
          durationMs: endTime - context.startTime,
          sequence: 1,
        },
      };

      // Update trace with error event
      const traces = collector.getTracesForDomain(domain);
      const trace = traces.find((t) => t.id === context.traceId);
      if (trace) {
        trace.events.push(errorEvent);
        trace.endTime = new Date(endTime).toISOString();
      } else {
        collector.addEvent(errorEvent);
      }
    });

    next();
  };
}

/**
 * Trace context stored on request
 */
interface TraceContext {
  traceId: string;
  correlationId: string;
  behavior: string;
  startTime: number;
  startEvent?: TraceEvent;
}

/**
 * Sanitize request/response body for tracing
 * Removes sensitive fields and limits size
 */
function sanitizeBody(body: unknown): unknown {
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
