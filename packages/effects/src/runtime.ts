/**
 * ISL Effect Runtime
 * 
 * Executes effects with proper handling, interception, and error management
 */

import type {
  AnyEffect,
  Effect,
  EffectHandler,
  EffectRuntime,
  EffectInterceptor,
  SequenceEffect,
  ParallelEffect,
  ConditionalEffect,
  RetryEffect,
  TimeoutEffect,
  CacheEffect,
} from './types.js';

/**
 * Default effect handlers
 */
const defaultHandlers: Map<string, EffectHandler<AnyEffect, unknown>> = new Map();

/**
 * Effect execution context
 */
export interface ExecutionContext {
  runtime: EffectRuntime;
  trace: EffectTrace[];
  cache: Map<string, { value: unknown; expires: number }>;
}

/**
 * Effect trace entry
 */
export interface EffectTrace {
  effect: AnyEffect;
  startTime: number;
  endTime?: number;
  result?: unknown;
  error?: Error;
}

/**
 * Create a new effect runtime
 */
export function createRuntime(
  options?: Partial<EffectRuntime>
): EffectRuntime {
  return {
    handlers: new Map([...defaultHandlers, ...(options?.handlers ?? [])]),
    interceptors: options?.interceptors ?? [],
    logger: options?.logger,
  };
}

/**
 * Register an effect handler
 */
export function registerHandler<E extends AnyEffect, T>(
  runtime: EffectRuntime,
  tag: string,
  handler: EffectHandler<E, T>
): void {
  runtime.handlers.set(tag, handler as EffectHandler<AnyEffect, unknown>);
}

/**
 * Add an interceptor to the runtime
 */
export function addInterceptor(
  runtime: EffectRuntime,
  interceptor: EffectInterceptor
): void {
  runtime.interceptors.push(interceptor);
}

/**
 * Execute an effect
 */
export async function run<T>(
  effect: Effect<T>,
  runtime: EffectRuntime = createRuntime()
): Promise<T> {
  const context: ExecutionContext = {
    runtime,
    trace: [],
    cache: new Map(),
  };

  return executeEffect(effect as AnyEffect, context) as Promise<T>;
}

/**
 * Execute an effect with context
 */
async function executeEffect(
  effect: AnyEffect,
  context: ExecutionContext
): Promise<unknown> {
  const { runtime, trace } = context;
  const traceEntry: EffectTrace = {
    effect,
    startTime: Date.now(),
  };
  trace.push(traceEntry);

  try {
    // Run before interceptors
    let processedEffect = effect;
    for (const interceptor of runtime.interceptors) {
      if (interceptor.before) {
        processedEffect = await interceptor.before(processedEffect);
      }
    }

    // Execute the effect
    let result: unknown;

    switch (processedEffect._tag) {
      case 'Sequence':
        result = await executeSequence(processedEffect as SequenceEffect<unknown>, context);
        break;
      case 'Parallel':
        result = await executeParallel(processedEffect as ParallelEffect<unknown>, context);
        break;
      case 'Conditional':
        result = await executeConditional(processedEffect as ConditionalEffect<unknown>, context);
        break;
      case 'Retry':
        result = await executeRetry(processedEffect as RetryEffect<unknown>, context);
        break;
      case 'Timeout':
        result = await executeTimeout(processedEffect as TimeoutEffect<unknown>, context);
        break;
      case 'Cache':
        result = await executeCache(processedEffect as CacheEffect<unknown>, context);
        break;
      default:
        result = await executeBasicEffect(processedEffect, context);
    }

    // Run after interceptors
    for (const interceptor of runtime.interceptors) {
      if (interceptor.after) {
        result = await interceptor.after(processedEffect, result);
      }
    }

    // Log the effect
    if (runtime.logger) {
      runtime.logger(processedEffect, result);
    }

    traceEntry.endTime = Date.now();
    traceEntry.result = result;

    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    traceEntry.endTime = Date.now();
    traceEntry.error = error;

    // Run error interceptors
    for (const interceptor of runtime.interceptors) {
      if (interceptor.onError) {
        await interceptor.onError(effect, error);
      }
    }

    throw error;
  }
}

/**
 * Execute a basic effect using registered handler
 */
async function executeBasicEffect(
  effect: AnyEffect,
  context: ExecutionContext
): Promise<unknown> {
  const handler = context.runtime.handlers.get(effect._tag);

  if (!handler) {
    throw new EffectNotHandledError(effect._tag);
  }

  return handler(effect);
}

/**
 * Execute a sequence of effects
 */
