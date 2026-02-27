// ============================================================================
// ISL Standard Library - Timeout Middleware
// @isl-lang/stdlib-api
// ============================================================================

import type { Middleware } from '../types.js';
import { timeoutError } from '../errors.js';

export interface TimeoutOptions {
  timeoutMs: number;
}

/**
 * Timeout middleware. Aborts the request if it exceeds the specified duration.
 * This is separate from the per-request timeout in RequestConfig — it wraps
 * the entire middleware chain below it.
 */
export function timeoutMiddleware(options: TimeoutOptions): Middleware {
  return {
    name: 'timeout',
    async execute(ctx, next) {
      const { timeoutMs } = options;
      const controller = new AbortController();
      const originalSignal = ctx.request.signal;

      // If the original request already has a signal, combine them
      if (originalSignal) {
        if (originalSignal.aborted) {
          controller.abort();
        } else {
          originalSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
      }

      ctx.request = { ...ctx.request, signal: controller.signal };

      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const result = await next(ctx);
        clearTimeout(timer);

        // If we aborted due to our timeout (not user abort), convert to TimeoutError
        if (!result.ok && result.error.kind === 'Abort' && !originalSignal?.aborted) {
          return { ok: false, error: timeoutError(ctx.request.url, timeoutMs) };
        }

        return result;
      } catch (err) {
        clearTimeout(timer);
        if (controller.signal.aborted && !originalSignal?.aborted) {
          return { ok: false, error: timeoutError(ctx.request.url, timeoutMs) };
        }
        throw err;
      }
    },
  };
}
