// ============================================================================
// ISL v1 Semantics - Complete Definition
// ============================================================================

import type {
  VersionedSemantics,
  SemanticVersion,
  BinaryOperator,
  UnaryOperator,
  Quantifier,
  TemporalOperator,
  BinaryOperatorSemantics,
  UnaryOperatorSemantics,
  QuantifierSemantics,
  TemporalOperatorSemantics,
} from '../types.js';
import { V1_BINARY_OPERATORS } from './binary-operators.js';
import { V1_UNARY_OPERATORS } from './unary-operators.js';
import { V1_QUANTIFIERS } from './quantifiers.js';
import { V1_TEMPORAL_OPERATORS } from './temporal-operators.js';

/**
 * V1 Semantic Version
 */
export const V1_VERSION: SemanticVersion = {
  major: 1,
  minor: 0,
  patch: 0,
};

/**
 * V1 Semantics Implementation
 * 
 * This is the complete, frozen semantics for ISL v1.x.x.
 * All patch versions (1.0.0, 1.0.1, etc.) must maintain
 * identical semantic behavior.
 */
export const V1_SEMANTICS: VersionedSemantics = {
  version: V1_VERSION,
  versionString: '1.0.0',
  
  binaryOperators: V1_BINARY_OPERATORS,
  unaryOperators: V1_UNARY_OPERATORS,
  quantifiers: V1_QUANTIFIERS,
  temporalOperators: V1_TEMPORAL_OPERATORS,

  getBinaryOperator(op: BinaryOperator): BinaryOperatorSemantics | undefined {
    return V1_BINARY_OPERATORS.get(op);
  },

  getUnaryOperator(op: UnaryOperator): UnaryOperatorSemantics | undefined {
    return V1_UNARY_OPERATORS.get(op);
  },

  getQuantifier(q: Quantifier): QuantifierSemantics | undefined {
    return V1_QUANTIFIERS.get(q);
  },

  getTemporalOperator(op: TemporalOperator): TemporalOperatorSemantics | undefined {
    return V1_TEMPORAL_OPERATORS.get(op);
  },
};

// Re-export individual operator maps for direct access
export { V1_BINARY_OPERATORS } from './binary-operators.js';
export { V1_UNARY_OPERATORS } from './unary-operators.js';
export { V1_QUANTIFIERS } from './quantifiers.js';
export { V1_TEMPORAL_OPERATORS } from './temporal-operators.js';
