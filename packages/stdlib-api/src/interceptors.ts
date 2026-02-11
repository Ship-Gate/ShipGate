// ============================================================================
// ISL Standard Library - Interceptor Chain
// @isl-lang/stdlib-api
// ============================================================================

import type { Result } from '@isl-lang/stdlib-core';
import type { Middleware, MiddlewareContext, NextFn, ApiResponse } from './types.js';
import type { ApiError } from './errors.js';

/**
 * Build a composed middleware chain. Middleware executes in order (first added = outermost).
 * The final handler performs the actual fetch.
 */
export function buildChain(
  middleware: Middleware[],
  finalHandler: NextFn,
): NextFn {
  // Walk backwards so the first middleware wraps the second, etc.
  let next: NextFn = finalHandler;

  for (let i = middleware.length - 1; i >= 0; i--) {
    const mw = middleware[i]!;
    const downstream = next;
    next = (ctx: MiddlewareContext): Promise<Result<ApiResponse, ApiError>> =>
      mw.execute(ctx, downstream);
  }

  return next;
}
