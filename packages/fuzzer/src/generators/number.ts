// ============================================================================
// Number Fuzzing Generator
// Generates numeric boundary values and edge cases
// ============================================================================

import { FuzzContext, GeneratedValue } from '../types.js';

/**
 * JavaScript number limits
 */
export const NUMBER_LIMITS = {
  MAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER,  // 2^53 - 1
  MIN_SAFE_INTEGER: Number.MIN_SAFE_INTEGER,  // -(2^53 - 1)
  MAX_VALUE: Number.MAX_VALUE,
  MIN_VALUE: Number.MIN_VALUE,
  EPSILON: Number.EPSILON,
  POSITIVE_INFINITY: Number.POSITIVE_INFINITY,
  NEGATIVE_INFINITY: Number.NEGATIVE_INFINITY,
  NaN: Number.NaN,
};

/**
 * Common integer boundary values
 */
export const INTEGER_BOUNDARIES = [
  // Zero and near-zero
  -1, 0, 1,
  
  // Byte boundaries (8-bit)
  -129, -128, -127, 126, 127, 128,
  254, 255, 256,
  
  // Short boundaries (16-bit)
  -32769, -32768, -32767,
  32766, 32767, 32768,
  65534, 65535, 65536,
  
  // Int boundaries (32-bit)
  -2147483649, -2147483648, -2147483647,
  2147483646, 2147483647, 2147483648,
  4294967294, 4294967295, 4294967296,
  
  // Long boundaries (64-bit, JavaScript safe integer)
  Number.MIN_SAFE_INTEGER - 1,
  Number.MIN_SAFE_INTEGER,
  Number.MIN_SAFE_INTEGER + 1,
  Number.MAX_SAFE_INTEGER - 1,
  Number.MAX_SAFE_INTEGER,
  Number.MAX_SAFE_INTEGER + 1,
  
  // Powers of 2
  ...Array.from({ length: 32 }, (_, i) => Math.pow(2, i)),
  ...Array.from({ length: 32 }, (_, i) => -Math.pow(2, i)),
  ...Array.from({ length: 32 }, (_, i) => Math.pow(2, i) - 1),
  ...Array.from({ length: 32 }, (_, i) => Math.pow(2, i) + 1),
];

/**
 * Floating point edge cases
 */
export const FLOAT_EDGE_CASES = [
  0.0,
  -0.0,
  0.1,
  -0.1,
  0.5,
  -0.5,
  0.9,
  -0.9,
  0.99,
  0.999,
  0.9999999999999999,
  1.0000000000000001,
  
  // Precision issues
  0.1 + 0.2, // 0.30000000000000004
  0.3 - 0.1, // Not exactly 0.2
  
  // Very small
  Number.EPSILON,
  Number.MIN_VALUE,
  1e-308,
  5e-324, // Smallest positive double
  
  // Very large
  Number.MAX_VALUE,
  1e308,
  1.7976931348623157e308,
  
  // Denormalized numbers
  2.2250738585072014e-308, // Smallest normal double
  2.225073858507201e-308, // Largest denormal
  
  // Special
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  Number.NaN,
  
  // Fractions
  1/3,
  2/3,
  1/7,
  Math.PI,
  Math.E,
  Math.SQRT2,
];

/**
 * Generate fuzzed integers
 */
export function* generateIntegers(ctx: FuzzContext): Generator<GeneratedValue<number>> {
  // Standard boundaries
  for (const boundary of INTEGER_BOUNDARIES) {
    if (Number.isFinite(boundary)) {
      yield { value: boundary, category: 'boundary', description: `Integer boundary: ${boundary}` };
    }
  }

  // Constraint-based boundaries
  if (ctx.constraints?.min !== undefined) {
    const min = ctx.constraints.min as number;
    yield { value: min - 1, category: 'boundary', description: `Below min (${min - 1})` };
    yield { value: min, category: 'boundary', description: `At min (${min})` };
    yield { value: min + 1, category: 'boundary', description: `Above min (${min + 1})` };
  }

  if (ctx.constraints?.max !== undefined) {
    const max = ctx.constraints.max as number;
    yield { value: max - 1, category: 'boundary', description: `Below max (${max - 1})` };
    yield { value: max, category: 'boundary', description: `At max (${max})` };
    yield { value: max + 1, category: 'boundary', description: `Above max (${max + 1})` };
  }

  // Range-based fuzzing
  if (ctx.constraints?.min !== undefined && ctx.constraints?.max !== undefined) {
    const min = ctx.constraints.min as number;
    const max = ctx.constraints.max as number;
    const mid = Math.floor((min + max) / 2);
    yield { value: mid, category: 'boundary', description: `Midpoint (${mid})` };
    
    // Random within range
    for (let i = 0; i < 10; i++) {
      const random = ctx.rng ?? Math.random;
      const value = Math.floor(random() * (max - min + 1)) + min;
      yield { value, category: 'random', description: `Random in range (${value})` };
    }
  }

  // Random integers
  for (let i = 0; i < (ctx.iterations ?? 50); i++) {
    const random = ctx.rng ?? Math.random;
    const value = Math.floor(random() * Number.MAX_SAFE_INTEGER * 2) - Number.MAX_SAFE_INTEGER;
    yield { value, category: 'random', description: 'Random integer' };
  }
}

/**
 * Generate fuzzed floats
 */
