/**
 * @isl-lang/expression-compiler
 *
 * ISL Expression Compiler - Parse, normalize, and evaluate ISL expressions
 *
 * Pipeline: AST -> IR -> Evaluator
 *
 * Supports the top 25 real-world clause patterns:
 * 1. Existence: x != null, x == null
 * 2. String: length > 0, matches(regex), includes(), startsWith(), endsWith()
 * 3. Number: >, >=, <, <=, between()
 * 4. Enums: in ["a","b"], not in [...]
 * 5. Boolean: &&, ||, !, implies
 * 6. Property chains: result.user.id != null
 * 7. Array: items.length > 0, includes(x), every(), some()
 * 8. Status checks: status in ["succeeded","paid"]
 * 9. Quantifiers: all(x in xs, pred), any(), none(), count()
 * 10. Entity operations: Entity.exists(), Entity.lookup(), Entity.count()
 */

// Re-export IR types and builders
export {
  // Types
  type IRExpr,
  type IRNode,
  type IRSourceLoc,
  type ComparisonOperator,
  type ArithmeticOperator,
  // All IR node types
  type IRLiteralNull,
  type IRLiteralBool,
  type IRLiteralNumber,
  type IRLiteralString,
  type IRLiteralRegex,
  type IRLiteralList,
  type IRLiteralMap,
  type IRVariable,
  type IRPropertyAccess,
  type IRIndexAccess,
  type IRExistence,
  type IRComparison,
  type IREqualityCheck,
  type IRStringLength,
  type IRStringMatches,
  type IRStringIncludes,
  type IRStringStartsWith,
  type IRStringEndsWith,
  type IRBetween,
  type IRInSet,
  type IRLogicalAnd,
  type IRLogicalOr,
  type IRLogicalNot,
  type IRLogicalImplies,
  type IRArrayLength,
  type IRArrayIncludes,
  type IRArrayEvery,
  type IRArraySome,
  type IRArrayFilter,
  type IRArrayMap,
  type IRQuantifierAll,
  type IRQuantifierAny,
  type IRQuantifierNone,
  type IRQuantifierCount,
  type IRArithmetic,
  type IRConditional,
  type IROldValue,
  type IRResultValue,
  type IRInputValue,
  type IRFunctionCall,
  type IREntityExists,
  type IREntityLookup,
  type IREntityCount,
  // Builders
  IR,
  generateNodeId,
  resetNodeIdCounter,
  SUPPORTED_PATTERNS,
} from './ir/types.js';

export { normalizeIR, serializeIR } from './ir/normalize.js';

// Re-export compiler
export {
  compileToIR,
  compileToIRRaw,
  createContext,
  type CompilerContext,
  CompilerError,
} from './compiler/ast-to-ir.js';

// Re-export evaluator
export {
  evaluate,
  EvaluationError,
} from './evaluator/evaluate.js';

export {
  createEvaluationContext,
  InMemoryEntityStore,
  EMPTY_ENTITY_STORE,
  type EvaluationContext,
  type ContextOptions,
  type EntityStore,
  type EntityInstance,
  type StateSnapshot,
} from './evaluator/context.js';

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import type { Expression } from '@isl-lang/parser';
import { compileToIR, createContext, type CompilerContext } from './compiler/ast-to-ir.js';
import { evaluate } from './evaluator/evaluate.js';
import { createEvaluationContext, type ContextOptions } from './evaluator/context.js';
import { serializeIR } from './ir/normalize.js';

/**
 * Compile and evaluate an AST expression in one step
 */
export function compileAndEvaluate(
  expr: Expression,
  contextOptions: ContextOptions = {},
  compilerOptions: Partial<CompilerContext> = {}
): unknown {
  const ir = compileToIR(expr, createContext(compilerOptions));
  const ctx = createEvaluationContext(contextOptions);
  return evaluate(ir, ctx);
}

/**
 * Compile an expression to a canonical string representation
 */
export function compileToString(
  expr: Expression,
  compilerOptions: Partial<CompilerContext> = {}
): string {
  const ir = compileToIR(expr, createContext(compilerOptions));
  return serializeIR(ir);
}

/**
 * Quick boolean evaluation (for precondition/postcondition checks)
 */
export function evaluateBool(
  expr: Expression,
  contextOptions: ContextOptions = {},
  compilerOptions: Partial<CompilerContext> = {}
): boolean {
  const result = compileAndEvaluate(expr, contextOptions, compilerOptions);
  return Boolean(result);
}
