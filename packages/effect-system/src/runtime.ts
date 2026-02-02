/**
 * Effect System Runtime
 * 
 * Runtime for parsing, executing, and managing effects in ISL specifications.
 */

import type {
  Effect,
  EffectSignature,
  ISLEffectAnnotation,
  EffectKind,
  Handler,
  FullHandler,
  Fiber,
} from './types';

// ============================================
// Effect Parsing
// ============================================

/**
 * Parse effect annotations from behavior source
 */
export function parseEffectAnnotations(behaviorSource: string): EffectSignature {
  const effects: ISLEffectAnnotation[] = [];
  const lines = behaviorSource.split('\n');
  let behaviorName = 'unknown';

  for (const line of lines) {
    const trimmed = line.trim();

    // Extract behavior name
    const behaviorMatch = trimmed.match(/^behavior\s+(\w+)/);
    if (behaviorMatch && behaviorMatch[1]) {
      behaviorName = behaviorMatch[1];
      continue;
    }

    // Parse effect annotations (# effect: kind)
    const effectMatch = trimmed.match(/^#\s*effect:\s*(\w+)\s*(?:\(([^)]*)\))?/i);
    if (effectMatch && effectMatch[1]) {
      const name = effectMatch[1];
      const options = effectMatch[2];
      effects.push(parseEffectLine(name, options));
      continue;
    }

    // Parse @effect decorator style
    const decoratorMatch = trimmed.match(/^@effect\s*\(\s*['"](\w+)['"]/);
    if (decoratorMatch && decoratorMatch[1]) {
      effects.push({
        name: decoratorMatch[1],
        kind: inferEffectKind(decoratorMatch[1]),
        reversible: false,
        idempotent: false,
      });
    }

    // Infer effects from code patterns
    const inferredEffects = inferEffectsFromCode(trimmed);
    for (const effect of inferredEffects) {
      if (!effects.some(e => e.name === effect.name)) {
        effects.push(effect);
      }
    }
  }

  return {
    behavior: behaviorName,
    effects,
    pure: effects.length === 0,
  };
}

/**
 * Parse a single effect line
 */
function parseEffectLine(name: string, options?: string): ISLEffectAnnotation {
  const annotation: ISLEffectAnnotation = {
    name: name.toLowerCase(),
    kind: inferEffectKind(name),
    reversible: false,
    idempotent: false,
  };

  if (options) {
    const parts = options.split(',').map(p => p.trim());
    for (const part of parts) {
      if (part === 'reversible') annotation.reversible = true;
      if (part === 'idempotent') annotation.idempotent = true;
      if (part.startsWith('desc:')) {
        annotation.description = part.slice(5).trim();
      }
    }
  }

  return annotation;
}

/**
 * Infer effect kind from name
 */
function inferEffectKind(name: string): EffectKind {
  const kindMap: Record<string, EffectKind> = {
    console: 'io',
    log: 'logging',
    logging: 'logging',
    file: 'io',
    filesystem: 'io',
    fs: 'io',
    network: 'io',
    http: 'io',
    fetch: 'io',
    database: 'io',
    db: 'io',
    sql: 'io',
    time: 'io',
    random: 'nondeterminism',
    state: 'state',
    error: 'exception',
    exception: 'exception',
    throw: 'exception',
    async: 'async',
    promise: 'async',
    concurrent: 'async',
    metrics: 'metrics',
    resource: 'resource',
  };

  return kindMap[name.toLowerCase()] || 'custom';
}

/**
 * Infer effects from code patterns
 */
function inferEffectsFromCode(code: string): ISLEffectAnnotation[] {
  const effects: ISLEffectAnnotation[] = [];

  const patterns: Array<{ pattern: RegExp; effect: ISLEffectAnnotation }> = [
    {
      pattern: /\bconsole\.(log|error|warn|info)\b/,
      effect: { name: 'console', kind: 'io', reversible: false, idempotent: true },
    },
    {
      pattern: /\b(fetch|axios|http\.request)\b/,
      effect: { name: 'network', kind: 'io', reversible: false, idempotent: false },
    },
    {
      pattern: /\b(fs\.|readFile|writeFile|unlink)\b/,
      effect: { name: 'filesystem', kind: 'io', reversible: false, idempotent: false },
    },
    {
      pattern: /\bMath\.random\b|\bcrypto\.random/,
      effect: { name: 'random', kind: 'nondeterminism', reversible: true, idempotent: false },
    },
    {
      pattern: /\b(Date\.now|new Date)\b/,
      effect: { name: 'time', kind: 'io', reversible: false, idempotent: false },
    },
    {
      pattern: /\bthrow\s+new\s+\w+Error\b/,
      effect: { name: 'error', kind: 'exception', reversible: true, idempotent: true },
    },
    {
      pattern: /\b(async|await|Promise)\b/,
      effect: { name: 'async', kind: 'async', reversible: true, idempotent: false },
    },
  ];

  for (const { pattern, effect } of patterns) {
    if (pattern.test(code)) {
      effects.push(effect);
    }
  }

  return effects;
}

// ============================================
// Effect Runtime
// ============================================

/**
 * Effect runtime state
 */
export interface EffectRuntimeState {
  handlers: Map<string, (payload: unknown, resume: (value: unknown) => unknown) => unknown>;
  fibers: Map<string, Fiber>;
  interceptors: EffectInterceptor[];
}

/**
 * Effect interceptor
 */
export interface EffectInterceptor {
  before?: (effect: Effect) => Effect | Promise<Effect>;
  after?: (effect: Effect, result: unknown) => unknown | Promise<unknown>;
  onError?: (effect: Effect, error: Error) => void | Promise<void>;
}

/**
 * Create a new effect runtime
 */
export function createEffectRuntime(): EffectRuntimeState {
  return {
    handlers: new Map(),
    fibers: new Map(),
    interceptors: [],
  };
}

/**
 * Register an effect handler
 */
export function registerEffectHandler<E extends Effect, R>(
  runtime: EffectRuntimeState,
  tag: string,
  handler: (payload: E['payload'], resume: (value: unknown) => R) => R
): void {
  runtime.handlers.set(tag, handler as (payload: unknown, resume: (value: unknown) => unknown) => unknown);
}

/**
 * Add an interceptor
 */
export function addInterceptor(
  runtime: EffectRuntimeState,
  interceptor: EffectInterceptor
): void {
  runtime.interceptors.push(interceptor);
}

/**
 * Perform an effect
 */
export async function perform<T>(
  runtime: EffectRuntimeState,
  effect: Effect<unknown>
): Promise<T> {
  // Run before interceptors
  let processedEffect = effect;
  for (const interceptor of runtime.interceptors) {
    if (interceptor.before) {
      processedEffect = await interceptor.before(processedEffect);
    }
  }

  const handler = runtime.handlers.get(processedEffect._tag);
  if (!handler) {
    throw new UnhandledEffectError(processedEffect._tag);
  }

  try {
    let result = await new Promise<unknown>((resolve) => {
      handler(processedEffect.payload, resolve);
    });

    // Run after interceptors
    for (const interceptor of runtime.interceptors) {
      if (interceptor.after) {
        result = await interceptor.after(processedEffect, result);
      }
    }

    return result as T;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    
    // Run error interceptors
    for (const interceptor of runtime.interceptors) {
      if (interceptor.onError) {
        await interceptor.onError(processedEffect, error);
      }
    }
    
    throw error;
  }
}

/**
 * Run an effectful computation with a handler
 */
export async function runWithHandler<E extends Effect, A, R>(
  computation: () => Generator<E, A, unknown>,
  handler: FullHandler<E, A, R>
): Promise<R> {
  const gen = computation();
  let result = gen.next();

  while (!result.done) {
    const effect = result.value as E;
    const tag = effect._tag as keyof Handler<E, R>;
    const effectHandler = handler.handlers[tag];
    
    if (!effectHandler) {
      throw new UnhandledEffectError(effect._tag);
    }

    const value = await new Promise<unknown>((resume) => {
      effectHandler(effect.payload as never, resume as (value: unknown) => R);
    });
    
    result = gen.next(value);
  }

  return handler.return(result.value);
}

// ============================================
// Fiber Management
// ============================================

/**
 * Create a new fiber
 */
export function createFiber(id: string): Fiber {
  return {
    id,
    status: 'running',
  };
}

/**
 * Complete a fiber
 */
export function completeFiber(fiber: Fiber, result: unknown): void {
  fiber.status = 'completed';
  fiber.result = result;
}

/**
 * Fail a fiber
 */
export function failFiber(fiber: Fiber, error: Error): void {
  fiber.status = 'failed';
  fiber.error = error;
}

/**
 * Fork a computation into a new fiber
 */
export function fork<T>(
  runtime: EffectRuntimeState,
  computation: () => Promise<T>
): Fiber {
  const id = `fiber_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const fiber = createFiber(id);
  runtime.fibers.set(id, fiber);

  computation()
    .then((result) => completeFiber(fiber, result))
    .catch((error) => failFiber(fiber, error instanceof Error ? error : new Error(String(error))));

  return fiber;
}

/**
 * Wait for a fiber to complete
 */
export async function join<T>(fiber: Fiber): Promise<T> {
  while (fiber.status === 'running') {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  if (fiber.status === 'failed') {
    throw fiber.error;
  }

  return fiber.result as T;
}

// ============================================
// Errors
// ============================================

/**
 * Error thrown when an effect is not handled
 */
export class UnhandledEffectError extends Error {
  constructor(public effectTag: string) {
    super(`Effect '${effectTag}' is not handled`);
    this.name = 'UnhandledEffectError';
  }
}

/**
 * Error thrown when effect execution fails
 */
export class EffectExecutionError extends Error {
  constructor(
    public effectTag: string,
    public cause: Error
  ) {
    super(`Effect '${effectTag}' execution failed: ${cause.message}`);
    this.name = 'EffectExecutionError';
  }
}
