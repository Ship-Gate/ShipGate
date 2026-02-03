// ============================================================================
// ISL Expression Evaluator - Public API
// ============================================================================
// v1 - Complete Expression Evaluator for Postconditions/Invariants
//
// Key features:
// - Tri-state logic: true/false/unknown with provenance
// - Boolean ops: && || ! implies (and or not)
// - Comparisons: == != < <= > >=
// - Literals: string number boolean null
// - Identifiers: input.* result.* error variants
// - Property access: foo.bar.baz
// - Function calls: now() length(x) is_valid_format(x) is_valid(x) regex(x,p) contains(arr,v)
// ============================================================================

// ============================================================================
// Legacy API (Default - for backward compatibility)
// ============================================================================

export {
  evaluate,
} from './evaluator.js';

export {
  type TriState,
  type MaybeUnknown,
  type Value,
  type EvaluationResult,
  type EvaluationContext,
  type Diagnostic,
  type ExpressionAdapter,
  type Provenance,
  type ProvenanceSource,
  triStateToBoolean,
  triStateAnd,
  triStateOr,
  triStateNot,
  triStateImplies,
  isUnknown,
  wrapValue,
  DefaultAdapter,
  EvaluationError,
} from './types.js';

export {
  createContext,
  createAdapter,
} from './helpers.js';

// ============================================================================
// v1 API (Recommended for new code)
// ============================================================================
// Usage:
//   import { evaluateV1 as evaluate, createEvalContext } from '@isl-lang/expression-evaluator';
//   const ctx = createEvalContext({ input: { email: 'test@example.com' }, result: { ... } });
//   const result = evaluate(exprAst, ctx);
//   // result: { kind: 'true' | 'false' | 'unknown', reason?: string, evidence?: unknown }
// ============================================================================

export {
  evaluate as evaluateV1,
  createEvalContext,
  createEvalAdapter,
} from './v1/evaluator.js';

export type {
  EvalResult,
  EvalKind,
  EvalContext,
  EvalAdapter,
} from './v1/types.js';

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
} from './v1/types.js';

// ============================================================================
// v1 Module Namespace (for explicit versioned access)
// ============================================================================
// Usage:
//   import { v1 } from '@isl-lang/expression-evaluator';
//   const result = v1.evaluate(expr, v1.createEvalContext({ ... }));
// ============================================================================

export * as v1 from './v1/index.js';
