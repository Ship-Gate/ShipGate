import { trace, context, SpanStatusCode, SpanKind, Attributes } from '@opentelemetry/api';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ISLSemanticAttributes } from '../semantic-attributes.js';
import {
  ISL_HEADERS,
  parseISLHeaders,
  ISLContextData,
  setISLContext,
  getISLContext,
} from '../propagation/isl-context.js';
import { BehaviorSpan } from '../spans/behavior.js';
import { VerificationSpan } from '../spans/verification.js';

/**
 * Express instrumentation options
 */
export interface ExpressInstrumentationOptions {
  /**
   * Default domain to use if not specified in headers
   */
  defaultDomain?: string;

  /**
   * Function to extract domain from request
   */
  domainExtractor?: (req: Request) => string | undefined;

  /**
   * Function to extract behavior from request
   */
  behaviorExtractor?: (req: Request) => string | undefined;

  /**
   * Function to extract actor from request
   */
  actorExtractor?: (req: Request) => string | undefined;

  /**
   * Additional attributes to add to spans
   */
  additionalAttributes?: (req: Request) => Attributes;

  /**
   * Filter requests to skip instrumentation
   */
  ignoreFilter?: (req: Request) => boolean;

  /**
   * Record request body (be careful with sensitive data)
   */
  recordRequestBody?: boolean;

  /**
   * Record response body (be careful with sensitive data)
   */
  recordResponseBody?: boolean;
}

/**
 * ISL Express middleware for automatic tracing
 */
