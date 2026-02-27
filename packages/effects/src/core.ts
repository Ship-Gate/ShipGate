// ============================================================================
// ISL Effect System - Core Implementation
// ============================================================================

import type {
  AlgebraicEffect,
  EffectSet,
  EffectRef,
  AlgebraicEffectHandler,
  EffectContext,
  EffectScope,
  EffectFrame,
  EffectAlgebra,
  EffectInference,
  EffectError,
} from './types.js';

/**
 * Effect algebra implementation
 */
export const effectAlgebra: EffectAlgebra = {
  union(a: EffectSet, b: EffectSet): EffectSet {
    if (a.pure && b.pure) {
      return { effects: [], pure: true };
    }

    const combined = new Map<string, Set<string>>();

    for (const ref of [...a.effects, ...b.effects]) {
      const ops = combined.get(ref.effect) ?? new Set();
      if (ref.operations) {
        ref.operations.forEach(op => ops.add(op));
      } else {
        ops.add('*'); // All operations
      }
      combined.set(ref.effect, ops);
    }

    const effects: EffectRef[] = [];
    for (const [effect, ops] of combined) {
      if (ops.has('*')) {
        effects.push({ effect });
      } else {
        effects.push({ effect, operations: Array.from(ops) });
      }
    }

    return { effects, pure: false };
  },

  subtract(total: EffectSet, handled: EffectSet): EffectSet {
    const handledEffects = new Set(handled.effects.map(e => e.effect));
    const remaining = total.effects.filter(e => !handledEffects.has(e.effect));

    return {
      effects: remaining,
      pure: remaining.length === 0,
    };
  },

  isSubset(subset: EffectSet, superset: EffectSet): boolean {
    if (subset.pure) return true;

    const superEffects = new Set(superset.effects.map(e => e.effect));
    return subset.effects.every(e => superEffects.has(e.effect));
  },

  isPure(effects: EffectSet): boolean {
    return effects.pure === true || effects.effects.length === 0;
  },

  empty(): EffectSet {
    return { effects: [], pure: true };
  },
};

/**
 * Create a new effect scope
 */
export function createScope(parent?: EffectScope): EffectScope {
  return {
    id: generateScopeId(),
    parent,
    handlers: new Map(),
    resources: new Map(),
  };
}

/**
 * Create effect context
 */
export function createContext(): EffectContext {
  return {
    scope: createScope(),
    stack: [],
    handlers: new Map(),
  };
}

/**
 * Register an effect handler
 */
export function registerHandler(
  ctx: EffectContext,
  handler: AlgebraicEffectHandler
): void {
  const key = `${handler.effect}.${handler.operation}`;
  const handlers = ctx.handlers.get(key) ?? [];
  handlers.push(handler);
  ctx.handlers.set(key, handlers);
  ctx.scope.handlers.set(key, handler);
}

/**
 * Find handler for effect operation
 */
export function findHandler(
  ctx: EffectContext,
  effect: string,
  operation: string
): AlgebraicEffectHandler | undefined {
  const key = `${effect}.${operation}`;
  
  // Search current scope and parents
  let scope: EffectScope | undefined = ctx.scope;
  while (scope) {
    const handler = scope.handlers.get(key);
    if (handler) return handler;
    scope = scope.parent;
  }

  // Search global handlers
  const handlers = ctx.handlers.get(key);
  return handlers?.[handlers.length - 1];
}

/**
 * Perform an effect operation
 */
export async function perform<T>(
  ctx: EffectContext,
  effect: string,
  operation: string,
  ...args: unknown[]
): Promise<T> {
  const handler = findHandler(ctx, effect, operation);

  if (!handler) {
    throw new EffectNotHandledError(effect, operation);
  }

  // Push frame onto stack
  const frame: EffectFrame = { effect, operation, args };
  ctx.stack.push(frame);

  try {
    const result = await executeHandler<T>(handler, args, ctx);
    return result;
  } finally {
    ctx.stack.pop();
  }
}

/**
 * Execute a handler
 */
async function executeHandler<T>(
  handler: AlgebraicEffectHandler,
  args: unknown[],
  ctx: EffectContext
): Promise<T> {
  switch (handler.implementation.kind) {
    case 'Native':
      return handler.implementation.fn(...args) as T;

    case 'Pure':
      return handler.implementation.value as T;

    case 'Transform':
      return perform<T>(
        ctx,
        handler.implementation.targetEffect,
        handler.implementation.targetOperation,
        ...args
      );

    case 'Resume':
      const frame = ctx.stack[ctx.stack.length - 1];
      if (frame?.continuation) {
        const value = await Promise.resolve(args[0]);
        const transformed = handler.implementation.transform
          ? handler.implementation.transform(value)
          : value;
        return frame.continuation(transformed) as T;
      }
      return args[0] as T;

    default:
      throw new Error(`Unknown handler kind`);
  }
}

