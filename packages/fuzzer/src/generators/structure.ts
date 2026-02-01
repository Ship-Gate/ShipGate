// ============================================================================
// Structure Fuzzing Generator
// Generates object, array, and structural edge cases
// ============================================================================

import { FuzzContext, GeneratedValue } from '../types.js';

/**
 * Prototype pollution payloads
 */
export const PROTOTYPE_POLLUTION_PAYLOADS = [
  { __proto__: { admin: true } },
  { constructor: { prototype: { admin: true } } },
  { '__proto__.admin': true },
  { 'constructor.prototype.admin': true },
  JSON.parse('{"__proto__": {"admin": true}}'),
];

/**
 * Object key edge cases
 */
export const OBJECT_KEY_EDGE_CASES = [
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
  'length',
  'caller',
  'callee',
  'arguments',
  '',
  ' ',
  '\x00',
  '0',
  '-1',
  'NaN',
  'Infinity',
  'undefined',
  'null',
  'true',
  'false',
];

/**
 * Generate fuzzed arrays
 */
export function* generateArrays<T>(
  elementGenerator: (ctx: FuzzContext) => Generator<GeneratedValue<T>>,
  ctx: FuzzContext
): Generator<GeneratedValue<T[]>> {
  // Empty array
  yield { value: [], category: 'boundary', description: 'Empty array' };

  // Single element
  const elemCtx = { ...ctx, iterations: 1 };
  for (const elem of elementGenerator(elemCtx)) {
    yield { value: [elem.value], category: 'structure', description: 'Single element array' };
  }

  // Length boundaries
  if (ctx.constraints?.maxLength) {
    const maxLen = ctx.constraints.maxLength as number;
    const elements: T[] = [];
    for (const elem of elementGenerator(elemCtx)) {
      elements.push(elem.value);
      if (elements.length >= maxLen + 1) break;
    }
    
    if (elements.length >= maxLen - 1) {
      yield { value: elements.slice(0, maxLen - 1), category: 'boundary', description: `Array length ${maxLen - 1}` };
    }
    if (elements.length >= maxLen) {
      yield { value: elements.slice(0, maxLen), category: 'boundary', description: `Array length ${maxLen} (max)` };
    }
    if (elements.length >= maxLen + 1) {
      yield { value: elements.slice(0, maxLen + 1), category: 'boundary', description: `Array length ${maxLen + 1} (over)` };
    }
  }

  if (ctx.constraints?.minLength) {
    const minLen = ctx.constraints.minLength as number;
    if (minLen > 0) {
      const elements: T[] = [];
      for (const elem of elementGenerator(elemCtx)) {
        elements.push(elem.value);
        if (elements.length >= minLen + 1) break;
      }
      
      yield { value: elements.slice(0, minLen - 1), category: 'boundary', description: `Array length ${minLen - 1} (under)` };
      yield { value: elements.slice(0, minLen), category: 'boundary', description: `Array length ${minLen} (min)` };
    }
  }

  // Large arrays
  const largeCtx = { ...ctx, iterations: 1000 };
  const largeElements: T[] = [];
  for (const elem of elementGenerator(largeCtx)) {
    largeElements.push(elem.value);
    if (largeElements.length >= 1000) break;
  }
  yield { value: largeElements, category: 'stress', description: 'Large array (1000 elements)' };

  // Duplicate elements
  if (largeElements.length > 0) {
    const duplicate = Array(100).fill(largeElements[0]);
    yield { value: duplicate as T[], category: 'structure', description: 'All same elements' };
  }

  // Sparse array
  const sparse: T[] = [];
  sparse[0] = largeElements[0] as T;
  sparse[100] = largeElements[0] as T;
  yield { value: sparse, category: 'structure', description: 'Sparse array' };
}

/**
 * Generate fuzzed objects
 */
