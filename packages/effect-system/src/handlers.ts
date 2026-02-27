/**
 * Effect Handlers
 * 
 * Utilities for creating and composing effect handlers.
 */

import type {
  Effect,
  Handler,
  FullHandler,
  ConsoleEffect,
  TimeEffect,
  RandomEffect,
  StateEffect,
  ErrorEffect,
} from './types';
import {
  type EffectRuntimeState,
  registerEffectHandler,
} from './runtime';

// ============================================
// Handler Creation
// ============================================

/**
 * Create a full handler with return clause
 */
export function handler<E extends Effect, A, R>(
  returnFn: (value: A) => R,
  handlers: Handler<E, R>
): FullHandler<E, A, R> {
  return {
    return: returnFn,
    handlers,
  };
}

/**
 * Create a simple handler that passes through the return value
 */
export function simpleHandler<E extends Effect, A>(
  handlers: Handler<E, A>
): FullHandler<E, A, A> {
  return {
    return: (value: A) => value,
    handlers,
  };
}

// ============================================
// Default Handler Implementations
// ============================================

/**
 * Register console effect handlers
 */
export function registerConsoleHandlers(runtime: EffectRuntimeState): void {
  registerEffectHandler<ConsoleEffect, void>(
    runtime,
    'console.log',
    (payload, resume) => {
      const msg = (payload as { message: string }).message;
      // Using structured logging instead of console.log for production
      process.stdout.write(`[LOG] ${msg}\n`);
      return resume(undefined);
    }
  );

  registerEffectHandler<ConsoleEffect, void>(
    runtime,
    'console.error',
    (payload, resume) => {
      const msg = (payload as { message: string }).message;
      process.stderr.write(`[ERROR] ${msg}\n`);
      return resume(undefined);
    }
  );

  registerEffectHandler<ConsoleEffect, string>(
    runtime,
    'console.read',
    (_payload, resume) => {
      // In production, this would read from stdin
      return resume('');
    }
  );
}

/**
 * Register time effect handlers
 */
export function registerTimeHandlers(runtime: EffectRuntimeState): void {
  registerEffectHandler<TimeEffect, number>(
    runtime,
    'time.now',
    (_payload, resume) => {
      return resume(Date.now());
    }
  );

  registerEffectHandler<TimeEffect, void>(
    runtime,
    'time.sleep',
    (payload, resume) => {
      const ms = (payload as { ms: number }).ms;
      setTimeout(() => resume(undefined), ms);
      return undefined as unknown as void;
    }
  );

  registerEffectHandler<TimeEffect, unknown>(
    runtime,
    'time.timeout',
    (payload, resume) => {
      const { ms, action } = payload as { ms: number; action: () => unknown };
      setTimeout(() => {
        resume(action());
      }, ms);
      return undefined;
    }
  );
}

/**
 * Register random effect handlers
 */
export function registerRandomHandlers(runtime: EffectRuntimeState): void {
  registerEffectHandler<RandomEffect, number>(
    runtime,
    'random.int',
    (payload, resume) => {
      const { min, max } = payload as { min: number; max: number };
      return resume(Math.floor(Math.random() * (max - min + 1)) + min);
    }
  );

  registerEffectHandler<RandomEffect, number>(
    runtime,
    'random.float',
    (_payload, resume) => {
      return resume(Math.random());
    }
  );

  registerEffectHandler<RandomEffect, string>(
    runtime,
    'random.uuid',
    (_payload, resume) => {
      return resume(crypto.randomUUID());
    }
  );
}

/**
 * Create a state handler with initial value
 */
export function createStateHandler<S>(initialState: S): {
  handler: FullHandler<StateEffect<S>, unknown, unknown>;
  getState: () => S;
} {
  let state = initialState;

  return {
    handler: {
      return: (value) => value,
      handlers: {
        'state.get': (_payload, resume) => {
          resume(state);
        },
        'state.set': (payload, resume) => {
          state = (payload as { value: S }).value;
          resume(undefined);
        },
        'state.modify': (payload, resume) => {
          const fn = (payload as { fn: (s: S) => S }).fn;
          state = fn(state);
          resume(state);
        },
      },
    } as FullHandler<StateEffect<S>, unknown, unknown>,
    getState: () => state,
  };
}

/**
 * Create an error handler
 */
export function createErrorHandler<R>(
  onError: (error: Error) => R
): FullHandler<ErrorEffect, R, R> {
  return {
    return: (value) => value,
    handlers: {
      'error.throw': (payload, _resume) => {
        const error = (payload as { error: Error }).error;
        return onError(error);
      },
      'error.catch': (payload, resume) => {
        const handler = (payload as { handler: (e: Error) => unknown }).handler;
        resume(handler);
      },
    } as Handler<ErrorEffect, R>,
  };
}

