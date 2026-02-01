// ============================================================================
// ISL Effect System - Effect Construction
// @isl-lang/effect-handlers/effect
// ============================================================================

import type {
  Eff,
  EffectRow,
  EffectSignature,
  EffectOperation,
  EffectRequest,
  Pure,
} from './types';

// ============================================================================
// EFFECT COMPUTATION CONSTRUCTORS
// ============================================================================

/**
 * Create a pure computation (no effects).
 */
export function pure<A>(value: A): Pure<A> {
  return {
    _tag: 'Eff',
    _effects: undefined as never,
    _result: undefined as A,
    
    map<B>(f: (a: A) => B): Pure<B> {
      return pure(f(value));
    },
    
    flatMap<E2 extends EffectRow, B>(f: (a: A) => Eff<E2, B>): Eff<E2, B> {
      return f(value);
    },
    
    *run() {
      return value;
    },
  };
}

/**
 * Create a computation that performs an effect operation.
 */
export function perform<
  E extends EffectSignature<any>,
  Op extends keyof E['operations'],
>(
  effect: E,
  operation: Op,
  ...args: Parameters<E['operations'][Op]>
): Eff<E, ReturnType<E['operations'][Op]>> {
  const request: EffectRequest<E, Op> = {
    effect,
    operation,
    args,
  };
  
  return {
    _tag: 'Eff',
    _effects: effect as E,
    _result: undefined as ReturnType<E['operations'][Op]>,
    
    map<B>(f: (a: ReturnType<E['operations'][Op]>) => B): Eff<E, B> {
      return flatMap(this, (a) => pure(f(a)));
    },
    
    flatMap<E2 extends EffectRow, B>(
      f: (a: ReturnType<E['operations'][Op]>) => Eff<E2, B>
    ): Eff<E | E2, B> {
      return flatMap(this as any, f as any) as any;
    },
    
    *run() {
      const result = yield request;
      return result;
    },
  };
}

/**
 * Sequence two computations.
 */
export function flatMap<E1 extends EffectRow, E2 extends EffectRow, A, B>(
  ma: Eff<E1, A>,
  f: (a: A) => Eff<E2, B>
): Eff<E1 | E2, B> {
  return {
    _tag: 'Eff',
    _effects: undefined as E1 | E2,
    _result: undefined as B,
    
    map<C>(g: (b: B) => C): Eff<E1 | E2, C> {
      return flatMap(this, (b) => pure(g(b)));
    },
    
    flatMap<E3 extends EffectRow, C>(
      g: (b: B) => Eff<E3, C>
    ): Eff<E1 | E2 | E3, C> {
      return flatMap(this as any, g as any) as any;
    },
    
    *run() {
      const gen1 = ma.run();
      let next1 = gen1.next();
      
      while (!next1.done) {
        const result = yield next1.value;
        next1 = gen1.next(result);
      }
      
      const a = next1.value;
      const mb = f(a);
      const gen2 = mb.run();
      let next2 = gen2.next();
      
      while (!next2.done) {
        const result = yield next2.value;
        next2 = gen2.next(result);
      }
      
      return next2.value;
    },
  };
}

/**
 * Map a function over a computation.
 */
export function map<E extends EffectRow, A, B>(
  ma: Eff<E, A>,
  f: (a: A) => B
): Eff<E, B> {
  return flatMap(ma, (a) => pure(f(a)));
}

/**
 * Apply a computation of a function to a computation of a value.
 */
export function ap<E1 extends EffectRow, E2 extends EffectRow, A, B>(
  mf: Eff<E1, (a: A) => B>,
  ma: Eff<E2, A>
): Eff<E1 | E2, B> {
  return flatMap(mf, (f) => map(ma, f));
}

// ============================================================================
// EFFECT COMBINATORS
// ============================================================================

/**
 * Sequence a list of computations.
 */
export function sequence<E extends EffectRow, A>(
  computations: Eff<E, A>[]
): Eff<E, A[]> {
  return computations.reduce(
    (acc, computation) =>
      flatMap(acc, (results) =>
        map(computation, (result) => [...results, result])
      ),
    pure<A[]>([]) as Eff<E, A[]>
  );
}

/**
 * Traverse a list with an effectful function.
 */
