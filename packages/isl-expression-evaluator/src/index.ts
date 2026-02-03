// ============================================================================
// ISL Expression Evaluator - Public API
// ============================================================================
// v1 - Complete Expression Evaluator for Postconditions/Invariants
//
// Key features:
// - Tri-state logic: true/false/unknown with STRUCTURED REASON CODES
// - Boolean ops: && || ! implies iff (and or not)
// - Comparisons: == != < <= > >=
// - Arithmetic: + - * / %
// - Membership: in
// - Literals: string number boolean null duration regex
// - Identifiers: input.* result.* error variants
// - Property access: foo.bar.baz, foo[index]
// - Quantifiers: all, any, none, count, sum, filter
// - Conditionals: condition ? then : else
// - Function calls: now() length() is_valid_format() is_valid() regex() contains()
//                   abs() ceil() floor() round() min() max() pow() sqrt()
//                   concat() upper() lower() trim() startsWith() endsWith()
//                   len() keys() values() isEmpty()
// - String methods: startsWith() endsWith() includes() trim() split() charAt()
// - Array methods: indexOf() includes() join() slice() concat() reverse() at()
// - Constant folding: pre-evaluate constant subtrees
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
  // Constant folding
  foldConstants,
  isConstant,
  analyzeExpression,
  getCoverageReport,
  // Evaluation caching
  clearEvalCache,
  getEvalCacheSize,
} from './v1/evaluator.js';

export type {
  EvalResult,
  EvalKind,
  EvalContext,
  EvalAdapter,
  // Structured unknown reasons
  UnknownReasonCode,
  UnknownReason,
  // Blame span for diagnostics
  BlameSpan,
} from './v1/types.js';

// Constant folding types (from evaluator)
export type { FoldResult, ExpressionStats } from './v1/evaluator.js';

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
