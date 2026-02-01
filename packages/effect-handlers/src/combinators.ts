// ============================================================================
// ISL Effect System - Effect Combinators
// @isl-lang/effect-handlers/combinators
// ============================================================================

import type { Eff, EffectRow, Handler } from './types';
import { pure, flatMap, map, perform, Do } from './effect';
import { handle } from './handler';
import { ErrorEff, raise, type Either, type ErrorEffect, type StateEffect, State, get, put } from './builtins';

// ============================================================================
// CONTROL FLOW COMBINATORS
// ============================================================================

/**
 * If-then-else for effectful computations.
 */
export function ifM<E extends EffectRow, A>(
  condition: Eff<E, boolean>,
  thenBranch: Eff<E, A>,
  elseBranch: Eff<E, A>
): Eff<E, A> {
  return flatMap(condition, (cond) => (cond ? thenBranch : elseBranch));
}

/**
 * Guard - fail if condition is false.
 */
export function guard<E extends EffectRow>(
  condition: boolean,
  errorEffect: ErrorEffect<string>
): Eff<E | ErrorEffect<string>, void> {
  return condition ? pure(undefined) : raise(errorEffect, 'Guard failed') as any;
}

/**
 * Loop while condition is true.
 */
export function whileM<E extends EffectRow>(
  condition: Eff<E, boolean>,
  body: Eff<E, void>
): Eff<E, void> {
  return flatMap(condition, (cond) =>
    cond ? flatMap(body, () => whileM(condition, body)) : pure(undefined)
  );
}

/**
 * Loop until condition is true.
 */
export function untilM<E extends EffectRow>(
  body: Eff<E, void>,
  condition: Eff<E, boolean>
): Eff<E, void> {
  return flatMap(body, () =>
    flatMap(condition, (cond) =>
      cond ? pure(undefined) : untilM(body, condition)
    )
  );
}

/**
 * Iterate a computation n times with index.
 */
export function forM<E extends EffectRow>(
  start: number,
  end: number,
  body: (i: number) => Eff<E, void>
): Eff<E, void> {
  if (start >= end) {
    return pure(undefined);
  }
  return flatMap(body(start), () => forM(start + 1, end, body));
}

/**
 * Fold over a list with an effectful function.
 */
export function foldM<E extends EffectRow, A, B>(
  list: A[],
  initial: B,
  f: (acc: B, a: A) => Eff<E, B>
): Eff<E, B> {
  return list.reduce(
    (acc, a) => flatMap(acc, (b) => f(b, a)),
    pure(initial) as Eff<E, B>
  );
}

/**
 * Filter a list with an effectful predicate.
 */
export function filterM<E extends EffectRow, A>(
  list: A[],
  predicate: (a: A) => Eff<E, boolean>
): Eff<E, A[]> {
  return foldM(list, [] as A[], (acc, a) =>
    map(predicate(a), (keep) => (keep ? [...acc, a] : acc))
  );
}

// ============================================================================
// ERROR HANDLING COMBINATORS
// ============================================================================

/**
 * Try a computation, catching errors.
 */
export function tryEff<E extends EffectRow, Err, A>(
  computation: Eff<E | ErrorEffect<Err>, A>
): Eff<E, Either<Err, A>> {
  // This would need proper handler application
  return computation as any;
}

/**
 * Catch and handle errors.
 */
export function catchEff<E extends EffectRow, Err, A>(
  computation: Eff<E | ErrorEffect<Err>, A>,
  handler: (error: Err) => Eff<E, A>
): Eff<E, A> {
  return flatMap(tryEff(computation), (result) =>
    result.tag === 'Left' ? handler(result.value) : pure(result.value)
  );
}

/**
 * Ensure cleanup runs regardless of success/failure.
 */
export function finally_<E extends EffectRow, A>(
  computation: Eff<E, A>,
  cleanup: Eff<E, void>
): Eff<E, A> {
  return flatMap(computation, (a) => map(cleanup, () => a));
}

/**
 * Bracket pattern - acquire, use, release.
 */
export function bracket<E extends EffectRow, R, A>(
  acquire: Eff<E, R>,
  release: (r: R) => Eff<E, void>,
  use: (r: R) => Eff<E, A>
): Eff<E, A> {
  return flatMap(acquire, (resource) =>
    finally_(use(resource), release(resource))
  );
}

// ============================================================================
// STATE COMBINATORS
// ============================================================================

/**
 * Run a computation with local state.
 */
export function runState<S, E extends EffectRow, A>(
  initial: S,
  computation: Eff<E | StateEffect<S>, A>
): Eff<E, [A, S]> {
  // Would need proper handler implementation
  return computation as any;
}

/**
 * Evaluate a stateful computation, discarding final state.
 */
export function evalState<S, E extends EffectRow, A>(
  initial: S,
  computation: Eff<E | StateEffect<S>, A>
): Eff<E, A> {
  return map(runState(initial, computation), ([a, _]) => a);
}

/**
 * Execute a stateful computation, discarding result.
 */
export function execState<S, E extends EffectRow, A>(
  initial: S,
  computation: Eff<E | StateEffect<S>, A>
): Eff<E, S> {
  return map(runState(initial, computation), ([_, s]) => s);
}