export function* generateFloats(ctx: FuzzContext): Generator<GeneratedValue<number>> {
  // Standard edge cases
  for (const value of FLOAT_EDGE_CASES) {
    yield { value, category: 'boundary', description: `Float edge case: ${value}` };
  }

  // Constraint-based boundaries
  if (ctx.constraints?.min !== undefined) {
    const min = ctx.constraints.min as number;
    yield { value: min - 0.0001, category: 'boundary', description: `Just below min` };
    yield { value: min, category: 'boundary', description: `At min` };
    yield { value: min + 0.0001, category: 'boundary', description: `Just above min` };
    yield { value: min - Number.EPSILON, category: 'boundary', description: `Epsilon below min` };
    yield { value: min + Number.EPSILON, category: 'boundary', description: `Epsilon above min` };
  }

  if (ctx.constraints?.max !== undefined) {
    const max = ctx.constraints.max as number;
    yield { value: max - 0.0001, category: 'boundary', description: `Just below max` };
    yield { value: max, category: 'boundary', description: `At max` };
    yield { value: max + 0.0001, category: 'boundary', description: `Just above max` };
    yield { value: max - Number.EPSILON, category: 'boundary', description: `Epsilon below max` };
    yield { value: max + Number.EPSILON, category: 'boundary', description: `Epsilon above max` };
  }

  // Precision edge cases
  if (ctx.constraints?.precision !== undefined) {
    const precision = ctx.constraints.precision as number;
    yield { 
      value: Number(`0.${'9'.repeat(precision)}1`), 
      category: 'precision', 
      description: `Over precision limit` 
    };
    yield { 
      value: Number(`0.${'0'.repeat(precision - 1)}1`), 
      category: 'precision', 
      description: `At precision limit` 
    };
  }

  // Random floats
  for (let i = 0; i < (ctx.iterations ?? 50); i++) {
    const random = ctx.rng ?? Math.random;
    const value = (random() * 2 - 1) * Number.MAX_VALUE;
    if (Number.isFinite(value)) {
      yield { value, category: 'random', description: 'Random float' };
    }
  }
}

/**
 * Generate numbers that might cause issues when used as array indices
 */
export function* generateArrayIndexFuzz(): Generator<GeneratedValue<number>> {
  yield { value: -1, category: 'index', description: 'Negative index' };
  yield { value: 0, category: 'index', description: 'Zero index' };
  yield { value: 0.5, category: 'index', description: 'Fractional index' };
  yield { value: -0.5, category: 'index', description: 'Negative fractional index' };
  yield { value: Number.MAX_SAFE_INTEGER, category: 'index', description: 'Max safe integer index' };
  yield { value: 4294967295, category: 'index', description: 'Max array length' };
  yield { value: 4294967296, category: 'index', description: 'Over max array length' };
  yield { value: NaN, category: 'index', description: 'NaN index' };
  yield { value: Infinity, category: 'index', description: 'Infinity index' };
  yield { value: -Infinity, category: 'index', description: 'Negative infinity index' };
}

/**
 * Generate numbers that might cause issues in arithmetic
 */
export function* generateArithmeticFuzz(): Generator<GeneratedValue<number>> {
  // Division edge cases
  yield { value: 0, category: 'arithmetic', description: 'Division by zero' };
  yield { value: -0, category: 'arithmetic', description: 'Negative zero' };
  yield { value: Number.MIN_VALUE, category: 'arithmetic', description: 'Smallest positive' };
  yield { value: -Number.MIN_VALUE, category: 'arithmetic', description: 'Smallest negative' };
  
  // Overflow cases
  yield { value: Number.MAX_VALUE, category: 'arithmetic', description: 'Max value (overflow)' };
  yield { value: -Number.MAX_VALUE, category: 'arithmetic', description: 'Min value (underflow)' };
  yield { value: Number.MAX_VALUE * 2, category: 'arithmetic', description: 'Double max (infinity)' };
  
  // Precision loss
  yield { value: Number.MAX_SAFE_INTEGER + 1, category: 'arithmetic', description: 'Precision loss' };
  yield { value: Number.MAX_SAFE_INTEGER + 2, category: 'arithmetic', description: 'More precision loss' };
  
  // NaN propagation
  yield { value: NaN, category: 'arithmetic', description: 'NaN propagation' };
  yield { value: 0 / 0, category: 'arithmetic', description: '0/0' };
  yield { value: Infinity - Infinity, category: 'arithmetic', description: 'Inf - Inf' };
}

/**
 * Mutate an existing number
 */
export function mutateNumber(value: number, rng?: () => number): number {
  const random = rng ?? Math.random;
  
  const mutations = [
    // Negate
    () => -value,
    // Add/subtract 1
    () => value + (random() > 0.5 ? 1 : -1),
    // Multiply by -1 to 1
    () => value * (random() * 2 - 1),
    // Bit flip (for integers)
    () => {
      if (Number.isInteger(value) && Math.abs(value) < Number.MAX_SAFE_INTEGER) {
        const bit = Math.floor(random() * 32);
        return value ^ (1 << bit);
      }
      return value;
    },
    // Double
    () => value * 2,
    // Halve
    () => value / 2,
    // Round
    () => Math.round(value),
    // Floor/ceil
    () => random() > 0.5 ? Math.floor(value) : Math.ceil(value),
    // Add epsilon
    () => value + Number.EPSILON * (random() > 0.5 ? 1 : -1),
    // Return boundary
    () => {
      const boundaries = [0, 1, -1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, NaN, Infinity, -Infinity];
      return boundaries[Math.floor(random() * boundaries.length)]!;
    },
  ];

  const mutation = mutations[Math.floor(random() * mutations.length)]!;
  return mutation();
}

/**
 * Check if a number is "interesting" for fuzzing purposes
 */
export function isInterestingNumber(value: number): boolean {
  if (!Number.isFinite(value)) return true;
  if (value === 0 || value === -0) return true;
  if (Number.isNaN(value)) return true;
  if (INTEGER_BOUNDARIES.includes(value)) return true;
  if (FLOAT_EDGE_CASES.includes(value)) return true;
  return false;
}
