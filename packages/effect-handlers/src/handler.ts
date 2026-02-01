// ============================================================================
// ISL Effect System - Effect Handlers
// @intentos/effect-handlers/handler
// ============================================================================

import type {
  Eff,
  EffectRow,
  EffectSignature,
  EffectRequest,
  Handler,
  HandlerOperations,
  DeepHandler,
  ShallowHandler,
  RemoveEffect,
  Continuation,
  Resumption,
} from './types';
import { pure, flatMap } from './effect';

// ============================================================================
// HANDLER CONSTRUCTION
// ============================================================================

/**
 * Create a deep handler for an effect.
 */
export function handler<E extends EffectSignature<any>, R>(
  effect: E,
  operations: HandlerOperations<E, R>,
  returnHandler: <A>(value: A) => R
): DeepHandler<E, R> {
  return {
    effect,
    operations,
    return: returnHandler,
    depth: 'deep',
  };
}

/**
 * Create a shallow handler (handles only immediate effects).
 */
export function shallowHandler<E extends EffectSignature<any>, R>(
  effect: E,
  operations: HandlerOperations<E, R>,
  returnHandler: <A>(value: A) => R
): ShallowHandler<E, R> {
  return {
    effect,
    operations,
    return: returnHandler,
    depth: 'shallow',
  };
}

// ============================================================================
// HANDLER APPLICATION
// ============================================================================

/**
 * Handle effects in a computation using a handler.
 */
export function handle<
  E extends EffectSignature<any>,
  Row extends EffectRow,
  A,
  R,
>(
  h: Handler<E, R>,
  computation: Eff<E | Row, A>
): Eff<RemoveEffect<Row, E>, R> {
  return {
    _tag: 'Eff',
    _effects: undefined as RemoveEffect<Row, E>,
    _result: undefined as R,
    
    map<B>(f: (r: R) => B): Eff<RemoveEffect<Row, E>, B> {
      return flatMap(this, (r) => pure(f(r)));
    },
    
    flatMap<E2 extends EffectRow, B>(
      f: (r: R) => Eff<E2, B>
    ): Eff<RemoveEffect<Row, E> | E2, B> {
      return flatMap(this as any, f as any) as any;
    },
    
    *run() {
      const gen = computation.run();
      
      function handleNext(next: IteratorResult<EffectRequest<any, any>, A>): R {
        if (next.done) {
          return h.return(next.value);
        }
        
        const request = next.value;
        
        // Check if this effect should be handled
        if (request.effect.name === h.effect.name) {
          const opHandler = h.operations[request.operation as keyof typeof h.operations];
          if (opHandler) {
            // Create resumption
            const resume = (result: any): R => {
              const nextResult = gen.next(result);
              return handleNext(nextResult);
            };
            
            return opHandler(request.args as any, resume);
          }
        }
        
        // Not our effect - re-yield it
        const result = yield request;
        const nextResult = gen.next(result);
        return handleNext(nextResult);
      }
      
      const firstResult = gen.next();
      return handleNext(firstResult) as any;
    },
  } as any;
}

/**
 * Run a pure computation (no effects).
 */
export function runPure<A>(computation: Eff<never, A>): A {
  const gen = computation.run();
  const result = gen.next();
  
  if (!result.done) {
    throw new Error('Unhandled effect in pure computation');
  }
  
  return result.value;
}

/**
 * Run a computation, collecting unhandled effects.
 */
export function runEff<E extends EffectRow, A>(
  computation: Eff<E, A>,
  handlers: Map<string, Handler<any, any>>
): A {
  const gen = computation.run();
  
  function step(next: IteratorResult<EffectRequest<any, any>, A>): A {
    if (next.done) {
      return next.value;
    }
    
    const request = next.value;
    const handler = handlers.get(request.effect.name);
    
    if (!handler) {
      throw new Error(`Unhandled effect: ${request.effect.name}.${String(request.operation)}`);
    }
    
    const opHandler = handler.operations[request.operation as keyof typeof handler.operations];
    if (!opHandler) {
      throw new Error(`Unhandled operation: ${request.effect.name}.${String(request.operation)}`);
    }
    
    let resumed = false;
    let result: A;
    
    opHandler(request.args as any, (value: any) => {
      if (resumed) {
        throw new Error('Continuation called multiple times in single-shot handler');
      }
      resumed = true;
      const nextResult = gen.next(value);
      result = step(nextResult);
      return result as any;
    });
    
    return result!;
  }
  
  const firstResult = gen.next();
  return step(firstResult);
}

