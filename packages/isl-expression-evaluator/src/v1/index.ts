// ============================================================================
// ISL Expression Evaluator v1 - Public API
// ============================================================================

// Core evaluator
export { evaluate, createEvalContext, createEvalAdapter } from './evaluator.js';

// Types
export type { EvalResult, EvalKind, EvalContext, EvalAdapter } from './types.js';

// Type utilities
export {
  triAnd,
  triOr,
  triNot,
  triImplies,
  ok,
  fail,
  unknown,
  fromBool,
  fromKind,
  DefaultEvalAdapter,
} from './types.js';

// ============================================================================
// POSTCONDITION EVALUATION (v1 Feature)
// ============================================================================

// Postcondition types
export type {
  PostconditionPredicate,
  IncreasedByPredicate,
  NoneCreatedPredicate,
  IncrementedPredicate,
  EntityCreatedPredicate,
  FieldReference,
  SimpleFieldPath,
  MethodCallField,
  DeltaValue,
  PostconditionContext,
  StateSnapshot,
  PostconditionResult,
  PostconditionDetails,
  TraceEventData,
} from './postcondition-types.js';

// Postcondition type factories and guards
export {
  isIncreasedByPredicate,
  isNoneCreatedPredicate,
  isIncrementedPredicate,
  isEntityCreatedPredicate,
  isPostconditionPredicate,
  increasedBy,
  noneCreated,
  entityCreated,
  incremented,
  simplePath,
  methodCallField,
  literalDelta,
  variableDelta,
} from './postcondition-types.js';

// Postcondition lowering
export type { LoweringResult } from './postcondition-lowering.js';
export {
  lowerFromString,
  lowerFromAST,
  lower,
  lowerAll,
  isIncreasedByPattern,
  isNoneCreatedPattern,
  isIncrementedPattern,
} from './postcondition-lowering.js';

// Postcondition evaluator
export type {
  PostconditionAdapter,
  PostconditionEvalContext,
} from './postcondition-evaluator.js';
export {
  evaluatePostcondition,
  evaluatePostconditions,
  createPostconditionContext,
  summarizePostconditionResults,
} from './postcondition-evaluator.js';