export function* generateObjects<T>(
  valueGenerator: (ctx: FuzzContext) => Generator<GeneratedValue<T>>,
  ctx: FuzzContext
): Generator<GeneratedValue<Record<string, T>>> {
  // Empty object
  yield { value: {}, category: 'boundary', description: 'Empty object' };

  // Single property
  const valCtx = { ...ctx, iterations: 1 };
  for (const val of valueGenerator(valCtx)) {
    yield { value: { key: val.value }, category: 'structure', description: 'Single property object' };
  }

  // Edge case keys
  for (const key of OBJECT_KEY_EDGE_CASES) {
    for (const val of valueGenerator(valCtx)) {
      try {
        const obj: Record<string, T> = {};
        obj[key] = val.value;
        yield { value: obj, category: 'security', description: `Key: "${key}"` };
      } catch {
        // Some keys might cause issues, that's the point
      }
      break; // Only need one value per key
    }
  }

  // Many properties
  const manyProps: Record<string, T> = {};
  let i = 0;
  for (const val of valueGenerator({ ...ctx, iterations: 100 })) {
    manyProps[`key${i++}`] = val.value;
    if (i >= 100) break;
  }
  yield { value: manyProps, category: 'stress', description: 'Many properties (100)' };

  // Very long keys
  for (const val of valueGenerator(valCtx)) {
    yield { value: { ['k'.repeat(10000)]: val.value }, category: 'stress', description: 'Very long key' };
    break;
  }

  // Numeric string keys
  for (const val of valueGenerator(valCtx)) {
    yield { value: { '0': val.value }, category: 'structure', description: 'Numeric string key "0"' };
    yield { value: { '-1': val.value }, category: 'structure', description: 'Negative numeric key "-1"' };
    yield { value: { '1e10': val.value }, category: 'structure', description: 'Scientific notation key' };
    break;
  }
}

/**
 * Generate fuzzed maps
 */
export function* generateMaps<K, V>(
  keyGenerator: (ctx: FuzzContext) => Generator<GeneratedValue<K>>,
  valueGenerator: (ctx: FuzzContext) => Generator<GeneratedValue<V>>,
  ctx: FuzzContext
): Generator<GeneratedValue<Map<K, V>>> {
  // Empty map
  yield { value: new Map(), category: 'boundary', description: 'Empty map' };

  // Single entry
  const keyCtx = { ...ctx, iterations: 1 };
  const valCtx = { ...ctx, iterations: 1 };
  
  for (const key of keyGenerator(keyCtx)) {
    for (const val of valueGenerator(valCtx)) {
      const map = new Map<K, V>();
      map.set(key.value, val.value);
      yield { value: map, category: 'structure', description: 'Single entry map' };
      break;
    }
    break;
  }

  // Large map
  const largeMap = new Map<K, V>();
  const keys: K[] = [];
  const values: V[] = [];
  
  for (const key of keyGenerator({ ...ctx, iterations: 100 })) {
    keys.push(key.value);
  }
  for (const val of valueGenerator({ ...ctx, iterations: 100 })) {
    values.push(val.value);
  }
  
  for (let i = 0; i < Math.min(keys.length, values.length); i++) {
    largeMap.set(keys[i]!, values[i]!);
  }
  yield { value: largeMap, category: 'stress', description: `Large map (${largeMap.size} entries)` };
}

/**
 * Generate nested structures
 */
export function* generateNestedStructures(
  ctx: FuzzContext,
  depth: number = 0
): Generator<GeneratedValue<unknown>> {
  const maxDepth = ctx.constraints?.maxDepth as number ?? 10;
  
  if (depth >= maxDepth) {
    yield { value: null, category: 'boundary', description: 'Max depth reached' };
    return;
  }

  // Nested arrays
  const nested: unknown[] = [];
  let current: unknown[] = nested;
  for (let i = 0; i < maxDepth + 1; i++) {
    const inner: unknown[] = [];
    current.push(inner);
    current = inner;
  }
  yield { value: nested, category: 'structure', description: `Deeply nested array (${maxDepth + 1} levels)` };

  // Nested objects
  let obj: Record<string, unknown> = {};
  const root = obj;
  for (let i = 0; i < maxDepth + 1; i++) {
    const inner: Record<string, unknown> = {};
    obj.nested = inner;
    obj = inner;
  }
  yield { value: root, category: 'structure', description: `Deeply nested object (${maxDepth + 1} levels)` };

  // Mixed nesting
  const mixed: unknown = {
    array: [
      { nested: [{ deep: { array: [1, 2, [3, [4, [5]]]] } }] }
    ],
    object: {
      a: { b: { c: { d: { e: { f: 'deep' } } } } }
    }
  };
  yield { value: mixed, category: 'structure', description: 'Mixed deep nesting' };
}