// ============================================================================
// HANDLER COMBINATORS
// ============================================================================

/**
 * Compose two handlers.
 */
export function composeHandlers<
  E1 extends EffectSignature<any>,
  E2 extends EffectSignature<any>,
  R1,
  R2,
>(
  h1: Handler<E1, R1>,
  h2: Handler<E2, R2>
): Handler<E1 | E2, R1 | R2> {
  return {
    effect: { ...h1.effect, ...h2.effect } as any,
    operations: { ...h1.operations, ...h2.operations } as any,
    return: (value) => h1.return(h2.return(value) as any) as any,
  };
}

/**
 * Create a handler that interprets into another effect.
 */
export function interpret<
  E1 extends EffectSignature<any>,
  E2 extends EffectSignature<any>,
>(
  source: E1,
  target: E2,
  interpretations: {
    [K in keyof E1['operations']]: (
      args: E1['operations'][K]['_input'],
      perform: <Op extends keyof E2['operations']>(
        op: Op,
        ...args: Parameters<E2['operations'][Op]>
      ) => Eff<E2, ReturnType<E2['operations'][Op]>>
    ) => Eff<E2, E1['operations'][K]['_output']>;
  }
): <Row extends EffectRow, A>(
  computation: Eff<E1 | Row, A>
) => Eff<E2 | RemoveEffect<Row, E1>, A> {
  return (computation) => {
    return {
      _tag: 'Eff',
      _effects: undefined as any,
      _result: undefined as any,
      
      map(f: any) {
        return flatMap(this, (a: any) => pure(f(a)));
      },
      
      flatMap(f: any) {
        return flatMap(this as any, f);
      },
      
      *run() {
        const gen = computation.run();
        let next = gen.next();
        
        while (!next.done) {
          const request = next.value;
          
          if (request.effect.name === source.name) {
            const interpretation = interpretations[request.operation as keyof typeof interpretations];
            // Execute interpretation and get result
            // This is simplified - real implementation would be more complex
            const result = yield* interpretation(request.args, (op: any, ...args: any[]) => {
              return { _tag: 'Eff', *run() { yield { effect: target, operation: op, args }; } } as any;
            }).run();
            next = gen.next(result);
          } else {
            const result = yield request;
            next = gen.next(result);
          }
        }
        
        return next.value;
      },
    } as any;
  };
}

// ============================================================================
// CONTINUATION UTILITIES
// ============================================================================

/**
 * Create a delimited continuation.
 */
export function continuation<A, B>(f: (a: A) => B): Continuation<A, B> {
  return {
    _tag: 'Continuation',
    apply: f,
    compose<C>(other: Continuation<B, C>): Continuation<A, C> {
      return continuation((a) => other.apply(f(a)));
    },
  };
}

/**
 * Create a multi-shot resumption.
 */
export function multishot<A, B>(f: (a: A) => B): Resumption<A, B> {
  return {
    _tag: 'Continuation',
    multishot: true,
    apply: f,
    compose<C>(other: Continuation<B, C>): Continuation<A, C> {
      return continuation((a) => other.apply(f(a)));
    },
  };
}

// ============================================================================
// HANDLER HELPERS
// ============================================================================

/**
 * Create a handler that discards the effect.
 */
export function discardHandler<E extends EffectSignature<any>>(
  effect: E
): Handler<E, void> {
  const operations = {} as HandlerOperations<E, void>;
  
  for (const op of Object.keys(effect.operations)) {
    (operations as any)[op] = (_args: any, resume: (result: any) => void) => {
      resume(undefined);
    };
  }
  
  return {
    effect,
    operations,
    return: () => undefined,
  };
}

/**
 * Create a handler that logs all operations.
 */
export function loggingHandler<E extends EffectSignature<any>, R>(
  effect: E,
  baseHandler: Handler<E, R>,
  log: (operation: string, args: any, result: any) => void
): Handler<E, R> {
  const operations = {} as HandlerOperations<E, R>;
  
  for (const op of Object.keys(baseHandler.operations)) {
    const baseOp = (baseHandler.operations as any)[op];
    (operations as any)[op] = (args: any, resume: (result: any) => R) => {
      return baseOp(args, (result: any) => {
        log(op, args, result);
        return resume(result);
      });
    };
  }
  
  return {
    effect,
    operations,
    return: baseHandler.return,
  };
}
