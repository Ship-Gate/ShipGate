/**
 * Type definitions for the ISL Clarification Engine
 * 
 * Handles open questions and answers to update AST specifications
 */

import type { Domain, Behavior, SecuritySpec, ObservabilitySpec, DurationLiteral, Expression } from '../corpus-tests/corpusRunner.js';

// ============================================================================
// QUESTION TYPES
// ============================================================================

/**
 * Supported question types for clarification
 */
export type QuestionType =
  | 'rate_limit'        // Rate limiting: yes/no + numeric value
  | 'session_expiry'    // Session expiry: duration value
  | 'audit_logging'     // Audit logging: on/off
  | 'idempotency';      // Idempotency: on/off

/**
 * Answer value types
 */
export type AnswerValue =
  | boolean
  | number
  | string
  | DurationValue;

/**
 * Duration value for session expiry and similar
 */
export interface DurationValue {
  value: number;
  unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days';
}

/**
 * An open question requiring clarification
 */
export interface OpenQuestion {
  /** Unique identifier for the question */
  id: string;
  /** Type of clarification needed */
  type: QuestionType;
  /** Human-readable question text */
  text: string;
  /** Optional: which behavior(s) this applies to */
  targetBehaviors?: string[];
  /** Optional: default value if no answer provided */
  defaultValue?: AnswerValue;
  /** Optional: constraints on the answer */
  constraints?: AnswerConstraints;
}

/**
 * Constraints on answer values
 */
export interface AnswerConstraints {
  /** Minimum numeric value */
  min?: number;
  /** Maximum numeric value */
  max?: number;
  /** Allowed units for duration */
  allowedUnits?: DurationValue['unit'][];
}

/**
 * An answer to an open question
 */
export interface Answer {
  /** ID of the question being answered */
  questionId: string;
  /** The answer value */
  value: AnswerValue;
}

// ============================================================================
// CLARIFICATION RESULTS
// ============================================================================

/**
 * Result of applying a single clarification
 */
export interface AppliedClarification {
  /** Question ID that was applied */
  questionId: string;
  /** Type of clarification */
  type: QuestionType;
  /** Which behaviors were modified */
  modifiedBehaviors: string[];
  /** Description of what was changed */
  description: string;
}

/**
 * Unresolved question (no answer provided)
 */
export interface UnresolvedQuestion {
  /** Question ID */
  questionId: string;
  /** Reason it was unresolved */
  reason: 'no_answer' | 'invalid_answer' | 'constraint_violation';
  /** Additional details */
  details?: string;
}

/**
 * Input to the clarification engine
 */
export interface ClarifySpecInput {
  /** The AST to modify */
  ast: Domain;
  /** Open questions requiring clarification */
  openQuestions: OpenQuestion[];
  /** Answers to the questions */
  answers: Answer[];
}

/**
 * Output from the clarification engine
 */
export interface ClarifySpecOutput {
  /** Updated AST with clarifications applied */
  ast: Domain;
  /** List of successfully applied clarifications */
  applied: AppliedClarification[];
  /** List of unresolved questions */
  unresolved: UnresolvedQuestion[];
}

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

/**
 * Check if a value is a duration value
 */
export function isDurationValue(value: AnswerValue): value is DurationValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    'unit' in value &&
    typeof value.value === 'number' &&
    typeof value.unit === 'string'
  );
}

/**
 * Check if a value is a boolean
 */
export function isBooleanAnswer(value: AnswerValue): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if a value is a number
 */
export function isNumericAnswer(value: AnswerValue): value is number {
  return typeof value === 'number';
}

/**
 * Valid duration units
 */
export const VALID_DURATION_UNITS: readonly DurationValue['unit'][] = [
  'ms',
  'seconds',
  'minutes',
  'hours',
  'days',
] as const;
