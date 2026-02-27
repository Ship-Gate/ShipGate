// ============================================================================
// ISL v1 Unary Operator Semantics
// ============================================================================

import type {
  UnaryOperator,
  UnaryOperatorSemantics,
  Value,
} from '../types.js';

/**
 * V1 Unary Operator Definitions
 * 
 * These semantics are FROZEN for v1.x.x and must not change
 * behavior across patch versions.
 */
export const V1_UNARY_OPERATORS: Map<UnaryOperator, UnaryOperatorSemantics> = new Map([
  ['not', {
    operator: 'not',
    description: 'Logical negation: converts any value to boolean and negates',
    precedence: 7,
    operandTypes: [{ types: ['boolean'], description: 'boolean value' }],
    resultType: 'boolean',
    evaluate: (operand: Value): Value => {
      return !operand;
    },
  }],

  ['-', {
    operator: '-',
    description: 'Numeric negation: returns the additive inverse',
    precedence: 7,
    operandTypes: [{ types: ['number'], description: 'numeric value' }],
    resultType: 'number',
    evaluate: (operand: Value): Value => {
      if (typeof operand !== 'number') {
        throw new TypeError(`Unary minus requires number, got ${typeof operand}`);
      }
      return -operand;
    },
  }],
]);