export function traverse<E extends EffectRow, A, B>(
  list: A[],
  f: (a: A) => Eff<E, B>
): Eff<E, B[]> {
  return sequence(list.map(f));
}

/**
 * Execute an effect for its side effects only.
 */
export function forEach<E extends EffectRow, A>(
  list: A[],
  f: (a: A) => Eff<E, void>
): Eff<E, void> {
  return map(traverse(list, f), () => undefined);
}

/**
 * Repeat a computation n times.
 */
export function replicate<E extends EffectRow, A>(
  n: number,
  computation: Eff<E, A>
): Eff<E, A[]> {
  return sequence(Array(n).fill(computation));
}

/**
 * Conditional computation.
 */
export function when<E extends EffectRow>(
  condition: boolean,
  computation: Eff<E, void>
): Eff<E, void> {
  return condition ? computation : pure(undefined);
}

/**
 * Unless (negated when).
 */
export function unless<E extends EffectRow>(
  condition: boolean,
  computation: Eff<E, void>
): Eff<E, void> {
  return when(!condition, computation);
}

// ============================================================================
// DO NOTATION SIMULATION
// ============================================================================

/**
 * Generator-based do notation for effects.
 */
export function Do<E extends EffectRow, A>(
  gen: () => Generator<Eff<EffectRow, unknown>, A, unknown>
): Eff<E, A> {
  return {
    _tag: 'Eff',
    _effects: undefined as E,
    _result: undefined as A,
    
    map<B>(f: (a: A) => B): Eff<E, B> {
      return flatMap(this, (a) => pure(f(a)));
    },
    
    flatMap<E2 extends EffectRow, B>(
      f: (a: A) => Eff<E2, B>
    ): Eff<E | E2, B> {
      return flatMap(this as any, f as any) as any;
    },
    
    *run() {
      const generator = gen();
      let next = generator.next();
      
      while (!next.done) {
        const computation = next.value as Eff<EffectRow, unknown>;
        const innerGen = computation.run();
        let innerNext = innerGen.next();
        
        while (!innerNext.done) {
          const result = yield innerNext.value;
          innerNext = innerGen.next(result);
        }
        
        next = generator.next(innerNext.value);
      }
      
      return next.value;
    },
  };
}

// ============================================================================
// EFFECT LIFTING
// ============================================================================

/**
 * Lift a pure function to work with effects.
 */
export function liftA<A, B>(f: (a: A) => B): <E extends EffectRow>(ma: Eff<E, A>) => Eff<E, B> {
  return (ma) => map(ma, f);
}

/**
 * Lift a binary function.
 */
export function liftA2<A, B, C>(
  f: (a: A, b: B) => C
): <E1 extends EffectRow, E2 extends EffectRow>(
  ma: Eff<E1, A>,
  mb: Eff<E2, B>
) => Eff<E1 | E2, C> {
  return (ma, mb) => flatMap(ma, (a) => map(mb, (b) => f(a, b)));
}

/**
 * Lift a ternary function.
 */
export function liftA3<A, B, C, D>(
  f: (a: A, b: B, c: C) => D
): <E1 extends EffectRow, E2 extends EffectRow, E3 extends EffectRow>(
  ma: Eff<E1, A>,
  mb: Eff<E2, B>,
  mc: Eff<E3, C>
) => Eff<E1 | E2 | E3, D> {
  return (ma, mb, mc) =>
    flatMap(ma, (a) => flatMap(mb, (b) => map(mc, (c) => f(a, b, c))));
}

// ============================================================================
// EFFECT FROM PROMISE (for interop)
// ============================================================================

/**
 * Effect signature for async operations.
 */
export interface AsyncEffect extends EffectSignature<{
  await: EffectOperation<Promise<unknown>, unknown>;
}> {
  name: 'Async';
}

/**
 * Convert a Promise to an effect.
 */
export function fromPromise<A>(promise: Promise<A>): Eff<AsyncEffect, A> {
  return perform({ name: 'Async', operations: {} } as any, 'await' as any, promise) as any;
}

/**
 * Convert a function returning a Promise to an effectful function.
 */
export function fromAsync<Args extends unknown[], A>(
  f: (...args: Args) => Promise<A>
): (...args: Args) => Eff<AsyncEffect, A> {
  return (...args) => fromPromise(f(...args));
}
