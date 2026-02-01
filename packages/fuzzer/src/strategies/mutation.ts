// ============================================================================
// Mutation Fuzzing Strategy
// Mutate valid inputs to find edge cases
// ============================================================================

import { FuzzContext, GeneratedValue, CorpusEntry, createRng } from '../types.js';
import { mutateString } from '../generators/string.js';
import { mutateNumber } from '../generators/number.js';
import { mutateObject, mutateArray } from '../generators/structure.js';

/**
 * Mutation strategy configuration
 */
export interface MutationStrategyConfig {
  /** Seed for reproducibility */
  seed?: string;
  
  /** Maximum mutations per input */
  maxMutationsPerInput?: number;
  
  /** Mutation probability per field */
  mutationProbability?: number;
  
  /** Maximum recursion depth */
  maxDepth?: number;
  
  /** Stack multiple mutations */
  stackMutations?: boolean;
  
  /** Number of stacked mutations */
  stackCount?: number;
}

/**
 * Available mutation operations
 */
export type MutationOp =
  | 'delete'       // Delete a field/element
  | 'duplicate'    // Duplicate a field/element
  | 'replace'      // Replace with different type
  | 'modify'       // Modify the value
  | 'nullify'      // Set to null
  | 'empty'        // Set to empty (string/array/object)
  | 'swap'         // Swap with another field
  | 'inject'       // Inject special values
  | 'corrupt'      // Corrupt the structure;

/**
 * Generate mutated values from corpus
 */
export function* generateMutations(
  corpus: CorpusEntry[],
  ctx: FuzzContext,
  config: MutationStrategyConfig = {}
): Generator<GeneratedValue<unknown>> {
  const rng = ctx.rng ?? createRng(config.seed ?? Date.now().toString());
  const maxMutations = config.maxMutationsPerInput ?? 10;
  const mutationProb = config.mutationProbability ?? 0.3;
  const stackMutations = config.stackMutations ?? true;
  const stackCount = config.stackCount ?? 3;

  for (const entry of corpus) {
    // Generate multiple mutations per corpus entry
    for (let i = 0; i < maxMutations; i++) {
      let mutated = entry.input;
      const operations: string[] = [];

      // Possibly stack multiple mutations
      const numMutations = stackMutations ? Math.floor(rng() * stackCount) + 1 : 1;
      
      for (let j = 0; j < numMutations; j++) {
        const result = mutateValue(mutated, rng, mutationProb);
        mutated = result.value;
        operations.push(result.operation);
      }

      yield {
        value: mutated,
        category: 'mutation',
        description: `Mutated: ${operations.join(' -> ')}`,
      };
    }
  }
}

/**
 * Mutate a single value
 */
export function mutateValue(
  value: unknown,
  rng: () => number,
  probability: number = 0.3
): { value: unknown; operation: string } {
  // Maybe don't mutate
  if (rng() > probability) {
    return { value, operation: 'identity' };
  }

  if (value === null || value === undefined) {
    return mutateNullish(rng);
  }

  if (typeof value === 'string') {
    return mutateStringValue(value, rng);
  }

  if (typeof value === 'number') {
    return mutateNumberValue(value, rng);
  }

  if (typeof value === 'boolean') {
    return mutateBooleanValue(value, rng);
  }

  if (Array.isArray(value)) {
    return mutateArrayValue(value, rng, probability);
  }

  if (typeof value === 'object') {
    return mutateObjectValue(value as Record<string, unknown>, rng, probability);
  }

  return { value, operation: 'identity' };
}

/**
 * Mutate null/undefined values
 */
function mutateNullish(rng: () => number): { value: unknown; operation: string } {
  const mutations = [
    { value: null, operation: 'null' },
    { value: undefined, operation: 'undefined' },
    { value: '', operation: 'empty_string' },
    { value: 0, operation: 'zero' },
    { value: false, operation: 'false' },
    { value: [], operation: 'empty_array' },
    { value: {}, operation: 'empty_object' },
    { value: NaN, operation: 'nan' },
  ];
  return mutations[Math.floor(rng() * mutations.length)]!;
}

/**
 * Mutate string values
 */
