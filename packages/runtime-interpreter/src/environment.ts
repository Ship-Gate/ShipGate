// ============================================================================
// ISL Runtime Interpreter - Environment Management
// @intentos/runtime-interpreter/environment
// ============================================================================

import type { Environment, Value, TypeDefinition, EffectHandler } from './types';

// ============================================================================
// ENVIRONMENT CONSTRUCTION
// ============================================================================

/**
 * Create a new root environment.
 */
export function createEnvironment(): Environment {
  return {
    parent: null,
    bindings: new Map(),
    types: new Map(),
    effects: new Map(),
  };
}

/**
 * Extend an environment with a new scope.
 */
export function extendEnvironment(parent: Environment): Environment {
  return {
    parent,
    bindings: new Map(),
    types: new Map(),
    effects: new Map(),
  };
}

// ============================================================================
// BINDING OPERATIONS
// ============================================================================

/**
 * Look up a binding in the environment chain.
 */
export function lookupBinding(name: string, env: Environment): Value | undefined {
  let current: Environment | null = env;
  
  while (current !== null) {
    const value = current.bindings.get(name);
    if (value !== undefined) {
      return value;
    }
    current = current.parent;
  }
  
  return undefined;
}

/**
 * Set a binding in the current environment scope.
 */
export function setBinding(name: string, value: Value, env: Environment): void {
  env.bindings.set(name, value);
}

/**
 * Update a binding in the environment chain (mutate existing).
 */
export function updateBinding(name: string, value: Value, env: Environment): boolean {
  let current: Environment | null = env;
  
  while (current !== null) {
    if (current.bindings.has(name)) {
      current.bindings.set(name, value);
      return true;
    }
    current = current.parent;
  }
  
  return false;
}

/**
 * Check if a binding exists in the environment chain.
 */
export function hasBinding(name: string, env: Environment): boolean {
  return lookupBinding(name, env) !== undefined;
}

// ============================================================================
// TYPE OPERATIONS
// ============================================================================

/**
 * Look up a type definition.
 */
export function lookupType(name: string, env: Environment): TypeDefinition | undefined {
  let current: Environment | null = env;
  
  while (current !== null) {
    const typeDef = current.types.get(name);
    if (typeDef !== undefined) {
      return typeDef;
    }
    current = current.parent;
  }
  
  return undefined;
}

/**
 * Register a type definition.
 */
export function registerType(typeDef: TypeDefinition, env: Environment): void {
  env.types.set(typeDef.name, typeDef);
}

// ============================================================================
// EFFECT OPERATIONS
// ============================================================================

/**
 * Look up an effect handler.
 */
export function lookupEffectHandler(effect: string, env: Environment): EffectHandler | undefined {
  let current: Environment | null = env;
  
  while (current !== null) {
    const handler = current.effects.get(effect);
    if (handler !== undefined) {
      return handler;
    }
    current = current.parent;
  }
  
  return undefined;
}

/**
 * Register an effect handler.
 */
export function registerEffectHandler(handler: EffectHandler, env: Environment): void {
  env.effects.set(handler.effect, handler);
}

// ============================================================================
// SCOPE UTILITIES
// ============================================================================

/**
 * Get all bindings in the current scope (not parent scopes).
 */
export function getCurrentBindings(env: Environment): Map<string, Value> {
  return new Map(env.bindings);
}

/**
 * Get all bindings in the entire environment chain.
 */
export function getAllBindings(env: Environment): Map<string, Value> {
  const result = new Map<string, Value>();
  let current: Environment | null = env;
  
  while (current !== null) {
    for (const [name, value] of current.bindings) {
      if (!result.has(name)) {
        result.set(name, value);
      }
    }
    current = current.parent;
  }
  
  return result;
}

/**
 * Get the depth of the environment chain.
 */
export function getEnvironmentDepth(env: Environment): number {
  let depth = 0;
  let current: Environment | null = env;
  
  while (current !== null) {
    depth++;
    current = current.parent;
  }
  
  return depth;
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize an environment to JSON (for debugging).
 */
export function serializeEnvironment(env: Environment): object {
  return {
    bindings: Object.fromEntries(
      Array.from(env.bindings.entries()).map(([k, v]) => [k, serializeValue(v)])
    ),
    types: Array.from(env.types.keys()),
    effects: Array.from(env.effects.keys()),
    parent: env.parent ? serializeEnvironment(env.parent) : null,
  };
}

function serializeValue(value: Value): unknown {
  switch (value.tag) {
    case 'unit':
      return { tag: 'unit' };
    case 'boolean':
      return { tag: 'boolean', value: value.value };
    case 'int':
      return { tag: 'int', value: value.value.toString() };
    case 'float':
      return { tag: 'float', value: value.value };
    case 'string':
      return { tag: 'string', value: value.value };
    case 'list':
      return { tag: 'list', elements: value.elements.map(serializeValue) };
    case 'record':
    case 'entity':
      return {
        tag: value.tag,
        type: value.type,
        fields: Object.fromEntries(
          Array.from(value.fields.entries()).map(([k, v]) => [k, serializeValue(v)])
        ),
      };
    case 'function':
      return { tag: 'function', params: value.params };
    case 'native':
      return { tag: 'native' };
    default:
      return { tag: (value as any).tag };
  }
}
