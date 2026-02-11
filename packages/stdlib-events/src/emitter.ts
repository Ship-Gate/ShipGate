// ============================================================================
// EventEmitter — lightweight typed emitter supporting sync + async handlers
// ============================================================================

import type { EventMap } from './types.js';

export type SyncHandler<T = unknown> = (data: T) => void;
export type AsyncHandler<T = unknown> = (data: T) => Promise<void>;
export type Handler<T = unknown> = SyncHandler<T> | AsyncHandler<T>;

export interface Unsubscribe {
  (): void;
}

/**
 * A strongly-typed event emitter.
 *
 * - Handlers are invoked in registration order.
 * - Async handlers are awaited sequentially (guarantees ordering).
 * - `emit` always returns a Promise so callers can await all handlers.
 */
export class EventEmitter<Events extends EventMap> {
  private _handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events & string>(
    type: K,
    handler: Handler<Events[K]>,
  ): Unsubscribe {
    let set = this._handlers.get(type);
    if (!set) {
      set = new Set();
      this._handlers.set(type, set);
    }
    set.add(handler as Handler<never>);

    return () => {
      set!.delete(handler as Handler<never>);
      if (set!.size === 0) {
        this._handlers.delete(type);
      }
    };
  }

  off<K extends keyof Events & string>(
    type: K,
    handler: Handler<Events[K]>,
  ): void {
    const set = this._handlers.get(type);
    if (set) {
      set.delete(handler as Handler<never>);
      if (set.size === 0) {
        this._handlers.delete(type);
      }
    }
  }

  async emit<K extends keyof Events & string>(
    type: K,
    data: Events[K],
  ): Promise<void> {
    const set = this._handlers.get(type);
    if (!set) return;

    // Iterate a snapshot so mutations during emit are safe
    const handlers = [...set];
    for (const handler of handlers) {
      await (handler as Handler<Events[K]>)(data);
    }
  }

  listenerCount<K extends keyof Events & string>(type: K): number {
    return this._handlers.get(type)?.size ?? 0;
  }

  removeAllListeners<K extends keyof Events & string>(type?: K): void {
    if (type) {
      this._handlers.delete(type);
    } else {
      this._handlers.clear();
    }
  }
}
