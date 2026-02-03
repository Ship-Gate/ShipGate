/**
 * Effect Builders
 * 
 * Constructors and utilities for creating effects.
 */

import type {
  Effect,
  EffectType,
  Eff,
  ConsoleEffect,
  FileSystemEffect,
  NetworkEffect,
  DatabaseEffect,
  TimeEffect,
  RandomEffect,
  StateEffect,
  ErrorEffect,
  AsyncEffect,
  Fiber,
} from './types';

// ============================================
// Effect Constructors
// ============================================

/**
 * Create a generic effect
 */
export function effect<Tag extends string, Payload>(
  tag: Tag,
  payload: Payload
): EffectType<Tag, Payload> {
  return {
    _tag: tag,
    payload,
  } as EffectType<Tag, Payload>;
}

// ============================================
// Console Effects
// ============================================

export const Console = {
  /**
   * Log a message to console
   */
  log(message: string): ConsoleEffect {
    return effect('console.log', { message });
  },

  /**
   * Log an error to console
   */
  error(message: string): ConsoleEffect {
    return effect('console.error', { message });
  },

  /**
   * Read from console
   */
  read(): ConsoleEffect {
    return effect('console.read', undefined);
  },
};

// ============================================
// File System Effects
// ============================================

export const FileSystem = {
  /**
   * Read a file
   */
  read(path: string): FileSystemEffect {
    return effect('fs.read', { path });
  },

  /**
   * Write to a file
   */
  write(path: string, content: string): FileSystemEffect {
    return effect('fs.write', { path, content });
  },

  /**
   * Delete a file
   */
  delete(path: string): FileSystemEffect {
    return effect('fs.delete', { path });
  },

  /**
   * Check if file exists
   */
  exists(path: string): FileSystemEffect {
    return effect('fs.exists', { path });
  },
};

// ============================================
// Network Effects
// ============================================

export const Network = {
  /**
   * Make an HTTP GET request
   */
  get(url: string): NetworkEffect {
    return effect('http.request', { url, method: 'GET' });
  },

  /**
   * Make an HTTP POST request
   */
  post(url: string, body: unknown): NetworkEffect {
    return effect('http.request', { url, method: 'POST', body });
  },

  /**
   * Make an HTTP PUT request
   */
  put(url: string, body: unknown): NetworkEffect {
    return effect('http.request', { url, method: 'PUT', body });
  },

  /**
   * Make an HTTP DELETE request
   */
  delete(url: string): NetworkEffect {
    return effect('http.request', { url, method: 'DELETE' });
  },

  /**
   * Make a generic HTTP request
   */
  request(url: string, method: string, body?: unknown): NetworkEffect {
    return effect('http.request', { url, method, body });
  },
};

// ============================================
// Database Effects
// ============================================

export const Database = {
  /**
   * Execute a query
   */
  query(sql: string, params?: unknown[]): DatabaseEffect {
    return effect('db.query', { sql, params });
  },

  /**
   * Execute a statement
   */
  execute(sql: string, params?: unknown[]): DatabaseEffect {
    return effect('db.execute', { sql, params });
  },

  /**
   * Execute operations in a transaction
   */
  transaction(operations: DatabaseEffect[]): DatabaseEffect {
    return effect('db.transaction', { operations });
  },
};

// ============================================
// Time Effects
// ============================================

export const Time = {
  /**
   * Get current time
   */
  now(): TimeEffect {
    return effect('time.now', undefined);
  },

  /**
   * Sleep for a duration
   */
  sleep(ms: number): TimeEffect {
    return effect('time.sleep', { ms });
  },

  /**
   * Set a timeout
   */
  timeout(ms: number, action: () => unknown): TimeEffect {
    return effect('time.timeout', { ms, action });
  },
};

// ============================================
// Random Effects
// ============================================

export const Random = {
  /**
   * Generate a random integer in range
   */
  int(min: number, max: number): RandomEffect {
    return effect('random.int', { min, max });
  },

  /**
   * Generate a random float between 0 and 1
   */
  float(): RandomEffect {
    return effect('random.float', undefined);
  },

  /**
   * Generate a random UUID
   */
  uuid(): RandomEffect {
    return effect('random.uuid', undefined);
  },
};

// ============================================
// State Effects
// ============================================

export function State<S>() {
  return {
    /**
     * Get current state
     */
    get(): StateEffect<S> {
      return effect('state.get', undefined);
    },

    /**
     * Set state to a new value
     */
    set(value: S): StateEffect<S> {
      return effect('state.set', { value });
    },

    /**
     * Modify state with a function
     */
    modify(fn: (s: S) => S): StateEffect<S> {
      return effect('state.modify', { fn });
    },
  };
}

// ============================================
// Error Effects
// ============================================

export const Err = {
  /**
   * Throw an error
   */
  throw(error: Error): ErrorEffect {
    return effect('error.throw', { error });
  },

  /**
   * Catch an error
   */
  catch(handler: (e: Error) => unknown): ErrorEffect {
    return effect('error.catch', { handler });
  },
};

// ============================================
// Async Effects
// ============================================

export const Async = {
  /**
   * Fork a computation
   */
  fork(computation: () => unknown): AsyncEffect {
    return effect('async.fork', { computation });
  },

  /**
   * Join a fiber
   */
  join(fiber: Fiber): AsyncEffect {
    return effect('async.join', { fiber });
  },

  /**
   * Race multiple computations
   */
  race(computations: Array<() => unknown>): AsyncEffect {
    return effect('async.race', { computations });
  },
};

// ============================================
// Effectful Computation Builders
// ============================================

/**
 * Create a pure effectful computation
 */
export function pure<A>(value: A): Eff<never, A> {
  return {
    _E: undefined as never,
    _A: value,
    run: function* () {
      return value;
    },
  };
}

/**
 * Create an effectful computation from a generator
 */
export function eff<E extends Effect, A>(
  gen: () => Generator<E, A, unknown>
): Eff<E, A> {
  return {
    _E: undefined as unknown as E,
    _A: undefined as unknown as A,
    run: gen,
  };
}

/**
 * Sequence two effectful computations
 */
export function andThen<E1 extends Effect, A, E2 extends Effect, B>(
  first: Eff<E1, A>,
  f: (a: A) => Eff<E2, B>
): Eff<E1 | E2, B> {
  return eff(function* () {
    const gen1 = first.run();
    let result1 = gen1.next();
    while (!result1.done) {
      const value = yield result1.value as E1 | E2;
      result1 = gen1.next(value);
    }

    const second = f(result1.value);
    const gen2 = second.run();
    let result2 = gen2.next();
    while (!result2.done) {
      const value = yield result2.value as E1 | E2;
      result2 = gen2.next(value);
    }

    return result2.value;
  });
}

/**
 * Map over an effectful computation
 */
export function map<E extends Effect, A, B>(
  computation: Eff<E, A>,
  f: (a: A) => B
): Eff<E, B> {
  return eff(function* () {
    const gen = computation.run();
    let result = gen.next();
    while (!result.done) {
      const value = yield result.value;
      result = gen.next(value);
    }
    return f(result.value);
  }) as unknown as Eff<E, B>;
}

/**
 * Combine multiple effectful computations
 */
export function all<E extends Effect, A>(
  computations: Array<Eff<E, A>>
): Eff<E, A[]> {
  return eff(function* () {
    const results: A[] = [];
    for (const comp of computations) {
      const gen = comp.run();
      let result = gen.next();
      while (!result.done) {
        const value = yield result.value;
        result = gen.next(value);
      }
      results.push(result.value);
    }
    return results;
  }) as unknown as Eff<E, A[]>;
}
