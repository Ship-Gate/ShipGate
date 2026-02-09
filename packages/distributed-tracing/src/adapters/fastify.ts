/**
 * Fastify plugin for distributed tracing with correlation IDs
 * 
 * Automatically:
 * - Extracts correlation IDs from incoming requests
 * - Creates spans for each request
 * - Propagates correlation IDs in logs
 * - Injects correlation IDs into outgoing responses
 */

import { trace, context, SpanStatusCode, SpanKind, type Span } from '@opentelemetry/api';
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginOptions } from 'fastify';
import {
  extractCorrelationFromHeaders,
  getCorrelationContext,
  getCorrelationMetadata,
  CORRELATION_HEADERS,
} from '../correlation.js';

/**
 * Fastify tracing plugin options
 */
export interface FastifyTracingOptions extends FastifyPluginOptions {
  /**
   * Service name for traces
   */
  serviceName?: string;

  /**
   * Service version
   */
  serviceVersion?: string;

  /**
   * Whether to include request body in spans
   */
  recordRequestBody?: boolean;

  /**
   * Whether to include response body in spans
   */
  recordResponseBody?: boolean;

  /**
   * Paths to ignore (e.g., health checks)
   */
  ignorePaths?: string[];

  /**
   * Custom function to determine if request should be traced
   */
  shouldTrace?: (request: FastifyRequest) => boolean;

  /**
   * Custom attributes to add to spans
   */
  getAttributes?: (request: FastifyRequest) => Record<string, string | number | boolean>;
}

/**
 * Augment FastifyRequest with correlation context
 */
declare module 'fastify' {
  interface FastifyRequest {
    correlationContext?: {
      traceId: string;
      spanId: string;
      correlationId: string;
    };
    tracingSpan?: import('@opentelemetry/api').Span;
    tracingContext?: ReturnType<typeof context.active>;
  }
}

/**
 * Fastify plugin for distributed tracing
 * 
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { fastifyTracingPlugin } from '@isl-lang/distributed-tracing/adapters/fastify';
 * 
 * const fastify = Fastify();
 * 
 * await fastify.register(fastifyTracingPlugin, {
 *   serviceName: 'my-service',
 *   serviceVersion: '1.0.0',
 * });
 * ```
 */
export async function fastifyTracingPlugin(
  fastify: FastifyInstance,
  options: FastifyTracingOptions,
  done: () => void
): Promise<void> {
  const {
    serviceName = 'fastify-service',
    serviceVersion = '1.0.0',
    recordRequestBody = false,
    recordResponseBody = false,
    ignorePaths = ['/health', '/metrics'],
    shouldTrace,
    getAttributes,
  } = options;

  const tracer = trace.getTracer(serviceName, serviceVersion);

  // Extract correlation context and start span on request
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Check if we should trace this request
    if (shouldTrace && !shouldTrace(request)) {
      return;
    }

    // Check ignore paths
    if (ignorePaths.some((path) => request.url.startsWith(path))) {
      return;
    }

    // Extract correlation context from headers
    const correlationCtx = extractCorrelationFromHeaders(request.headers as Record<string, string | string[] | undefined>);

    // Start span
    const span: Span = tracer.startSpan(`${request.method} ${request.url}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'http.route': request.routerPath || request.url,
        'http.host': request.hostname,
        'http.scheme': request.protocol,
        'http.user_agent': (request.headers['user-agent'] as string) || 'unknown',
        ...(correlationCtx && {
          'trace.correlation_id': correlationCtx.correlationId,
          'trace.trace_id': correlationCtx.traceId,
          'trace.span_id': correlationCtx.spanId,
        }),
        ...getAttributes?.(request),
      },
    });

    // Store correlation context on request
    if (correlationCtx) {
      request.correlationContext = {
        traceId: correlationCtx.traceId,
        spanId: correlationCtx.spanId,
        correlationId: correlationCtx.correlationId,
      };
    }

    // Set active context and store on request
    const activeContext = trace.setSpan(context.active(), span);
    request.tracingSpan = span;
    request.tracingContext = activeContext;
  });

  // Record request body if enabled
  if (recordRequestBody) {
    fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
      const span = request.tracingSpan;
      if (span && request.body) {
        try {
          const bodyStr = JSON.stringify(request.body);
          span.setAttribute('http.request.body', bodyStr.slice(0, 1024)); // Limit size
        } catch {
          // Ignore serialization errors
        }
      }
    });
  }

  // Complete span on response
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const span = request.tracingSpan;
    if (!span) return;

    // Set status code
    span.setAttribute('http.status_code', reply.statusCode);

    // Record response body if enabled (FastifyReply type doesn't include payload; it exists at runtime)
    const replyWithPayload = reply as FastifyReply & { payload?: unknown };
    const replyPayload = replyWithPayload.payload;
    if (recordResponseBody && replyPayload !== undefined) {
      try {
        const payloadStr = typeof replyPayload === 'string' ? replyPayload : JSON.stringify(replyPayload);
        span.setAttribute('http.response.body', payloadStr.slice(0, 1024)); // Limit size
      } catch {
        // Ignore serialization errors
      }
    }

    // Set span status
    if (reply.statusCode >= 500) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${reply.statusCode}`,
      });
    } else if (reply.statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${reply.statusCode}`,
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    // Inject correlation headers into response
    const correlationCtx = getCorrelationContext();
    if (correlationCtx) {
      reply.header(CORRELATION_HEADERS.CORRELATION_ID, correlationCtx.correlationId);
      reply.header(CORRELATION_HEADERS.TRACE_ID, correlationCtx.traceId);
      reply.header(CORRELATION_HEADERS.SPAN_ID, correlationCtx.spanId);
    }

    span.end();
  });

  // Handle errors
  fastify.addHook('onError', async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    const span = request.tracingSpan;
    if (!span) return;

    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    span.setAttribute('error', true);
    span.setAttribute('error.message', error.message);
    span.setAttribute('error.name', error.name);
  });

  // Decorate fastify instance with correlation utilities
  fastify.decorate('getCorrelationId', () => {
    return getCorrelationContext()?.correlationId ?? null;
  });

  fastify.decorate('getCorrelationMetadata', () => {
    return getCorrelationMetadata();
  });

  done();
}

// Type augmentation for decorators
declare module 'fastify' {
  interface FastifyInstance {
    getCorrelationId(): string | null;
    getCorrelationMetadata(): Record<string, string> | null;
  }
}
