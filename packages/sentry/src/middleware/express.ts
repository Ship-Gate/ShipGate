import * as Sentry from '@sentry/node';
import type { ISLRequest, ISLResponse, NextFunction } from '../types';
import { setBehaviorContext } from '../context/isl';
import { addBehaviorBreadcrumb } from '../breadcrumbs/isl';
import { startBehaviorSpan } from '../performance/spans';

/**
 * Express middleware for ISL Sentry integration
 */
export function sentryISLMiddleware() {
  return (req: ISLRequest, res: ISLResponse, next: NextFunction) => {
    const domain = req.headers['x-isl-domain'] as string | undefined;
    const behavior = req.headers['x-isl-behavior'] as string | undefined;
    const traceId = req.headers['x-isl-trace-id'] as string | undefined;

    if (domain && behavior) {
      // Set ISL tags
      Sentry.setTags({
        'isl.domain': domain,
        'isl.behavior': behavior,
      });

      if (traceId) {
        Sentry.setTag('isl.trace_id', traceId);
      }

      // Set ISL context
      setBehaviorContext(domain, behavior);

      // Add request breadcrumb
      addBehaviorBreadcrumb(
        domain,
        behavior,
        'start',
        {
          method: req.method ?? 'UNKNOWN',
          url: req.url ?? req.path ?? 'unknown',
        }
      );

      // Wrap request handling with behavior tracking
      startBehaviorSpan({ domain, behavior }, () => {
        return new Promise<void>((resolve, reject) => {
          res.on('finish', () => {
            // Add response breadcrumb
            addBehaviorBreadcrumb(
              domain,
              behavior,
              res.statusCode >= 400 ? 'error' : 'end',
              {
                method: req.method ?? 'UNKNOWN',
                url: req.url ?? req.path ?? 'unknown',
                statusCode: res.statusCode,
              }
            );

            if (res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}`));
            } else {
              resolve();
            }
          });

          next();
        });
      }).catch(() => {
        // Errors are already handled by Sentry
      });
    } else {
      next();
    }
  };
}

/**
 * Express error handler for ISL errors
 */
export function sentryISLErrorHandler() {
  return (
    error: Error,
    req: ISLRequest,
    _res: ISLResponse,
    next: NextFunction
  ) => {
    const domain = req.headers['x-isl-domain'] as string | undefined;
    const behavior = req.headers['x-isl-behavior'] as string | undefined;

    // Add ISL context to the error
    Sentry.withScope((scope: Sentry.Scope) => {
      if (domain) {
        scope.setTag('isl.domain', domain);
      }
      if (behavior) {
        scope.setTag('isl.behavior', behavior);
      }

      // Identify ISL-specific errors
      if (error.name === 'PreconditionError') {
        scope.setTag('isl.check_type', 'precondition');
        scope.setLevel('warning');
      } else if (error.name === 'PostconditionError') {
        scope.setTag('isl.check_type', 'postcondition');
        scope.setLevel('error');
      } else if (error.name === 'InvariantError') {
        scope.setTag('isl.check_type', 'invariant');
        scope.setLevel('fatal');
      }

      Sentry.captureException(error);
    });

    next(error);
  };
}

/**
 * Create middleware with custom options
 */
export function createISLMiddleware(options?: {
  trackAllRequests?: boolean;
  captureResponseBody?: boolean;
  ignoreRoutes?: string[];
}) {
  const { trackAllRequests = false, ignoreRoutes = [] } = options ?? {};

  return (req: ISLRequest, res: ISLResponse, next: NextFunction) => {
    const path = req.path ?? req.url ?? '';

    // Check if route should be ignored
    if (ignoreRoutes.some((route) => path.startsWith(route))) {
      return next();
    }

    const domain = req.headers['x-isl-domain'] as string | undefined;
    const behavior = req.headers['x-isl-behavior'] as string | undefined;

    // If no ISL headers and not tracking all requests, skip
    if (!domain && !behavior && !trackAllRequests) {
      return next();
    }

    // Apply ISL middleware logic
    return sentryISLMiddleware()(req, res, next);
  };
}
