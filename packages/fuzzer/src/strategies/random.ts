// ============================================================================
// Random Fuzzing Strategy
// Pure random input generation
// ============================================================================

import { FuzzContext, GeneratedValue, ISLTypeInfo, createRng } from '../types.js';
import { generateStrings, mutateString } from '../generators/string.js';
import { generateIntegers, generateFloats, mutateNumber } from '../generators/number.js';
import { mutateObject, mutateArray } from '../generators/structure.js';

/**
 * Random strategy configuration
 */
export interface RandomStrategyConfig {
  /** Seed for reproducibility */
  seed?: string;
  
  /** Bias towards certain types of values */
  bias?: {
    /** Probability of generating strings */
    string?: number;
    /** Probability of generating numbers */
    number?: number;
    /** Probability of generating objects */
    object?: number;
    /** Probability of generating arrays */
    array?: number;
    /** Probability of generating null/undefined */
    nullish?: number;
  };
  
  /** Maximum depth for nested structures */
  maxDepth?: number;
  
  /** Maximum length for strings/arrays */
  maxLength?: number;
}

const DEFAULT_BIAS = {
  string: 0.3,
  number: 0.3,
  object: 0.15,
  array: 0.15,
  nullish: 0.1,
};

/**
 * Generate random values
 */
export function* generateRandom(
  ctx: FuzzContext,
  config: RandomStrategyConfig = {}
): Generator<GeneratedValue<unknown>> {
  const rng = ctx.rng ?? createRng(config.seed ?? Date.now().toString());
  const bias = { ...DEFAULT_BIAS, ...config.bias };
  const iterations = ctx.iterations ?? 100;

  for (let i = 0; i < iterations; i++) {
    const roll = rng();
    let cumulative = 0;

    if ((cumulative += bias.string) > roll) {
      yield* generateRandomString(rng, config.maxLength ?? 1000);
    } else if ((cumulative += bias.number) > roll) {
      yield* generateRandomNumber(rng);
    } else if ((cumulative += bias.object) > roll) {
      yield* generateRandomObject(rng, config.maxDepth ?? 5, config.maxLength ?? 100);
    } else if ((cumulative += bias.array) > roll) {
      yield* generateRandomArray(rng, config.maxDepth ?? 5, config.maxLength ?? 100);
    } else {
      yield* generateNullish(rng);
    }
  }
}

/**
 * Generate random string
 */
function* generateRandomString(
  rng: () => number,
  maxLength: number
): Generator<GeneratedValue<unknown>> {
  const length = Math.floor(rng() * maxLength);
  const charSets = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '0123456789',
    '!@#$%^&*()_+-=[]{}|;:,.<>?',
    '\t\n\r ',
    '\x00\x01\x02\x03\x04\x05',
  ];
  
  let result = '';
  const charSet = charSets[Math.floor(rng() * charSets.length)]!;
  
  for (let i = 0; i < length; i++) {
    if (rng() < 0.1) {
      // Sometimes switch character sets
      const newCharSet = charSets[Math.floor(rng() * charSets.length)]!;
      result += newCharSet.charAt(Math.floor(rng() * newCharSet.length));
    } else {
      result += charSet.charAt(Math.floor(rng() * charSet.length));
    }
  }

  yield { value: result, category: 'random', description: `Random string (${length} chars)` };
}

/**
 * Generate random number
 */
function* generateRandomNumber(rng: () => number): Generator<GeneratedValue<unknown>> {
  const type = rng();
  
  if (type < 0.3) {
    // Integer
    const value = Math.floor(rng() * Number.MAX_SAFE_INTEGER * 2) - Number.MAX_SAFE_INTEGER;
    yield { value, category: 'random', description: 'Random integer' };
  } else if (type < 0.6) {
    // Float
    const value = (rng() * 2 - 1) * 1e10;
    yield { value, category: 'random', description: 'Random float' };
  } else if (type < 0.8) {
    // Small number
    const value = rng() * 100 - 50;
    yield { value, category: 'random', description: 'Random small number' };
  } else if (type < 0.9) {
    // Special values
    const specials = [0, -0, NaN, Infinity, -Infinity, Number.MAX_VALUE, Number.MIN_VALUE];
    yield { value: specials[Math.floor(rng() * specials.length)], category: 'random', description: 'Random special number' };
  } else {
    // Negative
    const value = -Math.floor(rng() * 1000);
    yield { value, category: 'random', description: 'Random negative' };
  }
}

/**
 * Generate random object
 */
