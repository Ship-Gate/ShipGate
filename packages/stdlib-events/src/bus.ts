// ============================================================================
// EventBus — strongly-typed pub/sub with middleware support
// ============================================================================

import type { EventMap } from './types.js';
import type { Handler, Unsubscribe } from './emitter.js';
import { EventEmitter } from './emitter.js';
import type { Middleware, MiddlewareContext } from './middleware.js';
import { composeMiddleware } from './middleware.js';

export interface EventBus<Events extends EventMap> {
  on<K extends keyof Events & string>(
    type: K,
    handler: Handler<Events[K]>,
  ): Unsubscribe;

  off<K extends keyof Events & string>(
    type: K,
    handler: Handler<Events[K]>,
  ): void;

  emit<K extends keyof Events & string>(
    type: K,
    data: Events[K],
  ): Promise<void>;

  use(middleware: Middleware<Events>): void;

  listenerCount<K extends keyof Events & string>(type: K): number;
}

/**
 * Create a strongly-typed event bus with optional middleware.
 *
 * Usage:
 * ```ts
 * type MyEvents = { UserCreated: { id: string }; UserDeleted: { id: string } };
 * const bus = createEventBus<MyEvents>();
 * bus.on('UserCreated', (data) => console.log(data.id));
 * await bus.emit('UserCreated', { id: '123' });
 * ```
 */
export function createEventBus<Events extends EventMap>(): EventBus<Events> {
  const emitter = new EventEmitter<Events>();
  const middlewares: Middleware<Events>[] = [];

  function use(middleware: Middleware<Events>): void {
    middlewares.push(middleware);
  }

  async function emit<K extends keyof Events & string>(
    type: K,
    data: Events[K],
  ): Promise<void> {
    const ctx: MiddlewareContext<Events> = {
      type,
      data: data as Events[keyof Events & string],
      timestamp: new Date(),
      metadata: {},
    };

    const dispatch = async (_ctx: MiddlewareContext<Events>) => {
      await emitter.emit(
        _ctx.type as K,
        _ctx.data as Events[K],
      );
    };

    const composed = composeMiddleware(middlewares, dispatch);
    await composed(ctx);
  }

  return {
    on: <K extends keyof Events & string>(type: K, handler: Handler<Events[K]>) =>
      emitter.on(type, handler),
    off: <K extends keyof Events & string>(type: K, handler: Handler<Events[K]>) =>
      emitter.off(type, handler),
    emit,
    use,
    listenerCount: <K extends keyof Events & string>(type: K) =>
      emitter.listenerCount(type),
  };
}
