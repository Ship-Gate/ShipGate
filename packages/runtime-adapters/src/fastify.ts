/**
 * Fastify Adapter for Verification
 * 
 * Intercepts requests/responses and captures traces for temporal/coverage analysis.
 * 
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { fastifyVerificationAdapter } from '@isl-lang/runtime-adapters/fastify';
 * 
 * const fastify = Fastify();
 * 
 * // One line of adapter wiring
 * await fastify.register(fastifyVerificationAdapter, {
 *   domain: 'Auth',
 *   behaviorExtractor: (req) => `${req.method} ${req.url}`,
 * });
 * ```
 */

import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginOptions,
  HookHandlerDoneFunction,
} from 'fastify';
import type { Trace, TraceEvent } from '@isl-lang/trace-format';
import { getCollector } from './collector.js';
import { randomUUID } from 'node:crypto';

/**
 * Options for Fastify verification adapter
 */
export interface FastifyVerificationOptions extends FastifyPluginOptions {
  /**
   * Domain name for traces (e.g., 'Auth', 'Payments')
   */
  domain: string;

  /**
   * Extract behavior name from request
   * Default: `${req.method} ${req.url}`
   */
  behaviorExtractor?: (req: FastifyRequest) => string;

  /**
   * Extract correlation ID from request headers
   * Default: checks 'x-correlation-id' or generates new UUID
   */
  correlationIdExtractor?: (req: FastifyRequest) => string;

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
  shouldTrace?: (req: FastifyRequest) => boolean;
}

/**
 * Fastify plugin for verification tracing
 */
export async function fastifyVerificationAdapter(
  fastify: FastifyInstance,
  options: FastifyVerificationOptions,
  done: HookHandlerDoneFunction
): Promise<void> {
  const {
    domain,
    behaviorExtractor = (req) => `${req.method} ${req.url}`,
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

  // Store trace context on request
  interface TraceContext {
    traceId: string;
    correlationId: string;
    behavior: string;
    startTime: number;
    startEvent?: TraceEvent;
  }

  // Request hook - start trace
  fastify.addHook('onRequest', async (req: FastifyRequest, _reply: FastifyReply) => {
    // Check if we should trace this request
    if (shouldTrace && !shouldTrace(req)) {
      return;
    }

    // Check ignore paths
    if (ignorePaths.some((path) => req.url.startsWith(path))) {
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
        url: req.url,
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
    (req as FastifyRequest & { __traceContext?: TraceContext }).__traceContext = {
      traceId,
      correlationId,
      behavior,
      startTime,
      startEvent,
    };

    // Create initial trace
    const trace: Trace = {
      id: traceId,
      name: `${behavior} - ${req.method} ${req.url}`,
      domain,
      startTime: new Date(startTime).toISOString(),
      correlationId,
      events: [startEvent],
    };

    collector.addTrace(trace);
  });

  // Response hook - complete trace
  fastify.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const context = (req as FastifyRequest & { __traceContext?: TraceContext }).__traceContext;
    if (!context) return;

    const endTime = Date.now();
    const duration = endTime - context.startTime;

    // Create handler_return event
    const endEvent: TraceEvent = {
      time: new Date().toISOString(),
      kind: reply.statusCode >= 400 ? 'handler_error' : 'handler_return',
      correlationId: context.correlationId,
      handler: context.behavior,
      inputs: {},
      outputs: reply.statusCode >= 400
        ? {
            error: {
              name: `HTTP ${reply.statusCode}`,
              message: `Request failed with status ${reply.statusCode}`,
              code: String(reply.statusCode),
            },
          }
        : {
            duration,
            statusCode: reply.statusCode,
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
  });

  // Error hook
  fastify.addHook('onError', async (req: FastifyRequest, _reply: FastifyReply, error: Error) => {
    const context = (req as FastifyRequest & { __traceContext?: TraceContext }).__traceContext;
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

  done(undefined);
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
