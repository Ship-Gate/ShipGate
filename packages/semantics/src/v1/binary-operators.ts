// ============================================================================
// ISL v1 Binary Operator Semantics
// ============================================================================

import type {
  BinaryOperator,
  BinaryOperatorSemantics,
  Value,
} from '../types.js';

/**
 * Deep equality comparison for ISL values
 */
function deepEqual(a: Value, b: Value): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b as Record<string, Value>);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) =>
      deepEqual(
        (a as Record<string, Value>)[key],
        (b as Record<string, Value>)[key]
      )
    );
  }

  return false;
}

/**
 * V1 Binary Operator Definitions
 * 
 * These semantics are FROZEN for v1.x.x and must not change
 * behavior across patch versions.
 */
export const V1_BINARY_OPERATORS: Map<BinaryOperator, BinaryOperatorSemantics> = new Map([
  // ============================================================================
  // EQUALITY OPERATORS
  // ============================================================================
  ['==', {
    operator: '==',
    description: 'Deep structural equality comparison',
    precedence: 3,
    associative: false,
    commutative: true,
    shortCircuit: false,
    operandTypes: [{ types: ['any'], description: 'any value' }],
    resultType: 'boolean',
    evaluate: (left: Value, right: Value): Value => deepEqual(left, right),
  }],

  ['!=', {
    operator: '!=',
    description: 'Deep structural inequality comparison',
    precedence: 3,
    associative: false,
    commutative: true,
    shortCircuit: false,
    operandTypes: [{ types: ['any'], description: 'any value' }],
    resultType: 'boolean',
    evaluate: (left: Value, right: Value): Value => !deepEqual(left, right),
  }],

  // ============================================================================
  // COMPARISON OPERATORS
  // ============================================================================
  ['<', {
    operator: '<',
    description: 'Less than comparison (numbers only)',
    precedence: 4,
    associative: false,
    commutative: false,
    shortCircuit: false,
    operandTypes: [{ types: ['number'], description: 'numeric value' }],
    resultType: 'boolean',
    evaluate: (left: Value, right: Value): Value => {
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new TypeError(`Operator '<' requires numbers`);
      }
      return left < right;
    },
  }],

  ['>', {
    operator: '>',
    description: 'Greater than comparison (numbers only)',
    precedence: 4,
    associative: false,
    commutative: false,
    shortCircuit: false,
    operandTypes: [{ types: ['number'], description: 'numeric value' }],
    resultType: 'boolean',
    evaluate: (left: Value, right: Value): Value => {
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new TypeError(`Operator '>' requires numbers`);
      }
      return left > right;
    },
  }],

  ['<=', {
    operator: '<=',
    description: 'Less than or equal comparison (numbers only)',
    precedence: 4,
    associative: false,
    commutative: false,
    shortCircuit: false,
    operandTypes: [{ types: ['number'], description: 'numeric value' }],
    resultType: 'boolean',
    evaluate: (left: Value, right: Value): Value => {
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new TypeError(`Operator '<=' requires numbers`);
      }
      return left <= right;
    },
  }],

  ['>=', {
    operator: '>=',
    description: 'Greater than or equal comparison (numbers only)',
    precedence: 4,
    associative: false,
    commutative: false,
    shortCircuit: false,
    operandTypes: [{ types: ['number'], description: 'numeric value' }],
    resultType: 'boolean',
    evaluate: (left: Value, right: Value): Value => {
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new TypeError(`Operator '>=' requires numbers`);
      }
      return left >= right;
    },
  }],

  // ============================================================================
  // ARITHMETIC OPERATORS
  // ============================================================================
  ['+', {
    operator: '+',
    description: 'Addition for numbers, concatenation for strings',
    precedence: 5,
    associative: true,
    commutative: true, // Only for numbers
    shortCircuit: false,
    operandTypes: [
      { types: ['number'], description: 'numeric value' },
      { types: ['string'], description: 'string value' },
    ],
    resultType: 'any', // number or string depending on operands
    evaluate: (left: Value, right: Value): Value => {
      // String concatenation has priority
      if (typeof left === 'string' || typeof right === 'string') {
        return String(left) + String(right);
      }
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new TypeError(`Operator '+' requires numbers or strings`);
      }
      return left + right;
    },
  }],

  ['-', {
    operator: '-',
    description: 'Numeric subtraction',
    precedence: 5,
    associative: false,
    commutative: false,
    shortCircuit: false,
    operandTypes: [{ types: ['number'], description: 'numeric value' }],
    resultType: 'number',
    evaluate: (left: Value, right: Value): Value => {
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new TypeError(`Operator '-' requires numbers`);
      }
      return left - right;
    },
  }],

  ['*', {
    operator: '*',
    description: 'Numeric multiplication',
    precedence: 6,
    associative: true,
    commutative: true,
    shortCircuit: false,
    operandTypes: [{ types: ['number'], description: 'numeric value' }],
    resultType: 'number',
    evaluate: (left: Value, right: Value): Value => {
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new TypeError(`Operator '*' requires numbers`);
      }
      return left * right;
    },
  }],

  ['/', {
    operator: '/',
    description: 'Numeric division (throws on divide by zero)',
    precedence: 6,
    associative: false,
    commutative: false,
    shortCircuit: false,
    operandTypes: [{ types: ['number'], description: 'numeric value' }],
    resultType: 'number',
    evaluate: (left: Value, right: Value): Value => {
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new TypeError(`Operator '/' requires numbers`);
      }
      if (right === 0) {
        throw new Error('Division by zero');
      }
      return left / right;
    },
  }],

  ['%', {
    operator: '%',
    description: 'Modulo/remainder operation (throws on modulo by zero)',
    precedence: 6,
    associative: false,
    commutative: false,
    shortCircuit: false,
    operandTypes: [{ types: ['number'], description: 'numeric value' }],
    resultType: 'number',
    evaluate: (left: Value, right: Value): Value => {
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new TypeError(`Operator '%' requires numbers`);
      }
      if (right === 0) {
        throw new Error('Modulo by zero');
      }
      return left % right;
    },
  }],

  // ============================================================================
  // LOGICAL OPERATORS
  // ============================================================================
  ['and', {
    operator: 'and',
    description: 'Logical AND with short-circuit evaluation',
    precedence: 2,
    associative: true,
    commutative: false, // Due to short-circuit
    shortCircuit: true,
    operandTypes: [{ types: ['boolean'], description: 'boolean value' }],
    resultType: 'boolean',
    evaluate: (left: Value, right: Value): Value => {
      // Note: Short-circuit is handled at the evaluator level
      // This function is called when both operands are evaluated
      return Boolean(left) && Boolean(right);
    },
  }],

  ['or', {
    operator: 'or',
    description: 'Logical OR with short-circuit evaluation',
    precedence: 1,
    associative: true,
    commutative: false, // Due to short-circuit
    shortCircuit: true,
    operandTypes: [{ types: ['boolean'], description: 'boolean value' }],
    resultType: 'boolean',
    evaluate: (left: Value, right: Value): Value => {
      return Boolean(left) || Boolean(right);
    },
  }],

  ['implies', {
    operator: 'implies',
    description: 'Logical implication: A implies B is equivalent to (not A) or B',
    precedence: 2,
    associative: false,
    commutative: false,
    shortCircuit: true,
    operandTypes: [{ types: ['boolean'], description: 'boolean value' }],
    resultType: 'boolean',
    evaluate: (left: Value, right: Value): Value => {
      // A implies B === !A || B
      // If A is false, the implication is vacuously true
      return !Boolean(left) || Boolean(right);
    },
  }],

  ['iff', {
    operator: 'iff',
    description: 'Logical biconditional (if and only if): true when both operands have same truth value',
    precedence: 2,
    associative: true,
    commutative: true,
    shortCircuit: false,
    operandTypes: [{ types: ['boolean'], description: 'boolean value' }],
    resultType: 'boolean',
    evaluate: (left: Value, right: Value): Value => {
      return Boolean(left) === Boolean(right);
    },
  }],

  // ============================================================================
  // MEMBERSHIP OPERATORS
  // ============================================================================
  ['in', {
    operator: 'in',
    description: 'Membership test: checks if left is in right (array, object keys, or string)',
    precedence: 4,
    associative: false,
    commutative: false,
    shortCircuit: false,
    operandTypes: [
      { types: ['any'], description: 'value to search for' },
      { types: ['array', 'object', 'string'], description: 'collection to search in' },
    ],
    resultType: 'boolean',
    evaluate: (left: Value, right: Value): Value => {
      if (Array.isArray(right)) {
        return right.some((item) => deepEqual(item, left));
      }
      if (typeof right === 'object' && right !== null) {
        return String(left) in right;
      }
      if (typeof right === 'string' && typeof left === 'string') {
        return right.includes(left);
      }
      return false;
    },
  }],
]);