export function islExpressMiddleware(
  options: ExpressInstrumentationOptions = {}
): RequestHandler {
  const tracer = trace.getTracer('isl-express', '1.0.0');

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if we should skip this request
    if (options.ignoreFilter?.(req)) {
      next();
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
      `${req.method} ${req.path}`;

    const actor = islContext?.actor ?? options.actorExtractor?.(req);

    // Build attributes
    const attributes: Attributes = {
      [ISLSemanticAttributes.ISL_DOMAIN_NAME]: domain,
      [ISLSemanticAttributes.ISL_BEHAVIOR_NAME]: behavior,
      'http.method': req.method,
      'http.url': req.originalUrl || req.url,
      'http.target': req.path,
      'http.host': req.hostname,
      'http.scheme': req.protocol,
      'http.user_agent': req.headers['user-agent'] ?? 'unknown',
      ...(actor && { [ISLSemanticAttributes.ISL_BEHAVIOR_ACTOR]: actor }),
      ...(islContext?.idempotencyKey && {
        [ISLSemanticAttributes.ISL_BEHAVIOR_IDEMPOTENCY_KEY]: islContext.idempotencyKey,
      }),
      ...(islContext?.verificationId && {
        [ISLSemanticAttributes.ISL_VERIFICATION_ID]: islContext.verificationId,
      }),
      ...options.additionalAttributes?.(req),
    };

    // Record request body if enabled
    if (options.recordRequestBody && req.body) {
      try {
        attributes['http.request.body'] = JSON.stringify(req.body).slice(0, 1024);
      } catch {
        // Ignore serialization errors
      }
    }

    // Start the span
    tracer.startActiveSpan(
      `isl.http.${domain}.${behavior}`,
      {
        kind: SpanKind.SERVER,
        attributes,
      },
      (span) => {
        // Set ISL context
        const newISLContext: ISLContextData = {
          domain,
          behavior,
          actor,
          verificationId: islContext?.verificationId ?? span.spanContext().traceId,
          idempotencyKey: islContext?.idempotencyKey,
          trustScore: islContext?.trustScore,
        };

        const ctx = setISLContext(context.active(), newISLContext);

        // Override res.end to capture response
        const originalEnd = res.end.bind(res);
        res.end = function (
          this: Response,
          chunk?: unknown,
          encoding?: BufferEncoding | (() => void),
          callback?: () => void
        ): Response {
          // Set response attributes
          span.setAttribute('http.status_code', res.statusCode);

          // Record response body if enabled
          if (options.recordResponseBody && chunk) {
            try {
              const body =
                typeof chunk === 'string' ? chunk : chunk?.toString?.() ?? '';
              span.setAttribute('http.response.body', body.slice(0, 1024));
            } catch {
              // Ignore serialization errors
            }
          }

          // Set status based on HTTP status code
          if (res.statusCode >= 400) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${res.statusCode}`,
            });
          } else {
            span.setStatus({ code: SpanStatusCode.OK });
          }

          span.end();

          // Handle overloaded parameters
          if (typeof encoding === 'function') {
            return originalEnd(chunk, encoding);
          }
          return originalEnd(chunk, encoding ?? 'utf8', callback);
        } as Response['end'];

        // Handle errors
        res.on('error', (error) => {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          span.recordException(error);
        });

        // Continue with context
        context.with(ctx, () => {
          next();
        });
      }
    );
  };
}

/**
 * Express error handler middleware for tracing
 */
export function islExpressErrorHandler(): (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return (
    err: Error,
    _req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    const span = trace.getActiveSpan();
    if (span) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message,
      });
      span.recordException(err);
    }
    next(err);
  };
}

/**
 * Route-specific behavior tracing middleware
 */
export function traceBehavior(
  domain: string,
  behavior: string,
  options?: Partial<ExpressInstrumentationOptions>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const behaviorSpan = new BehaviorSpan({
      domain,
      behavior,
      actor: options?.actorExtractor?.(req),
      attributes: {
        'http.method': req.method,
        'http.url': req.originalUrl || req.url,
        ...options?.additionalAttributes?.(req),
      },
    });

    // Override response to capture completion
    const originalEnd = res.end.bind(res);
    res.end = function (
      this: Response,
      chunk?: unknown,
      encoding?: BufferEncoding | (() => void),
      callback?: () => void
    ): Response {
      if (res.statusCode >= 400) {
        behaviorSpan.failure(new Error(`HTTP ${res.statusCode}`));
      } else {
        behaviorSpan.success();
      }

      if (typeof encoding === 'function') {
        return originalEnd(chunk, encoding);
      }
      return originalEnd(chunk, encoding ?? 'utf8', callback);
    } as Response['end'];

    context.with(
      trace.setSpan(context.active(), behaviorSpan.getSpan()),
      () => next()
    );
  };
}

/**
 * Route-specific verification tracing middleware
 */
export function traceVerification(
  domain: string,
  behavior: string
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const verificationSpan = new VerificationSpan({
      domain,
      behavior,
    });

    // Attach span to request for later access
    (req as Request & { islVerificationSpan?: VerificationSpan }).islVerificationSpan =
      verificationSpan;

    // Override response to capture completion
    const originalEnd = res.end.bind(res);
    res.end = function (
      this: Response,
      chunk?: unknown,
      encoding?: BufferEncoding | (() => void),
      callback?: () => void
    ): Response {
      verificationSpan.complete();

      if (typeof encoding === 'function') {
        return originalEnd(chunk, encoding);
      }
      return originalEnd(chunk, encoding ?? 'utf8', callback);
    } as Response['end'];

    context.with(
      trace.setSpan(context.active(), verificationSpan.getSpan()),
      () => next()
    );
  };
}

/**
 * Create ISL headers for outgoing requests
 */
export function createISLRequestHeaders(_req: Request): Record<string, string> {
  const islContext = getISLContext();
  if (!islContext) return {};

  const headers: Record<string, string> = {
    [ISL_HEADERS.DOMAIN]: islContext.domain,
  };

  if (islContext.behavior) {
    headers[ISL_HEADERS.BEHAVIOR] = islContext.behavior;
  }
  if (islContext.verificationId) {
    headers[ISL_HEADERS.VERIFICATION_ID] = islContext.verificationId;
  }
  if (islContext.actor) {
    headers[ISL_HEADERS.ACTOR] = islContext.actor;
  }
  if (islContext.idempotencyKey) {
    headers[ISL_HEADERS.IDEMPOTENCY_KEY] = islContext.idempotencyKey;
  }

  return headers;
}
