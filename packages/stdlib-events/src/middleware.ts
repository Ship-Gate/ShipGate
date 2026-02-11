// ============================================================================
// Middleware — intercept / transform / log events flowing through the bus
// ============================================================================

import type { EventMap } from './types.js';

/**
 * Context passed to every middleware.
 * `next()` invokes the next middleware (or the final handler dispatch).
 */
export interface MiddlewareContext<Events extends EventMap> {
  readonly type: keyof Events & string;
  readonly data: Events[keyof Events & string];
  readonly timestamp: Date;
  metadata: Record<string, unknown>;
}

export type NextFn = () => Promise<void>;

export type Middleware<Events extends EventMap> = (
  ctx: MiddlewareContext<Events>,
  next: NextFn,
) => Promise<void> | void;

/**
 * Compose an array of middleware into a single function that chains them.
 * The final `dispatch` callback is called at the end of the chain.
 */
export function composeMiddleware<Events extends EventMap>(
  middlewares: ReadonlyArray<Middleware<Events>>,
  dispatch: (ctx: MiddlewareContext<Events>) => Promise<void>,
): (ctx: MiddlewareContext<Events>) => Promise<void> {
  return (ctx: MiddlewareContext<Events>) => {
    let index = -1;

    function run(i: number): Promise<void> {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;

      const mw = middlewares[i];
      if (!mw) {
        return dispatch(ctx);
      }

      try {
        return Promise.resolve(mw(ctx, () => run(i + 1)));
      } catch (e) {
        return Promise.reject(e);
      }
    }

    return run(0);
  };
}