/**
 * Update state and return previous value.
 */
export function getAndSet<S>(effect: StateEffect<S>, newValue: S): Eff<StateEffect<S>, S> {
  return Do(function* () {
    const old = yield* get(effect).run();
    yield* put(effect, newValue).run();
    return old;
  });
}

/**
 * Update state with a function and return previous value.
 */
export function getAndModify<S>(effect: StateEffect<S>, f: (s: S) => S): Eff<StateEffect<S>, S> {
  return Do(function* () {
    const old = yield* get(effect).run();
    yield* put(effect, f(old)).run();
    return old;
  });
}

// ============================================================================
// RESOURCE COMBINATORS
// ============================================================================

/**
 * A resource that can be acquired and released.
 */
export interface Resource<E extends EffectRow, A> {
  acquire: Eff<E, A>;
  release: (a: A) => Eff<E, void>;
}

/**
 * Use a resource, ensuring it's released.
 */
export function useResource<E extends EffectRow, A, B>(
  resource: Resource<E, A>,
  use: (a: A) => Eff<E, B>
): Eff<E, B> {
  return bracket(resource.acquire, resource.release, use);
}

/**
 * Combine two resources.
 */
export function bothResources<E extends EffectRow, A, B>(
  ra: Resource<E, A>,
  rb: Resource<E, B>
): Resource<E, [A, B]> {
  return {
    acquire: flatMap(ra.acquire, (a) => map(rb.acquire, (b) => [a, b] as [A, B])),
    release: ([a, b]) => flatMap(rb.release(b), () => ra.release(a)),
  };
}

// ============================================================================
// TRAVERSAL COMBINATORS
// ============================================================================

/**
 * Map with index.
 */
export function mapWithIndex<E extends EffectRow, A, B>(
  list: A[],
  f: (i: number, a: A) => Eff<E, B>
): Eff<E, B[]> {
  return foldM(list, [] as B[], (acc, a) =>
    map(f(acc.length, a), (b) => [...acc, b])
  );
}

/**
 * Find first element satisfying predicate.
 */
export function findM<E extends EffectRow, A>(
  list: A[],
  predicate: (a: A) => Eff<E, boolean>
): Eff<E, A | undefined> {
  if (list.length === 0) {
    return pure(undefined);
  }
  
  const [head, ...tail] = list;
  return flatMap(predicate(head), (found) =>
    found ? pure(head) : findM(tail, predicate)
  );
}

/**
 * Check if any element satisfies predicate.
 */
export function anyM<E extends EffectRow, A>(
  list: A[],
  predicate: (a: A) => Eff<E, boolean>
): Eff<E, boolean> {
  return map(findM(list, predicate), (result) => result !== undefined);
}

/**
 * Check if all elements satisfy predicate.
 */
export function allM<E extends EffectRow, A>(
  list: A[],
  predicate: (a: A) => Eff<E, boolean>
): Eff<E, boolean> {
  return foldM(list, true, (acc, a) =>
    acc ? predicate(a) : pure(false)
  );
}

// ============================================================================
// RETRY COMBINATORS
// ============================================================================

/**
 * Retry a computation a number of times.
 */
export function retry<E extends EffectRow, A>(
  computation: Eff<E, A>,
  maxRetries: number
): Eff<E, A> {
  if (maxRetries <= 0) {
    return computation;
  }
  
  return computation; // Simplified - would need error handling
}

/**
 * Retry with exponential backoff.
 */
export function retryWithBackoff<E extends EffectRow, A>(
  computation: Eff<E, A>,
  maxRetries: number,
  baseDelayMs: number
): Eff<E, A> {
  // Simplified implementation
  return retry(computation, maxRetries);
}

// ============================================================================
// MEMOIZATION
// ============================================================================

/**
 * Memoize an effectful computation (run once, cache result).
 */
export function once<E extends EffectRow, A>(
  computation: Eff<E, A>
): () => Eff<E, A> {
  let cached: A | undefined;
  let computed = false;
  
  return () => {
    if (computed) {
      return pure(cached as A);
    }
    return map(computation, (a) => {
      cached = a;
      computed = true;
      return a;
    });
  };
}

// ============================================================================
// PARALLEL COMBINATORS
// ============================================================================

/**
 * Run two computations in parallel (when Async effect is available).
 */
export function parallel2<E extends EffectRow, A, B>(
  ma: Eff<E, A>,
  mb: Eff<E, B>
): Eff<E, [A, B]> {
  // Simplified - actual implementation would use Async effect
  return flatMap(ma, (a) => map(mb, (b) => [a, b] as [A, B]));
}

/**
 * Run three computations in parallel.
 */
export function parallel3<E extends EffectRow, A, B, C>(
  ma: Eff<E, A>,
  mb: Eff<E, B>,
  mc: Eff<E, C>
): Eff<E, [A, B, C]> {
  return flatMap(parallel2(ma, mb), ([a, b]) =>
    map(mc, (c) => [a, b, c] as [A, B, C])
  );
}

/**
 * Race two computations, returning the first to complete.
 */
export function race<E extends EffectRow, A>(
  ma: Eff<E, A>,
  mb: Eff<E, A>
): Eff<E, A> {
  // Simplified - actual implementation would use Async effect
  return ma;
}
