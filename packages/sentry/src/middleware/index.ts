// ============================================================================
// ISL Sentry Middleware
// ============================================================================

import * as Sentry from '@sentry/node';
import type { IncomingMessage, ServerResponse } from 'http';

import type { MiddlewareOptions, ISLContext } from '../types';
import { DEFAULT_MIDDLEWARE_OPTIONS } from '../types';
import {
  extractDomainBehavior,
  shouldSkipPath,
  generateExecutionId,
  mergeOptions,
} from '../utils';
import { startBehaviorSpan, ISL_OPERATIONS } from '../performance/spans';
import { addBehaviorBreadcrumb } from '../breadcrumbs/isl';
import { pushContext, popContext, createISLContext } from '../context/isl';

/**
 * Express-compatible request type
 */
interface ExpressRequest extends IncomingMessage {
  path?: string;
  url?: string;
  headers: IncomingMessage['headers'];
  body?: unknown;
  params?: Record<string, string>;
}

/**
 * Express-compatible response type
 */
interface ExpressResponse extends ServerResponse {
  statusCode: number;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

/**
 * Express-compatible next function
 */
type NextFunction = (error?: unknown) => void;

/**
 * Create Express ISL middleware
 */
export function sentryISLMiddleware(
  options: MiddlewareOptions = {}
): (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => void {
  const mergedOptions = mergeOptions(DEFAULT_MIDDLEWARE_OPTIONS, options);

  return (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    const path = req.path || req.url || '/';

    // Skip configured paths
    if (shouldSkipPath(path, mergedOptions.skipPaths)) {
      return next();
    }

    // Extract domain and behavior
    let domain: string | undefined;
    let behavior: string | undefined;

    // Try custom extractor first
    if (options.extractor) {
      const extracted = options.extractor(req);
      if (extracted) {
        domain = extracted.domain;
        behavior = extracted.behavior;
      }
    }

    // Try headers
    if (!domain) {
      domain = req.headers[mergedOptions.domainHeader] as string;
    }
    if (!behavior) {
      behavior = req.headers[mergedOptions.behaviorHeader] as string;
    }

    // Try path extraction
    if (!domain && mergedOptions.extractFromPath && options.pathPattern) {
      const extracted = extractDomainBehavior(options.pathPattern, path);
      if (extracted) {
        domain = extracted.domain;
        behavior = extracted.behavior;
      }
    }

    // If no ISL context found, continue without tracking
    if (!domain) {
      return next();
    }

    const executionId = generateExecutionId();

    // Create ISL context
    const context = createISLContext(domain, behavior, {
      executionId,
      metadata: {
        method: req.method,
        path,
        userAgent: req.headers['user-agent'],
      },
    });

    // Push context
    pushContext(context);

    // Set Sentry tags
    Sentry.setTags({
      'isl.domain': domain,
      'http.method': req.method || 'UNKNOWN',
      'http.path': path,
    });

    if (behavior) {
      Sentry.setTag('isl.behavior', behavior);
    }

    // Add start breadcrumb
    addBehaviorBreadcrumb(domain, behavior || 'request', 'start', {
      method: req.method,
      path,
    });

    // Track request timing
    const startTime = Date.now();

    // Wrap response handling
    const originalEnd = res.end.bind(res);

    res.end = function(...args: Parameters<typeof res.end>): ReturnType<typeof res.end> {
      const duration = Date.now() - startTime;

      // Pop context
      popContext();

      // Add completion breadcrumb
      const success = res.statusCode < 400;
      addBehaviorBreadcrumb(
        domain!,
        behavior || 'request',
        success ? 'end' : 'error',
        {
          method: req.method,
          path,
          statusCode: res.statusCode,
          duration,
        }
      );

      // Set measurement
      Sentry.setMeasurement('isl.request_duration', duration, 'millisecond');

      return originalEnd(...args);
    };

    // Error handling
    res.on('error', (error) => {
      popContext();
      addBehaviorBreadcrumb(domain!, behavior || 'request', 'error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    next();
  };
}

/**
 * Create Koa ISL middleware
 */
export function koaISLMiddleware(options: MiddlewareOptions = {}) {
  const mergedOptions = mergeOptions(DEFAULT_MIDDLEWARE_OPTIONS, options);

  return async (ctx: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
    status: number;
    request: { body?: unknown };
  }, next: () => Promise<void>) => {
    const path = ctx.path;

    // Skip configured paths
    if (shouldSkipPath(path, mergedOptions.skipPaths)) {
      return next();
    }

    // Extract domain and behavior
    let domain: string | undefined;
    let behavior: string | undefined;

    // Try custom extractor
    if (options.extractor) {
      const extracted = options.extractor(ctx);
      if (extracted) {
        domain = extracted.domain;
        behavior = extracted.behavior;
      }
    }

    // Try headers
    if (!domain) {
      domain = ctx.headers[mergedOptions.domainHeader] as string;
    }
    if (!behavior) {
      behavior = ctx.headers[mergedOptions.behaviorHeader] as string;
    }

    // Try path extraction
    if (!domain && mergedOptions.extractFromPath && options.pathPattern) {
      const extracted = extractDomainBehavior(options.pathPattern, path);
      if (extracted) {
        domain = extracted.domain;
        behavior = extracted.behavior;
      }
    }

    if (!domain) {
      return next();
    }

    const executionId = generateExecutionId();
    const context = createISLContext(domain, behavior, { executionId });

    pushContext(context);

    Sentry.setTags({
      'isl.domain': domain,
      'http.method': ctx.method,
      'http.path': path,
    });

    if (behavior) {
      Sentry.setTag('isl.behavior', behavior);
    }

    addBehaviorBreadcrumb(domain, behavior || 'request', 'start', {
      method: ctx.method,
      path,
    });

    const startTime = Date.now();

    try {
      await next();

      const duration = Date.now() - startTime;
      popContext();

      addBehaviorBreadcrumb(
        domain,
        behavior || 'request',
        ctx.status < 400 ? 'end' : 'error',
        {
          method: ctx.method,
          path,
          statusCode: ctx.status,
          duration,
        }
      );

      Sentry.setMeasurement('isl.request_duration', duration, 'millisecond');
    } catch (error) {
      popContext();
      addBehaviorBreadcrumb(domain, behavior || 'request', 'error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };
}

/**
 * Create Fastify ISL plugin
 */
export function fastifyISLPlugin(options: MiddlewareOptions = {}) {
  const mergedOptions = mergeOptions(DEFAULT_MIDDLEWARE_OPTIONS, options);

  return async function(
    fastify: {
      addHook: (
        hook: string,
        handler: (
          request: { url: string; method: string; headers: Record<string, string | undefined> },
          reply: { statusCode: number },
          done?: () => void
        ) => void | Promise<void>
      ) => void;
    }
  ) {
    fastify.addHook(
      'onRequest',
      async (request, _reply) => {
        const path = request.url;

        if (shouldSkipPath(path, mergedOptions.skipPaths)) {
          return;
        }

        let domain: string | undefined;
        let behavior: string | undefined;

        if (options.extractor) {
          const extracted = options.extractor(request);
          if (extracted) {
            domain = extracted.domain;
            behavior = extracted.behavior;
          }
        }

        if (!domain) {
          domain = request.headers[mergedOptions.domainHeader];
        }
        if (!behavior) {
          behavior = request.headers[mergedOptions.behaviorHeader];
        }

        if (!domain && mergedOptions.extractFromPath && options.pathPattern) {
          const extracted = extractDomainBehavior(options.pathPattern, path);
          if (extracted) {
            domain = extracted.domain;
            behavior = extracted.behavior;
          }
        }

        if (domain) {
          const context = createISLContext(domain, behavior);
          pushContext(context);

          Sentry.setTags({
            'isl.domain': domain,
            'http.method': request.method,
            'http.path': path,
          });

          if (behavior) {
            Sentry.setTag('isl.behavior', behavior);
          }

          addBehaviorBreadcrumb(domain, behavior || 'request', 'start', {
            method: request.method,
            path,
          });
        }
      }
    );

    fastify.addHook(
      'onResponse',
      async (request, reply) => {
        popContext();

        const domain = request.headers[mergedOptions.domainHeader];
        const behavior = request.headers[mergedOptions.behaviorHeader];

        if (domain) {
          addBehaviorBreadcrumb(
            domain,
            behavior || 'request',
            reply.statusCode < 400 ? 'end' : 'error',
            {
              method: request.method,
              path: request.url,
              statusCode: reply.statusCode,
            }
          );
        }
      }
    );
  };
}

/**
 * Create a request handler wrapper
 */
export function wrapRequestHandler<TReq, TRes>(
  handler: (req: TReq, res: TRes) => Promise<void>,
  options: {
    getDomain: (req: TReq) => string | undefined;
    getBehavior: (req: TReq) => string | undefined;
  }
): (req: TReq, res: TRes) => Promise<void> {
  return async (req: TReq, res: TRes) => {
    const domain = options.getDomain(req);
    const behavior = options.getBehavior(req);

    if (!domain) {
      return handler(req, res);
    }

    const context = createISLContext(domain, behavior);
    pushContext(context);

    try {
      await handler(req, res);
    } finally {
      popContext();
    }
  };
}

/**
 * Error handler middleware for ISL errors
 */
export function islErrorHandler() {
  return (
    error: Error,
    _req: ExpressRequest,
    _res: ExpressResponse,
    next: NextFunction
  ) => {
    // Capture to Sentry
    Sentry.captureException(error);

    // Pop any remaining context
    popContext();

    next(error);
  };
}
