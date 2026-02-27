/**
 * Arithmetic Mutation Operators
 * 
 * Mutates arithmetic operators: +, -, *, /, %
 */

import { MutationOperator, MutantCandidate } from '../types';

/** Arithmetic operator replacements */
const ARITHMETIC_REPLACEMENTS: Record<string, string[]> = {
  '+': ['-', '*', '/'],
  '-': ['+', '*', '/'],
  '*': ['+', '-', '/'],
  '/': ['+', '-', '*'],
  '%': ['/', '*'],
};

/**
 * Binary arithmetic operator mutation
 */
export const arithmeticBinaryOperator: MutationOperator = {
  name: 'ArithmeticBinaryOperator',
  type: 'arithmetic',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'BinaryExpression' &&
      typeof node.operator === 'string' &&
      node.operator in ARITHMETIC_REPLACEMENTS
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.operator !== 'string') {
      return [];
    }

    const original = node.operator;
    const replacements = ARITHMETIC_REPLACEMENTS[original] || [];

    return replacements.map((replacement) => ({
      type: 'arithmetic',
      original,
      mutated: replacement,
      description: `Replace '${original}' with '${replacement}'`,
      location: {},
    }));
  },
};

/**
 * Unary arithmetic operator mutation (negation)
 */
export const arithmeticUnaryOperator: MutationOperator = {
  name: 'ArithmeticUnaryOperator',
  type: 'arithmetic',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'UnaryExpression' &&
      node.operator === '-'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    return [
      {
        type: 'arithmetic',
        original: '-',
        mutated: '+',
        description: 'Remove negation operator',
        location: {},
      },
    ];
  },
};

/**
 * Increment/decrement mutation
 */
export const arithmeticIncrementOperator: MutationOperator = {
  name: 'ArithmeticIncrementOperator',
  type: 'arithmetic',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'UpdateExpression' &&
      (node.operator === '++' || node.operator === '--')
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.operator !== 'string') {
      return [];
    }

    const original = node.operator;
    const replacement = original === '++' ? '--' : '++';

    return [
      {
        type: 'arithmetic',
        original,
        mutated: replacement,
        description: `Replace '${original}' with '${replacement}'`,
        location: {},
      },
    ];
  },
};

/**
 * Numeric literal mutation (add/subtract 1)
 */
export const arithmeticLiteralOperator: MutationOperator = {
  name: 'ArithmeticLiteralOperator',
  type: 'arithmetic',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'NumericLiteral' &&
      typeof node.value === 'number'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.value !== 'number') {
      return [];
    }

    const value = node.value;
    const candidates: MutantCandidate[] = [];

    // Add 1
    candidates.push({
      type: 'arithmetic',
      original: String(value),
      mutated: String(value + 1),
      description: `Replace ${value} with ${value + 1}`,
      location: {},
    });

    // Subtract 1
    candidates.push({
      type: 'arithmetic',
      original: String(value),
      mutated: String(value - 1),
      description: `Replace ${value} with ${value - 1}`,
      location: {},
    });

    // Negate (if not zero)
    if (value !== 0) {
      candidates.push({
        type: 'arithmetic',
        original: String(value),
        mutated: String(-value),
        description: `Replace ${value} with ${-value}`,
        location: {},
      });
    }

    // Replace with zero
    if (value !== 0) {
      candidates.push({
        type: 'arithmetic',
        original: String(value),
        mutated: '0',
        description: `Replace ${value} with 0`,
        location: {},
      });
    }

    return candidates;
  },
};

/**
 * ISL constraint arithmetic mutation
 * Mutates min/max values in type constraints
 */
export const constraintArithmeticOperator: MutationOperator = {
  name: 'ConstraintArithmeticOperator',
  type: 'arithmetic',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'TypeConstraint' &&
      (hasProperty(node, 'min') || hasProperty(node, 'max'))
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const candidates: MutantCandidate[] = [];

    // Mutate min value
    if (hasProperty(node, 'min') && typeof node.min === 'number') {
      const min = node.min;
      
      candidates.push({
        type: 'arithmetic',
        original: `min: ${min}`,
        mutated: `min: ${min - 1}`,
        description: `Decrease min from ${min} to ${min - 1}`,
        location: {},
      });

      candidates.push({
        type: 'arithmetic',
        original: `min: ${min}`,
        mutated: `min: ${min + 1}`,
        description: `Increase min from ${min} to ${min + 1}`,
        location: {},
      });
    }

    // Mutate max value
    if (hasProperty(node, 'max') && typeof node.max === 'number') {
      const max = node.max;
      
      candidates.push({
        type: 'arithmetic',
        original: `max: ${max}`,
        mutated: `max: ${max - 1}`,
        description: `Decrease max from ${max} to ${max - 1}`,
        location: {},
      });

      candidates.push({
        type: 'arithmetic',
        original: `max: ${max}`,
        mutated: `max: ${max + 1}`,
        description: `Increase max from ${max} to ${max + 1}`,
        location: {},
      });
    }

    return candidates;
  },
};

/** All arithmetic operators */
export const arithmeticOperators: MutationOperator[] = [
  arithmeticBinaryOperator,
  arithmeticUnaryOperator,
  arithmeticIncrementOperator,
  arithmeticLiteralOperator,
  constraintArithmeticOperator,
];

// Type guard helpers
function isNode(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}