// ============================================
// Handler Composition
// ============================================

/**
 * Compose two handlers
 */
export function compose<E1 extends Effect, E2 extends Effect, A, R1, R2>(
  h1: FullHandler<E1, A, R1>,
  h2: FullHandler<E2, R1, R2>
): FullHandler<E1 | E2, A, R2> {
  return {
    return: (value: A) => h2.return(h1.return(value)),
    handlers: {
      ...h1.handlers,
      ...h2.handlers,
    } as Handler<E1 | E2, R2>,
  };
}

/**
 * Create a handler that logs all effects
 */
export function withLogging<E extends Effect, A, R>(
  inner: FullHandler<E, A, R>,
  log: (effect: E) => void
): FullHandler<E, A, R> {
  const loggingHandlers: Partial<Handler<E, R>> = {};

  for (const [tag, handler] of Object.entries(inner.handlers) as Array<[string, (payload: unknown, resume: (v: unknown) => R) => R]>) {
    loggingHandlers[tag as keyof Handler<E, R>] = ((payload: unknown, resume: (v: unknown) => R) => {
      log({ _tag: tag, payload } as E);
      return handler(payload, resume);
    }) as Handler<E, R>[keyof Handler<E, R>];
  }

  return {
    return: inner.return,
    handlers: loggingHandlers as Handler<E, R>,
  };
}

/**
 * Create a handler that measures execution time
 */
export function withTiming<E extends Effect, A, R>(
  inner: FullHandler<E, A, R>,
  onTiming: (effect: E, durationMs: number) => void
): FullHandler<E, A, R> {
  const timingHandlers: Partial<Handler<E, R>> = {};

  for (const [tag, handler] of Object.entries(inner.handlers) as Array<[string, (payload: unknown, resume: (v: unknown) => R) => R]>) {
    timingHandlers[tag as keyof Handler<E, R>] = ((payload: unknown, resume: (v: unknown) => R) => {
      const start = Date.now();
      const result = handler(payload, (value) => {
        onTiming({ _tag: tag, payload } as E, Date.now() - start);
        return resume(value);
      });
      return result;
    }) as Handler<E, R>[keyof Handler<E, R>];
  }

  return {
    return: inner.return,
    handlers: timingHandlers as Handler<E, R>,
  };
}

// ============================================
// Test Handlers
// ============================================

/**
 * Create mock handlers for testing
 */
export function mockHandlers<E extends Effect>(
  mocks: Partial<Record<E['_tag'], unknown | ((payload: unknown) => unknown)>>
): Handler<E, unknown> {
  const handlers: Record<string, (payload: unknown, resume: (v: unknown) => unknown) => unknown> = {};

  for (const [tag, mock] of Object.entries(mocks)) {
    if (typeof mock === 'function') {
      handlers[tag] = (payload, resume) => resume((mock as (p: unknown) => unknown)(payload));
    } else {
      handlers[tag] = (_payload, resume) => resume(mock);
    }
  }

  return handlers as Handler<E, unknown>;
}

/**
 * Create a recording handler for testing
 */
export function recordingHandler<E extends Effect, A, R>(
  inner: FullHandler<E, A, R>
): { handler: FullHandler<E, A, R>; getRecords: () => Array<{ tag: string; payload: unknown; result: unknown }> } {
  const records: Array<{ tag: string; payload: unknown; result: unknown }> = [];
  const recordingHandlers: Partial<Handler<E, R>> = {};

  for (const [tag, handler] of Object.entries(inner.handlers) as Array<[string, (payload: unknown, resume: (v: unknown) => R) => R]>) {
    recordingHandlers[tag as keyof Handler<E, R>] = ((payload: unknown, resume: (v: unknown) => R) => {
      return handler(payload, (value) => {
        records.push({ tag, payload, result: value });
        return resume(value);
      });
    }) as Handler<E, R>[keyof Handler<E, R>];
  }

  return {
    handler: {
      return: inner.return,
      handlers: recordingHandlers as Handler<E, R>,
    },
    getRecords: () => records,
  };
}

// ============================================
// Register All Default Handlers
// ============================================

/**
 * Register all default handlers for a runtime
 */
export function registerDefaultHandlers(runtime: EffectRuntimeState): void {
  registerConsoleHandlers(runtime);
  registerTimeHandlers(runtime);
  registerRandomHandlers(runtime);
}
