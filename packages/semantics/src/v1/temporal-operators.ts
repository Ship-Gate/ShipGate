// ============================================================================
// ISL v1 Temporal Operator Semantics
// ============================================================================

import type {
  TemporalOperator,
  TemporalOperatorSemantics,
} from '../types.js';

/**
 * V1 Temporal Operator Definitions
 * 
 * These semantics are FROZEN for v1.x.x and must not change
 * behavior across patch versions.
 * 
 * Temporal operators express time-based constraints on system behavior.
 */
export const V1_TEMPORAL_OPERATORS: Map<TemporalOperator, TemporalOperatorSemantics> = new Map([
  ['eventually', {
    operator: 'eventually',
    description: 'The predicate must become true at some point within the specified duration',
    requiresDuration: true,
    allowsNesting: false,
    interpretation: 'poll_until_true',
  }],

  ['always', {
    operator: 'always',
    description: 'The predicate must remain true throughout the specified duration',
    requiresDuration: true,
    allowsNesting: false,
    interpretation: 'assert_invariant',
  }],

  ['within', {
    operator: 'within',
    description: 'The operation must complete within the specified duration (deadline)',
    requiresDuration: true,
    allowsNesting: false,
    interpretation: 'deadline_check',
  }],

  ['never', {
    operator: 'never',
    description: 'The predicate must never become true (invariant negation)',
    requiresDuration: false,
    allowsNesting: false,
    interpretation: 'assert_never',
  }],

  ['immediately', {
    operator: 'immediately',
    description: 'The predicate must be true right after the operation completes (no delay)',
    requiresDuration: false,
    allowsNesting: false,
    interpretation: 'immediate_check',
  }],

  ['response', {
    operator: 'response',
    description: 'A stimulus-response pattern: when A happens, B must follow within duration',
    requiresDuration: true,
    allowsNesting: true,
    interpretation: 'stimulus_response',
  }],
]);