function mutateStringValue(
  value: string,
  rng: () => number
): { value: unknown; operation: string } {
  const mutations = [
    // Type change
    () => ({ value: parseInt(value) || 0, operation: 'to_number' }),
    () => ({ value: value === 'true' || value.length > 0, operation: 'to_boolean' }),
    () => ({ value: null, operation: 'to_null' }),
    () => ({ value: [value], operation: 'to_array' }),
    () => ({ value: { value }, operation: 'to_object' }),
    
    // String mutations
    () => ({ value: '', operation: 'empty' }),
    () => ({ value: mutateString(value, rng), operation: 'mutate_string' }),
    () => ({ value: value + value, operation: 'duplicate' }),
    () => ({ value: value.toUpperCase(), operation: 'uppercase' }),
    () => ({ value: value.toLowerCase(), operation: 'lowercase' }),
    () => ({ value: value.split('').reverse().join(''), operation: 'reverse' }),
    () => ({ value: value.trim(), operation: 'trim' }),
    () => ({ value: ' ' + value + ' ', operation: 'pad_spaces' }),
    () => ({ value: value + '\x00', operation: 'append_null' }),
    () => ({ value: '\x00' + value, operation: 'prepend_null' }),
    () => ({ value: value.replace(/./g, ''), operation: 'clear' }),
    () => ({ value: 'a'.repeat(value.length * 10), operation: 'enlarge' }),
  ];

  return mutations[Math.floor(rng() * mutations.length)]!();
}

/**
 * Mutate number values
 */
function mutateNumberValue(
  value: number,
  rng: () => number
): { value: unknown; operation: string } {
  const mutations = [
    // Type change
    () => ({ value: String(value), operation: 'to_string' }),
    () => ({ value: value !== 0, operation: 'to_boolean' }),
    () => ({ value: null, operation: 'to_null' }),
    () => ({ value: [value], operation: 'to_array' }),
    
    // Number mutations
    () => ({ value: mutateNumber(value, rng), operation: 'mutate_number' }),
    () => ({ value: -value, operation: 'negate' }),
    () => ({ value: value + 1, operation: 'increment' }),
    () => ({ value: value - 1, operation: 'decrement' }),
    () => ({ value: value * 2, operation: 'double' }),
    () => ({ value: value / 2, operation: 'halve' }),
    () => ({ value: Math.floor(value), operation: 'floor' }),
    () => ({ value: Math.ceil(value), operation: 'ceil' }),
    () => ({ value: 0, operation: 'zero' }),
    () => ({ value: NaN, operation: 'nan' }),
    () => ({ value: Infinity, operation: 'infinity' }),
    () => ({ value: -Infinity, operation: 'neg_infinity' }),
    () => ({ value: Number.MAX_SAFE_INTEGER, operation: 'max_safe' }),
    () => ({ value: Number.MIN_SAFE_INTEGER, operation: 'min_safe' }),
  ];

  return mutations[Math.floor(rng() * mutations.length)]!();
}

/**
 * Mutate boolean values
 */
function mutateBooleanValue(
  value: boolean,
  rng: () => number
): { value: unknown; operation: string } {
  const mutations = [
    () => ({ value: !value, operation: 'negate' }),
    () => ({ value: String(value), operation: 'to_string' }),
    () => ({ value: value ? 1 : 0, operation: 'to_number' }),
    () => ({ value: null, operation: 'to_null' }),
    () => ({ value: undefined, operation: 'to_undefined' }),
    () => ({ value: 'true', operation: 'string_true' }),
    () => ({ value: 'false', operation: 'string_false' }),
    () => ({ value: 1, operation: 'one' }),
    () => ({ value: 0, operation: 'zero' }),
  ];

  return mutations[Math.floor(rng() * mutations.length)]!();
}

/**
 * Mutate array values
 */