async function executeSequence(
  effect: SequenceEffect<unknown>,
  context: ExecutionContext
): Promise<unknown> {
  let lastResult: unknown;

  for (const e of effect.effects) {
    lastResult = await executeEffect(e as AnyEffect, context);
  }

  return lastResult;
}

/**
 * Execute effects in parallel
 */
async function executeParallel(
  effect: ParallelEffect<unknown>,
  context: ExecutionContext
): Promise<unknown[]> {
  return Promise.all(
    effect.effects.map((e) => executeEffect(e as AnyEffect, context))
  );
}

/**
 * Execute a conditional effect
 */
async function executeConditional(
  effect: ConditionalEffect<unknown>,
  context: ExecutionContext
): Promise<unknown> {
  const condition = await executeEffect(effect.condition as AnyEffect, context);

  if (condition) {
    return executeEffect(effect.onTrue as AnyEffect, context);
  } else if (effect.onFalse) {
    return executeEffect(effect.onFalse as AnyEffect, context);
  }

  return undefined;
}

/**
 * Execute a retry effect
 */
async function executeRetry(
  effect: RetryEffect<unknown>,
  context: ExecutionContext
): Promise<unknown> {
  const { policy } = effect;
  let lastError: Error | undefined;
  let currentDelay = policy.delay;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await executeEffect(effect.effect as AnyEffect, context);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Check if we should retry this error
      if (policy.retryOn && !policy.retryOn.includes(lastError.name)) {
        throw lastError;
      }

      if (attempt < policy.maxAttempts) {
        await sleep(currentDelay);

        // Apply backoff
        if (policy.backoff === 'exponential') {
          currentDelay = Math.min(
            currentDelay * 2,
            policy.maxDelay ?? Infinity
          );
        } else if (policy.backoff === 'linear') {
          currentDelay = Math.min(
            currentDelay + policy.delay,
            policy.maxDelay ?? Infinity
          );
        }
      }
    }
  }

  throw lastError ?? new Error('Retry failed');
}

/**
 * Execute a timeout effect
 */
async function executeTimeout(
  effect: TimeoutEffect<unknown>,
  context: ExecutionContext
): Promise<unknown> {
  return Promise.race([
    executeEffect(effect.effect as AnyEffect, context),
    new Promise((resolve, reject) => {
      setTimeout(() => {
        if (effect.fallback !== undefined) {
          resolve(effect.fallback);
        } else {
          reject(new TimeoutError(effect.duration));
        }
      }, effect.duration);
    }),
  ]);
}

/**
 * Execute a cache effect
 */
async function executeCache(
  effect: CacheEffect<unknown>,
  context: ExecutionContext
): Promise<unknown> {
  const cached = context.cache.get(effect.key);

  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const result = await executeEffect(effect.effect as AnyEffect, context);

  context.cache.set(effect.key, {
    value: result,
    expires: Date.now() + (effect.ttl ?? 60000),
  });

  return result;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Error for unhandled effects
 */
export class EffectNotHandledError extends Error {
  constructor(tag: string) {
    super(`No handler registered for effect: ${tag}`);
    this.name = 'EffectNotHandledError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends Error {
  constructor(duration: number) {
    super(`Effect timed out after ${duration}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Create a test runtime with mock handlers
 */
export function createTestRuntime(
  mocks: Record<string, unknown | ((effect: AnyEffect) => unknown)>
): EffectRuntime {
  const handlers = new Map<string, EffectHandler<AnyEffect, unknown>>();

  for (const [tag, mock] of Object.entries(mocks)) {
    if (typeof mock === 'function') {
      handlers.set(tag, async (effect) => mock(effect));
    } else {
      handlers.set(tag, async () => mock);
    }
  }

  return {
    handlers,
    interceptors: [],
  };
}

/**
 * Collect all effects without executing them
 */
export function collectEffects(effect: AnyEffect): AnyEffect[] {
  const effects: AnyEffect[] = [effect];

  switch (effect._tag) {
    case 'Sequence':
    case 'Parallel':
      for (const e of (effect as SequenceEffect<unknown>).effects) {
        effects.push(...collectEffects(e as AnyEffect));
      }
      break;
    case 'Conditional':
      effects.push(...collectEffects((effect as ConditionalEffect<unknown>).condition as AnyEffect));
      effects.push(...collectEffects((effect as ConditionalEffect<unknown>).onTrue as AnyEffect));
      if ((effect as ConditionalEffect<unknown>).onFalse) {
        effects.push(...collectEffects((effect as ConditionalEffect<unknown>).onFalse as AnyEffect));
      }
      break;
    case 'Retry':
    case 'Timeout':
    case 'Cache':
      effects.push(...collectEffects((effect as RetryEffect<unknown>).effect as AnyEffect));
      break;
  }

  return effects;
}