/**
 * Run an effectful computation with handlers
 */
export async function runWith<T>(
  computation: () => T | Promise<T>,
  handlers: AlgebraicEffectHandler[],
  parentCtx?: EffectContext
): Promise<T> {
  const ctx = parentCtx ?? createContext();
  const childScope = createScope(ctx.scope);
  const originalScope = ctx.scope;
  ctx.scope = childScope;

  // Register handlers
  for (const handler of handlers) {
    registerHandler(ctx, handler);
  }

  try {
    return await computation();
  } finally {
    ctx.scope = originalScope;
  }
}

/**
 * Run a pure computation
 */
export function runPure<T>(computation: () => T): T {
  return computation();
}

/**
 * Infer effects from an AST
 */
export function inferEffects(ast: unknown): EffectInference {
  const effects: EffectRef[] = [];
  const errors: EffectError[] = [];

  // Walk the AST and collect effects
  walkAst(ast, (node) => {
    const nodeEffects = getNodeEffects(node);
    effects.push(...nodeEffects);
  });

  // Deduplicate effects
  const dedupedEffects = deduplicateEffects(effects);

  return {
    success: errors.length === 0,
    effects: {
      effects: dedupedEffects,
      pure: dedupedEffects.length === 0,
    },
    errors,
    warnings: [],
  };
}

/**
 * Check if effects are handled
 */
export function checkEffectsHandled(
  required: EffectSet,
  provided: AlgebraicEffectHandler[]
): EffectError[] {
  const errors: EffectError[] = [];
  const handledEffects = new Set(provided.map(h => h.effect));

  for (const ref of required.effects) {
    if (!handledEffects.has(ref.effect)) {
      errors.push({
        kind: 'UnhandledEffect',
        message: `Effect '${ref.effect}' is not handled`,
        effect: ref,
      });
    }
  }

  return errors;
}

/**
 * Validate effect handlers
 */
export function validateHandlers(handlers: AlgebraicEffectHandler[]): EffectError[] {
  const errors: EffectError[] = [];
  const seen = new Set<string>();

  for (const handler of handlers) {
    const key = `${handler.effect}.${handler.operation}`;
    
    if (seen.has(key)) {
      // Duplicate handler - last one wins, but warn
    }
    seen.add(key);
  }

  return errors;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateScopeId(): string {
  return `scope_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function walkAst(ast: unknown, visitor: (node: unknown) => void): void {
  if (!ast || typeof ast !== 'object') return;

  visitor(ast);

  if (Array.isArray(ast)) {
    for (const item of ast) {
      walkAst(item, visitor);
    }
  } else {
    for (const value of Object.values(ast)) {
      walkAst(value, visitor);
    }
  }
}

function getNodeEffects(node: unknown): EffectRef[] {
  if (!node || typeof node !== 'object') return [];

  const n = node as Record<string, unknown>;

  // Check for effect annotations
  if (n.effects && Array.isArray(n.effects)) {
    return n.effects as EffectRef[];
  }

  // Check for known effectful operations
  if (n.kind === 'CallExpression') {
    const callee = n.callee as Record<string, unknown> | undefined;
    if (callee?.name) {
      const name = callee.name as string;
      // Known effectful functions
      if (['fetch', 'readFile', 'writeFile', 'console.log'].includes(name)) {
        return [{ effect: 'IO' }];
      }
      if (['setTimeout', 'setInterval', 'Promise'].includes(name)) {
        return [{ effect: 'Async' }];
      }
      if (['Math.random', 'crypto.random'].includes(name)) {
        return [{ effect: 'Random' }];
      }
    }
  }

  return [];
}

function deduplicateEffects(effects: EffectRef[]): EffectRef[] {
  const map = new Map<string, EffectRef>();

  for (const effect of effects) {
    const existing = map.get(effect.effect);
    if (existing) {
      // Merge operations
      if (effect.operations && existing.operations) {
        const ops = new Set([...existing.operations, ...effect.operations]);
        existing.operations = Array.from(ops);
      } else {
        // If either has all operations, use that
        existing.operations = undefined;
      }
    } else {
      map.set(effect.effect, { ...effect });
    }
  }

  return Array.from(map.values());
}

// ============================================================================
// Errors
// ============================================================================

export class EffectNotHandledError extends Error {
  constructor(public effect: string, public operation: string) {
    super(`Effect '${effect}.${operation}' is not handled`);
    this.name = 'EffectNotHandledError';
  }
}

export class ResourceLeakError extends Error {
  constructor(public resource: string) {
    super(`Resource '${resource}' was not properly released`);
    this.name = 'ResourceLeakError';
  }
}