function mutateArrayValue(
  value: unknown[],
  rng: () => number,
  probability: number
): { value: unknown; operation: string } {
  const mutations = [
    // Type change
    () => ({ value: null, operation: 'to_null' }),
    () => ({ value: JSON.stringify(value), operation: 'to_string' }),
    () => ({ value: value.length, operation: 'to_length' }),
    () => ({ value: Object.fromEntries(value.map((v, i) => [i, v])), operation: 'to_object' }),
    
    // Array mutations
    () => ({ value: [], operation: 'empty' }),
    () => ({ value: mutateArray(value, rng), operation: 'mutate_array' }),
    () => ({ value: [...value, null], operation: 'append_null' }),
    () => ({ value: [null, ...value], operation: 'prepend_null' }),
    () => ({ value: [...value, undefined], operation: 'append_undefined' }),
    () => ({ value: [...value, ...value], operation: 'duplicate' }),
    () => ({ value: value.slice().reverse(), operation: 'reverse' }),
    () => ({ value: value.slice(0, -1), operation: 'remove_last' }),
    () => ({ value: value.slice(1), operation: 'remove_first' }),
    () => ({ value: Array(1000).fill(value[0]), operation: 'large_same' }),
    () => {
      // Deep mutate elements
      const mutated = value.map(elem => {
        if (rng() < probability) {
          return mutateValue(elem, rng, probability).value;
        }
        return elem;
      });
      return { value: mutated, operation: 'mutate_elements' };
    },
  ];

  return mutations[Math.floor(rng() * mutations.length)]!();
}

/**
 * Mutate object values
 */
function mutateObjectValue(
  value: Record<string, unknown>,
  rng: () => number,
  probability: number
): { value: unknown; operation: string } {
  const keys = Object.keys(value);

  const mutations = [
    // Type change
    () => ({ value: null, operation: 'to_null' }),
    () => ({ value: JSON.stringify(value), operation: 'to_string' }),
    () => ({ value: Object.values(value), operation: 'to_array' }),
    
    // Object mutations
    () => ({ value: {}, operation: 'empty' }),
    () => ({ value: mutateObject(value, rng), operation: 'mutate_object' }),
    () => {
      // Remove random key
      if (keys.length === 0) return { value, operation: 'identity' };
      const result = { ...value };
      delete result[keys[Math.floor(rng() * keys.length)]!];
      return { value: result, operation: 'remove_key' };
    },
    () => {
      // Add extra key
      const result = { ...value, __injected__: 'fuzz' };
      return { value: result, operation: 'add_key' };
    },
    () => {
      // Add prototype pollution
      return { value: { ...value, __proto__: { admin: true } }, operation: 'proto_pollution' };
    },
    () => {
      // Set random key to null
      if (keys.length === 0) return { value, operation: 'identity' };
      const result = { ...value };
      result[keys[Math.floor(rng() * keys.length)]!] = null;
      return { value: result, operation: 'nullify_key' };
    },
    () => {
      // Deep mutate values
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        if (rng() < probability) {
          result[k] = mutateValue(v, rng, probability).value;
        } else {
          result[k] = v;
        }
      }
      return { value: result, operation: 'mutate_values' };
    },
  ];

  return mutations[Math.floor(rng() * mutations.length)]!();
}

/**
 * Apply specific mutation operation
 */
export function applyMutation(
  value: unknown,
  operation: MutationOp,
  rng: () => number
): unknown {
  switch (operation) {
    case 'delete':
      return undefined;
    
    case 'duplicate':
      if (Array.isArray(value)) return [...value, ...value];
      if (typeof value === 'string') return value + value;
      if (typeof value === 'object' && value !== null) {
        return { ...value, __duplicate__: value };
      }
      return value;
    
    case 'replace':
      // Replace with different type
      if (typeof value === 'string') return 123;
      if (typeof value === 'number') return 'string';
      if (typeof value === 'boolean') return 0;
      if (Array.isArray(value)) return {};
      if (typeof value === 'object') return [];
      return null;
    
    case 'modify':
      return mutateValue(value, rng).value;
    
    case 'nullify':
      return null;
    
    case 'empty':
      if (typeof value === 'string') return '';
      if (Array.isArray(value)) return [];
      if (typeof value === 'object') return {};
      return value;
    
    case 'inject':
      if (typeof value === 'string') {
        return value + "'; DROP TABLE users; --";
      }
      return value;
    
    case 'corrupt':
      if (typeof value === 'string') {
        return value.split('').map((c, i) => i % 3 === 0 ? '\x00' : c).join('');
      }
      return value;
    
    default:
      return value;
  }
}