/**
 * Generate circular reference structures (for testing)
 */
export function generateCircularReference(): GeneratedValue<unknown> {
  const obj: Record<string, unknown> = { name: 'circular' };
  obj.self = obj;
  return { value: obj, category: 'structure', description: 'Circular reference' };
}

/**
 * Generate array with circular reference
 */
export function generateCircularArray(): GeneratedValue<unknown> {
  const arr: unknown[] = [1, 2, 3];
  arr.push(arr);
  return { value: arr, category: 'structure', description: 'Circular array' };
}

/**
 * Mutate an object structure
 */
export function mutateObject<T extends Record<string, unknown>>(
  obj: T,
  rng?: () => number
): T {
  const random = rng ?? Math.random;
  const result = { ...obj };
  const keys = Object.keys(result);

  const mutations = [
    // Delete random key
    () => {
      if (keys.length > 0) {
        const key = keys[Math.floor(random() * keys.length)]!;
        delete result[key];
      }
    },
    // Add random key
    () => {
      const newKey = `fuzz_${Math.floor(random() * 1000)}`;
      (result as Record<string, unknown>)[newKey] = null;
    },
    // Set key to null
    () => {
      if (keys.length > 0) {
        const key = keys[Math.floor(random() * keys.length)]!;
        (result as Record<string, unknown>)[key] = null;
      }
    },
    // Set key to undefined
    () => {
      if (keys.length > 0) {
        const key = keys[Math.floor(random() * keys.length)]!;
        (result as Record<string, unknown>)[key] = undefined;
      }
    },
    // Wrap value in array
    () => {
      if (keys.length > 0) {
        const key = keys[Math.floor(random() * keys.length)]!;
        (result as Record<string, unknown>)[key] = [result[key]];
      }
    },
    // Change type
    () => {
      if (keys.length > 0) {
        const key = keys[Math.floor(random() * keys.length)]!;
        const current = result[key];
        if (typeof current === 'string') {
          (result as Record<string, unknown>)[key] = 123;
        } else if (typeof current === 'number') {
          (result as Record<string, unknown>)[key] = 'string';
        } else if (typeof current === 'boolean') {
          (result as Record<string, unknown>)[key] = 0;
        }
      }
    },
  ];

  const mutation = mutations[Math.floor(random() * mutations.length)]!;
  mutation();
  
  return result;
}

/**
 * Mutate an array structure
 */
export function mutateArray<T>(arr: T[], rng?: () => number): T[] {
  const random = rng ?? Math.random;
  const result = [...arr];

  const mutations = [
    // Remove element
    () => {
      if (result.length > 0) {
        result.splice(Math.floor(random() * result.length), 1);
      }
    },
    // Duplicate element
    () => {
      if (result.length > 0) {
        const idx = Math.floor(random() * result.length);
        result.splice(idx, 0, result[idx]!);
      }
    },
    // Shuffle
    () => {
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j]!, result[i]!];
      }
    },
    // Reverse
    () => {
      result.reverse();
    },
    // Add null
    () => {
      result.push(null as T);
    },
    // Add undefined
    () => {
      result.push(undefined as T);
    },
    // Clear
    () => {
      result.length = 0;
    },
  ];

  const mutation = mutations[Math.floor(random() * mutations.length)]!;
  mutation();
  
  return result;
}