function* generateRandomObject(
  rng: () => number,
  maxDepth: number,
  maxLength: number,
  depth: number = 0
): Generator<GeneratedValue<unknown>> {
  const size = Math.floor(rng() * Math.min(10, maxLength));
  const obj: Record<string, unknown> = {};

  for (let i = 0; i < size; i++) {
    const key = generateRandomKey(rng);
    
    if (depth >= maxDepth) {
      obj[key] = generatePrimitiveValue(rng);
    } else {
      const valueType = rng();
      if (valueType < 0.3) {
        obj[key] = generatePrimitiveValue(rng);
      } else if (valueType < 0.5 && depth < maxDepth) {
        for (const nested of generateRandomObject(rng, maxDepth, maxLength, depth + 1)) {
          obj[key] = nested.value;
          break;
        }
      } else if (valueType < 0.7 && depth < maxDepth) {
        for (const nested of generateRandomArray(rng, maxDepth, maxLength, depth + 1)) {
          obj[key] = nested.value;
          break;
        }
      } else {
        obj[key] = generatePrimitiveValue(rng);
      }
    }
  }

  yield { value: obj, category: 'random', description: `Random object (${size} keys)` };
}

/**
 * Generate random array
 */
function* generateRandomArray(
  rng: () => number,
  maxDepth: number,
  maxLength: number,
  depth: number = 0
): Generator<GeneratedValue<unknown>> {
  const size = Math.floor(rng() * Math.min(20, maxLength));
  const arr: unknown[] = [];

  for (let i = 0; i < size; i++) {
    if (depth >= maxDepth) {
      arr.push(generatePrimitiveValue(rng));
    } else {
      const valueType = rng();
      if (valueType < 0.4) {
        arr.push(generatePrimitiveValue(rng));
      } else if (valueType < 0.6 && depth < maxDepth) {
        for (const nested of generateRandomObject(rng, maxDepth, maxLength, depth + 1)) {
          arr.push(nested.value);
          break;
        }
      } else if (valueType < 0.8 && depth < maxDepth) {
        for (const nested of generateRandomArray(rng, maxDepth, maxLength, depth + 1)) {
          arr.push(nested.value);
          break;
        }
      } else {
        arr.push(generatePrimitiveValue(rng));
      }
    }
  }

  yield { value: arr, category: 'random', description: `Random array (${size} elements)` };
}

/**
 * Generate nullish values
 */
function* generateNullish(rng: () => number): Generator<GeneratedValue<unknown>> {
  const values = [null, undefined];
  yield { 
    value: values[Math.floor(rng() * values.length)], 
    category: 'random', 
    description: 'Random nullish' 
  };
}

/**
 * Generate a random object key
 */
function generateRandomKey(rng: () => number): string {
  const type = rng();
  
  if (type < 0.7) {
    // Normal key
    const length = Math.floor(rng() * 20) + 1;
    const chars = 'abcdefghijklmnopqrstuvwxyz_';
    let key = '';
    for (let i = 0; i < length; i++) {
      key += chars.charAt(Math.floor(rng() * chars.length));
    }
    return key;
  } else if (type < 0.8) {
    // Numeric key
    return String(Math.floor(rng() * 100));
  } else if (type < 0.9) {
    // Special key
    const specials = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', ''];
    return specials[Math.floor(rng() * specials.length)]!;
  } else {
    // Unicode key
    return String.fromCharCode(Math.floor(rng() * 65535));
  }
}

/**
 * Generate a random primitive value
 */
function generatePrimitiveValue(rng: () => number): unknown {
  const type = rng();
  
  if (type < 0.25) {
    // String
    const length = Math.floor(rng() * 50);
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789 ';
    let str = '';
    for (let i = 0; i < length; i++) {
      str += chars.charAt(Math.floor(rng() * chars.length));
    }
    return str;
  } else if (type < 0.5) {
    // Number
    return rng() < 0.5 
      ? Math.floor(rng() * 10000) - 5000 
      : rng() * 1000 - 500;
  } else if (type < 0.65) {
    // Boolean
    return rng() < 0.5;
  } else if (type < 0.8) {
    // Null/undefined
    return rng() < 0.5 ? null : undefined;
  } else {
    // Special
    const specials = [NaN, Infinity, -Infinity, '', 0, -0];
    return specials[Math.floor(rng() * specials.length)];
  }
}

/**
 * Mutate an existing value randomly
 */
export function mutateRandomly(value: unknown, rng: () => number): unknown {
  if (typeof value === 'string') {
    return mutateString(value, rng);
  } else if (typeof value === 'number') {
    return mutateNumber(value, rng);
  } else if (Array.isArray(value)) {
    return mutateArray(value, rng);
  } else if (typeof value === 'object' && value !== null) {
    return mutateObject(value as Record<string, unknown>, rng);
  } else if (typeof value === 'boolean') {
    return !value;
  } else {
    // Return random primitive for null/undefined
    return generatePrimitiveValue(rng);
  }
}
