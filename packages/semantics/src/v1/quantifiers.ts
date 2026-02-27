// ============================================================================
// ISL v1 Quantifier Semantics
// ============================================================================

import type {
  Quantifier,
  QuantifierSemantics,
  Value,
} from '../types.js';

/**
 * V1 Quantifier Definitions
 * 
 * These semantics are FROZEN for v1.x.x and must not change
 * behavior across patch versions.
 * 
 * Quantifiers provide collection operations with predicate evaluation.
 */
export const V1_QUANTIFIERS: Map<Quantifier, QuantifierSemantics> = new Map([
  ['all', {
    quantifier: 'all',
    description: 'Universal quantifier: returns true if predicate holds for all items',
    resultType: 'boolean',
    shortCircuit: true,
    evaluate: (collection: Value[], predicate: (item: Value) => Value): Value => {
      // Short-circuits on first false
      for (const item of collection) {
        if (!predicate(item)) {
          return false;
        }
      }
      return true;
    },
  }],

  ['any', {
    quantifier: 'any',
    description: 'Existential quantifier: returns true if predicate holds for at least one item',
    resultType: 'boolean',
    shortCircuit: true,
    evaluate: (collection: Value[], predicate: (item: Value) => Value): Value => {
      // Short-circuits on first true
      for (const item of collection) {
        if (predicate(item)) {
          return true;
        }
      }
      return false;
    },
  }],

  ['none', {
    quantifier: 'none',
    description: 'Negated existential: returns true if predicate holds for no items',
    resultType: 'boolean',
    shortCircuit: true,
    evaluate: (collection: Value[], predicate: (item: Value) => Value): Value => {
      // Equivalent to not(any(...))
      // Short-circuits on first true
      for (const item of collection) {
        if (predicate(item)) {
          return false;
        }
      }
      return true;
    },
  }],

  ['count', {
    quantifier: 'count',
    description: 'Counting quantifier: returns the number of items satisfying the predicate',
    resultType: 'number',
    shortCircuit: false,
    evaluate: (collection: Value[], predicate: (item: Value) => Value): Value => {
      let count = 0;
      for (const item of collection) {
        if (predicate(item)) {
          count++;
        }
      }
      return count;
    },
  }],

  ['sum', {
    quantifier: 'sum',
    description: 'Aggregation quantifier: sums the numeric values returned by the predicate',
    resultType: 'number',
    shortCircuit: false,
    evaluate: (collection: Value[], predicate: (item: Value) => Value): Value => {
      let sum = 0;
      for (const item of collection) {
        const result = predicate(item);
        if (typeof result !== 'number') {
          throw new TypeError(`sum quantifier requires numeric predicate result, got ${typeof result}`);
        }
        sum += result;
      }
      return sum;
    },
  }],

  ['filter', {
    quantifier: 'filter',
    description: 'Filtering quantifier: returns array of items satisfying the predicate',
    resultType: 'array',
    shortCircuit: false,
    evaluate: (collection: Value[], predicate: (item: Value) => Value): Value => {
      const result: Value[] = [];
      for (const item of collection) {
        if (predicate(item)) {
          result.push(item);
        }
      }
      return result;
    },
  }],
]);
