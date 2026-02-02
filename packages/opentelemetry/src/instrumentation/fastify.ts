import {
  trace,
  context,
  SpanStatusCode,
  SpanKind,
  Attributes,
  Context,
} from '@opentelemetry/api';
import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginCallback,
  HookHandlerDoneFunction,
} from 'fastify';
import { ISLSemanticAttributes } from '../semantic-attributes';
import {
  ISL_HEADERS,
  parseISLHeaders,
  ISLContextData,
  setISLContext,
} from '../propagation/isl-context';
import { BehaviorSpan } from '../spans/behavior';
import { VerificationSpan } from '../spans/verification';

/**
 * Fastify instrumentation options
 */
export interface FastifyInstrumentationOptions {
  /**
   * Default domain to use if not specified in headers
   */
  defaultDomain?: string;

  /**
   * Function to extract domain from request
   */
  domainExtractor?: (req: FastifyRequest) => string | undefined;

  /**
   * Function to extract behavior from request
   */
  behaviorExtractor?: (req: FastifyRequest) => string | undefined;

  /**
   * Function to extract actor from request
   */
  actorExtractor?: (req: FastifyRequest) => string | undefined;

  /**
   * Additional attributes to add to spans
   */
  additionalAttributes?: (req: FastifyRequest) => Attributes;

  /**
   * Filter requests to skip instrumentation
   */
  ignoreFilter?: (req: FastifyRequest) => boolean;

  /**
   * Record request body
   */
  recordRequestBody?: boolean;

  /**
   * Record response body
   */
  recordResponseBody?: boolean;
}

// Augment FastifyRequest with ISL context
declare module 'fastify' {
  interface FastifyRequest {
    islContext?: ISLContextData;
    islBehaviorSpan?: BehaviorSpan;
    islVerificationSpan?: VerificationSpan;
    islSpanContext?: Context;
  }
}

/**
 * ISL Fastify plugin for automatic tracing
 */
export const islFastifyPlugin: FastifyPluginCallback<FastifyInstrumentationOptions> = (
  fastify: FastifyInstance,
  options: FastifyInstrumentationOptions,
  done: HookHandlerDoneFunction
) => {
  const tracer = trace.getTracer('isl-fastify', '1.0.0');

  // Request hook - start span
  fastify.addHook(
    'onRequest',
    async (req: FastifyRequest, _reply: FastifyReply) => {
      // Check if we should skip this request
      if (options.ignoreFilter?.(req)) {
        return;
      }

      // Extract ISL context from headers
      const headers: Record<string, string | undefined> = {};
      for (const key of Object.values(ISL_HEADERS)) {
        headers[key] = req.headers[key] as string | undefined;
      }

      const islContext = parseISLHeaders(headers as Record<string, string | undefined>);

      // Determine domain and behavior
      const domain =
        islContext?.domain ??
        options.domainExtractor?.(req) ??
        options.defaultDomain ??
        'unknown';

      const behavior =
        islContext?.behavior ??
        options.behaviorExtractor?.(req) ??
        `${req.method} ${req.url}`;

      const actor = islContext?.actor ?? options.actorExtractor?.(req);

      // Build attributes
      const attributes: Attributes = {
        [ISLSemanticAttributes.ISL_DOMAIN_NAME]: domain,
        [ISLSemanticAttributes.ISL_BEHAVIOR_NAME]: behavior,
        'http.method': req.method,
        'http.url': req.url,
        'http.host': req.hostname,
        'http.user_agent': req.headers['user-agent'] ?? 'unknown',
        ...(actor && { [ISLSemanticAttributes.ISL_BEHAVIOR_ACTOR]: actor }),
        ...(islContext?.idempotencyKey && {
          [ISLSemanticAttributes.ISL_BEHAVIOR_IDEMPOTENCY_KEY]:
            islContext.idempotencyKey,
        }),
        ...(islContext?.verificationId && {
          [ISLSemanticAttributes.ISL_VERIFICATION_ID]: islContext.verificationId,
        }),
        ...options.additionalAttributes?.(req),
      };

      // Start span
      const span = tracer.startSpan(`isl.http.${domain}.${behavior}`, {
        kind: SpanKind.SERVER,
        attributes,
      });

      // Create ISL context
      const newISLContext: ISLContextData = {
        domain,
        behavior,
        actor,
        verificationId: islContext?.verificationId ?? span.spanContext().traceId,
        idempotencyKey: islContext?.idempotencyKey,
        trustScore: islContext?.trustScore,
      };

      // Store on request for later access
      req.islContext = newISLContext;
      req.islSpanContext = trace.setSpan(
        setISLContext(context.active(), newISLContext),
        span
      );
    }
  );

  // Pre-serialization hook - capture request body
  if (options.recordRequestBody) {
    fastify.addHook(
      'preHandler',
      async (req: FastifyRequest, _reply: FastifyReply) => {
        if (req.islSpanContext && req.body) {
          const span = trace.getSpan(req.islSpanContext);
          if (span) {
            try {
              span.setAttribute(
                'http.request.body',
                JSON.stringify(req.body).slice(0, 1024)
              );
            } catch {
              // Ignore serialization errors
            }
          }
        }
      }
    );
  }

  // Response hook - complete span
  fastify.addHook(
    'onResponse',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.islSpanContext) return;

      const span = trace.getSpan(req.islSpanContext);
      if (!span) return;

      span.setAttribute('http.status_code', reply.statusCode);

      if (reply.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${reply.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
    }
  );

  // Error hook
  fastify.addHook(
    'onError',
    async (req: FastifyRequest, _reply: FastifyReply, error: Error) => {
      if (!req.islSpanContext) return;

      const span = trace.getSpan(req.islSpanContext);
      if (!span) return;

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
    }
  );

  done();
};

/**
 * Register ISL Fastify plugin
 */
export function registerISLPlugin(
  fastify: FastifyInstance,
  options?: FastifyInstrumentationOptions
): void {
  fastify.register(islFastifyPlugin, options ?? {});
}

/**
 * Route decorator for behavior tracing
 */
export function createBehaviorHook(
  domain: string,
  behavior: string
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const behaviorSpan = new BehaviorSpan({
      domain,
      behavior,
      actor: req.islContext?.actor,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
      },
    });

    req.islBehaviorSpan = behaviorSpan;
    req.islSpanContext = trace.setSpan(context.active(), behaviorSpan.getSpan());
  };
}

/**
 * Route decorator for verification tracing
 */
export function createVerificationHook(
  domain: string,
  behavior: string
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const verificationSpan = new VerificationSpan({
      domain,
      behavior,
    });

    req.islVerificationSpan = verificationSpan;
    req.islSpanContext = trace.setSpan(context.active(), verificationSpan.getSpan());
  };
}

/**
 * OnSend hook to complete behavior span
 */
export function completeBehaviorOnSend(
  req: FastifyRequest,
  reply: FastifyReply
): void {
  if (req.islBehaviorSpan) {
    if (reply.statusCode >= 400) {
      req.islBehaviorSpan.failure(new Error(`HTTP ${reply.statusCode}`));
    } else {
      req.islBehaviorSpan.success();
    }
  }
}

/**
 * OnSend hook to complete verification span
 */
export function completeVerificationOnSend(
  req: FastifyRequest,
  _reply: FastifyReply
): void {
  if (req.islVerificationSpan) {
    req.islVerificationSpan.complete();
  }
}

/**
 * Get ISL context from request
 */
export function getISLContextFromRequest(
  req: FastifyRequest
): ISLContextData | undefined {
  return req.islContext;
}

/**
 * Run function within request's ISL context
 */
export function runInRequestContext<T>(req: FastifyRequest, fn: () => T): T {
  if (req.islSpanContext) {
    return context.with(req.islSpanContext, fn);
  }
  return fn();
}
