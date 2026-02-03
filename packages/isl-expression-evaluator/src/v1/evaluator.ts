// ============================================================================
// ISL Expression Evaluator v1 - Core Implementation
// ============================================================================

import type { Expression } from '@isl-lang/parser';
import type { EvalResult, EvalContext, EvalAdapter, BlameSpan } from './types.js';
import {
  triAnd,
  triOr,
  triNot,
  ok,
  fail,
  unknown,
  fromKind,
  DefaultEvalAdapter,
} from './types.js';

// ============================================================================
// BLAME SPAN HELPERS
// ============================================================================

/**
 * Create a blame span from an expression for diagnostics
 */
function createBlameSpan(expr: Expression, path?: string): BlameSpan {
  return {
    exprKind: expr.kind,
    location: expr.location ? {
      file: expr.location.file,
      line: expr.location.line,
      column: expr.location.column,
      endLine: expr.location.endLine,
      endColumn: expr.location.endColumn,
    } : undefined,
    path,
  };
}

// ============================================================================
// EVALUATION CACHING
// ============================================================================

/**
 * Simple hash function for strings
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Create a unique expression signature for caching
 * Includes enough of the expression structure to avoid collisions
 */
function getExprSignature(expr: Expression): string {
  switch (expr.kind) {
    case 'BooleanLiteral':
      return `Bool:${(expr as { value: boolean }).value}`;
    case 'StringLiteral':
      return `Str:${(expr as { value: string }).value.slice(0, 50)}`;
    case 'NumberLiteral':
      return `Num:${(expr as { value: number }).value}`;
    case 'NullLiteral':
      return 'Null';
    case 'Identifier':
      return `Id:${(expr as { name: string }).name}`;
    case 'BinaryExpr': {
      const bin = expr as { operator: string; left: Expression; right: Expression };
      return `Bin:${bin.operator}:${getExprSignature(bin.left)}:${getExprSignature(bin.right)}`;
    }
    case 'UnaryExpr': {
      const un = expr as { operator: string; operand: Expression };
      return `Un:${un.operator}:${getExprSignature(un.operand)}`;
    }
    default:
      // For complex expressions, use a hash of the JSON representation
      try {
        return `${expr.kind}:${simpleHash(JSON.stringify(expr))}`;
      } catch {
        return `${expr.kind}:unknown`;
      }
  }
}

/**
 * Create a cache key from expression and context
 */
function createCacheKey(expr: Expression, ctx: EvalContext): string {
  // Use expression signature for unique identification
  const exprSig = getExprSignature(expr);
  
  // Hash the relevant context state
  const inputHash = ctx.input ? simpleHash(JSON.stringify(ctx.input)) : 0;
  const resultHash = ctx.result !== undefined ? simpleHash(JSON.stringify(ctx.result)) : 0;
  const varsHash = ctx.variables.size > 0 
    ? simpleHash(JSON.stringify(Array.from(ctx.variables.entries())))
    : 0;
  const oldStateHash = ctx.oldState 
    ? simpleHash(JSON.stringify(Array.from(ctx.oldState.entries())))
    : 0;
  
  return `${exprSig}|${inputHash}|${resultHash}|${varsHash}|${oldStateHash}`;
}

/**
 * Evaluation cache with LRU-like behavior
 */
class EvalCache {
  private cache: Map<string, EvalResult> = new Map();
  private maxSize: number;
  
  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }
  
  get(key: string): EvalResult | undefined {
    const value = this.cache.get(key);
    if (value) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  
  set(key: string, value: EvalResult): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  get size(): number {
    return this.cache.size;
  }
}

// Global evaluation cache (can be disabled via context)
const globalEvalCache = new EvalCache(1000);

// ============================================================================
// MAIN EVALUATOR
// ============================================================================

/**
 * Evaluate an ISL expression with tri-state logic
 * 
 * @param expr - The expression AST node to evaluate
 * @param ctx - The evaluation context with variables, input, result, etc.
 * @returns EvalResult with kind, reason, and evidence
 */
export function evaluate(expr: Expression, ctx: EvalContext): EvalResult {
  const maxDepth = ctx.maxDepth ?? 1000;
  return evalExpr(expr, ctx, 0, maxDepth);
}

/**
 * Create a default evaluation context
 */
export function createEvalContext(options: {
  variables?: Map<string, unknown>;
  input?: Record<string, unknown>;
  result?: unknown;
  oldState?: Map<string, unknown>;
  adapter?: EvalAdapter;
  maxDepth?: number;
  enableCache?: boolean;
} = {}): EvalContext {
  return {
    variables: options.variables ?? new Map(),
    input: options.input ?? {},
    result: options.result,
    oldState: options.oldState,
    adapter: options.adapter ?? new DefaultEvalAdapter(),
    maxDepth: options.maxDepth ?? 1000,
    enableCache: options.enableCache ?? true,
  };
}

/**
 * Clear the global evaluation cache
 */
export function clearEvalCache(): void {
  globalEvalCache.clear();
}

/**
 * Get the current cache size (for diagnostics)
 */
export function getEvalCacheSize(): number {
  return globalEvalCache.size;
}

/**
 * Create a custom adapter by extending the default
 */
export function createEvalAdapter(overrides: Partial<EvalAdapter>): EvalAdapter {
  const base = new DefaultEvalAdapter();
  return {
    isValid: overrides.isValid ?? base.isValid.bind(base),
    length: overrides.length ?? base.length.bind(base),
    exists: overrides.exists ?? base.exists.bind(base),
    lookup: overrides.lookup ?? base.lookup.bind(base),
    getProperty: overrides.getProperty ?? base.getProperty.bind(base),
    now: overrides.now ?? base.now.bind(base),
    isValidFormat: overrides.isValidFormat ?? base.isValidFormat.bind(base),
    regex: overrides.regex ?? base.regex.bind(base),
    contains: overrides.contains ?? base.contains.bind(base),
  };
}

// ============================================================================
// RECURSIVE EVALUATOR
// ============================================================================

function evalExpr(expr: Expression, ctx: EvalContext, depth: number, maxDepth: number): EvalResult {
  if (depth > maxDepth) {
    return unknown('TIMEOUT', `Maximum evaluation depth (${maxDepth}) exceeded`);
  }
  
  // Skip caching for simple literals (fast path)
  const isSimpleLiteral = ['BooleanLiteral', 'StringLiteral', 'NumberLiteral', 'NullLiteral'].includes(expr.kind);
  
  // Check cache for complex expressions
  if (!isSimpleLiteral && ctx.enableCache !== false) {
    const cacheKey = createCacheKey(expr, ctx);
    const cached = globalEvalCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const result = evalExprUncached(expr, ctx, depth, maxDepth);
  
  // Cache complex expression results
  if (!isSimpleLiteral && ctx.enableCache !== false && result.kind !== 'unknown') {
    const cacheKey = createCacheKey(expr, ctx);
    globalEvalCache.set(cacheKey, result);
  }
  
  return result;
}

function evalExprUncached(expr: Expression, ctx: EvalContext, depth: number, maxDepth: number): EvalResult {
  switch (expr.kind) {
    // Literals
    case 'BooleanLiteral':
      return evalBooleanLiteral(expr);
    case 'StringLiteral':
      return evalStringLiteral(expr);
    case 'NumberLiteral':
      return evalNumberLiteral(expr);
    case 'NullLiteral':
      return evalNullLiteral();
    case 'DurationLiteral':
      return evalDurationLiteral(expr);
    case 'RegexLiteral':
      return evalRegexLiteral(expr);
    case 'Literal':
      return evalGenericLiteral(expr);
    
    // Identifiers and qualified names
    case 'Identifier':
      return evalIdentifier(expr, ctx);
    case 'QualifiedName':
      return evalQualifiedName(expr, ctx, depth, maxDepth);
    
    // Binary operations
    case 'BinaryExpr':
      return evalBinaryExpr(expr, ctx, depth, maxDepth);
    
    // Unary operations
    case 'UnaryExpr':
      return evalUnaryExpr(expr, ctx, depth, maxDepth);
    
    // Member access
    case 'MemberExpr':
      return evalMemberExpr(expr, ctx, depth, maxDepth);
    
    // Index access
    case 'IndexExpr':
      return evalIndexExpr(expr, ctx, depth, maxDepth);
    
    // Function calls
    case 'CallExpr':
      return evalCallExpr(expr, ctx, depth, maxDepth);
    
    // Quantifiers
    case 'QuantifierExpr':
      return evalQuantifierExpr(expr, ctx, depth, maxDepth);
    
    // List literals
    case 'ListExpr':
      return evalListExpr(expr, ctx, depth, maxDepth);
    
    // Map literals
    case 'MapExpr':
      return evalMapExpr(expr, ctx, depth, maxDepth);
    
    // Conditional (ternary)
    case 'ConditionalExpr':
      return evalConditionalExpr(expr, ctx, depth, maxDepth);
    
    // Old expression (for postconditions)
    case 'OldExpr':
      return evalOldExpr(expr, ctx, depth, maxDepth);
    
    // Input and Result expressions
    case 'InputExpr':
      return evalInputExpr(expr, ctx);
    case 'ResultExpr':
      return evalResultExpr(expr, ctx, depth, maxDepth);
    
    // Lambda expressions
    case 'LambdaExpr':
      return evalLambdaExpr(expr);
    
    default:
      return unknown('UNSUPPORTED_EXPR', `Unsupported expression kind: ${(expr as { kind: string }).kind}`);
  }
}

// ============================================================================
// LITERAL HANDLERS
// ============================================================================

function evalBooleanLiteral(expr: { value: boolean }): EvalResult {
  return expr.value ? ok(true) : fail('Boolean literal is false', false);
}

function evalStringLiteral(expr: { value: string }): EvalResult {
  // String literals are truthy (they exist)
  return ok(expr.value);
}

function evalNumberLiteral(expr: { value: number }): EvalResult {
  // Number literals are truthy (they exist)
  return ok(expr.value);
}

function evalNullLiteral(): EvalResult {
  // Null is falsy
  return fail('Null value', null);
}

// ============================================================================
// IDENTIFIER HANDLER
// ============================================================================

function evalIdentifier(expr: { name: string; location?: unknown }, ctx: EvalContext): EvalResult {
  const name = expr.name;

  // Special identifiers
  if (name === 'true') return ok(true);
  if (name === 'false') return fail('false identifier', false);
  if (name === 'null') return fail('null identifier', null);

  // Check scoped variables first
  if (ctx.variables.has(name)) {
    const value = ctx.variables.get(name);
    return valueToResult(value, `Variable '${name}'`);
  }

  // Handle 'input' identifier - return input object
  if (name === 'input') {
    if (!ctx.input || Object.keys(ctx.input).length === 0) {
      return unknown('MISSING_INPUT', 'Input not available', undefined, createBlameSpan(expr as Expression));
    }
    return ok(ctx.input);
  }

  // Check input (safely handle undefined input)
  if (ctx.input && name in ctx.input) {
    const value = ctx.input[name];
    return valueToResult(value, `Input '${name}'`);
  }

  // Handle 'result' identifier
  if (name === 'result') {
    if (ctx.result === undefined) {
      return unknown('MISSING_RESULT', 'Result not available', undefined, createBlameSpan(expr as Expression));
    }
    return valueToResult(ctx.result, 'Result');
  }
  
  // Handle 'error' identifier for error variants
  if (name === 'error') {
    // Error is typically checked via comparison, return unknown if not set
    if (ctx.variables.has('error')) {
      return valueToResult(ctx.variables.get('error'), 'Error');
    }
    return unknown('MISSING_BINDING', 'Error not available', undefined, createBlameSpan(expr as Expression));
  }

  // Unknown identifier
  return unknown('MISSING_BINDING', `Unknown identifier: '${name}'`, undefined, createBlameSpan(expr as Expression));
}

/**
 * Convert a runtime value to EvalResult
 */
function valueToResult(value: unknown, label: string): EvalResult {
  if (value === null || value === undefined) {
    return fail(`${label} is null/undefined`, value);
  }
  if (value === 'unknown') {
    return unknown('PROPAGATED', `${label} has unknown value`);
  }
  if (typeof value === 'boolean') {
    return value ? ok(value) : fail(`${label} is false`, value);
  }
  // Non-null, non-false values are truthy
  return ok(value);
}

// ============================================================================
// BINARY EXPRESSION HANDLERS
// ============================================================================

function evalBinaryExpr(
  expr: { operator: string; left: Expression; right: Expression },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  switch (expr.operator) {
    // Logical operators (support both word and symbolic forms)
    case 'and':
    case '&&':
      return evalAnd(expr.left, expr.right, ctx, depth, maxDepth);
    case 'or':
    case '||':
      return evalOr(expr.left, expr.right, ctx, depth, maxDepth);
    case 'implies':
      return evalImplies(expr.left, expr.right, ctx, depth, maxDepth);
    case 'iff':
      return evalIff(expr.left, expr.right, ctx, depth, maxDepth);
    
    // Comparison operators
    case '==':
      return evalEquals(expr.left, expr.right, ctx, depth, maxDepth);
    case '!=':
      return evalNotEquals(expr.left, expr.right, ctx, depth, maxDepth);
    case '<':
      return evalLessThan(expr.left, expr.right, ctx, depth, maxDepth);
    case '<=':
      return evalLessOrEqual(expr.left, expr.right, ctx, depth, maxDepth);
    case '>':
      return evalGreaterThan(expr.left, expr.right, ctx, depth, maxDepth);
    case '>=':
      return evalGreaterOrEqual(expr.left, expr.right, ctx, depth, maxDepth);
    
    // Arithmetic operators
    case '+':
      return evalAdd(expr.left, expr.right, ctx, depth, maxDepth);
    case '-':
      return evalSubtract(expr.left, expr.right, ctx, depth, maxDepth);
    case '*':
      return evalMultiply(expr.left, expr.right, ctx, depth, maxDepth);
    case '/':
      return evalDivide(expr.left, expr.right, ctx, depth, maxDepth);
    case '%':
      return evalModulo(expr.left, expr.right, ctx, depth, maxDepth);
    
    // Membership operator
    case 'in':
      return evalIn(expr.left, expr.right, ctx, depth, maxDepth);
    
    default:
      return unknown('UNSUPPORTED_OP', `Unsupported operator: ${expr.operator}`);
  }
}

/**
 * AND with tri-state logic and short-circuit evaluation
 */
function evalAnd(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const leftResult = evalExpr(left, ctx, depth + 1, maxDepth);
  
  // Short-circuit: false && anything = false
  if (leftResult.kind === 'false') {
    return fail('Left operand of AND is false', { left: leftResult });
  }
  
  const rightResult = evalExpr(right, ctx, depth + 1, maxDepth);
  const combined = triAnd(leftResult.kind, rightResult.kind);
  
  if (combined === 'false') {
    return fail('Right operand of AND is false', { left: leftResult, right: rightResult });
  }
  if (combined === 'unknown') {
    return unknown('PROPAGATED', 'AND has unknown operand', { left: leftResult, right: rightResult });
  }
  return ok({ left: leftResult, right: rightResult });
}

/**
 * OR with tri-state logic and short-circuit evaluation
 */
function evalOr(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const leftResult = evalExpr(left, ctx, depth + 1, maxDepth);
  
  // Short-circuit: true || anything = true
  if (leftResult.kind === 'true') {
    return ok({ left: leftResult });
  }
  
  const rightResult = evalExpr(right, ctx, depth + 1, maxDepth);
  const combined = triOr(leftResult.kind, rightResult.kind);
  
  if (combined === 'true') {
    return ok({ left: leftResult, right: rightResult });
  }
  if (combined === 'unknown') {
    return unknown('PROPAGATED', 'OR has unknown operands', { left: leftResult, right: rightResult });
  }
  return fail('Both operands of OR are false', { left: leftResult, right: rightResult });
}

/**
 * IMPLIES implemented as (!A || B) with tri-state logic
 */
function evalImplies(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const leftResult = evalExpr(left, ctx, depth + 1, maxDepth);
  
  // Short-circuit: false implies anything = true (vacuous truth)
  if (leftResult.kind === 'false') {
    return ok({ left: leftResult, reason: 'Antecedent is false (vacuous truth)' });
  }
  
  const rightResult = evalExpr(right, ctx, depth + 1, maxDepth);
  
  // Apply the implies truth table: !A || B
  const notA = triNot(leftResult.kind);
  const combined = triOr(notA, rightResult.kind);
  
  if (combined === 'true') {
    return ok({ left: leftResult, right: rightResult });
  }
  if (combined === 'unknown') {
    return unknown('PROPAGATED', 'Implication has unknown value', { left: leftResult, right: rightResult });
  }
  return fail('Implication failed: antecedent true but consequent false', {
    left: leftResult,
    right: rightResult,
  });
}

/**
 * IFF (biconditional) - true if both sides have the same truth value
 */
function evalIff(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const leftResult = evalExpr(left, ctx, depth + 1, maxDepth);
  const rightResult = evalExpr(right, ctx, depth + 1, maxDepth);
  
  // If either is unknown, result is unknown
  if (leftResult.kind === 'unknown' || rightResult.kind === 'unknown') {
    return unknown('PROPAGATED', 'IFF has unknown operand', { left: leftResult, right: rightResult });
  }
  
  // IFF is true if both sides have the same truth value
  const same = leftResult.kind === rightResult.kind;
  if (same) {
    return ok({ left: leftResult, right: rightResult });
  }
  return fail('IFF: operands have different truth values', { left: leftResult, right: rightResult });
}

// ============================================================================
// COMPARISON HANDLERS
// ============================================================================

function evalEquals(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const leftValue = extractValue(left, ctx, depth, maxDepth);
  const rightValue = extractValue(right, ctx, depth, maxDepth);
  
  if (leftValue === 'unknown' || rightValue === 'unknown') {
    return unknown('PROPAGATED', 'Cannot compare: operand is unknown', { left: leftValue, right: rightValue });
  }
  
  const equal = deepEqual(leftValue, rightValue);
  return equal
    ? ok({ left: leftValue, right: rightValue })
    : fail(`Values not equal: ${stringify(leftValue)} != ${stringify(rightValue)}`, {
        left: leftValue,
        right: rightValue,
      });
}

function evalNotEquals(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const leftValue = extractValue(left, ctx, depth, maxDepth);
  const rightValue = extractValue(right, ctx, depth, maxDepth);
  
  if (leftValue === 'unknown' || rightValue === 'unknown') {
    return unknown('PROPAGATED', 'Cannot compare: operand is unknown', { left: leftValue, right: rightValue });
  }
  
  const notEqual = !deepEqual(leftValue, rightValue);
  return notEqual
    ? ok({ left: leftValue, right: rightValue })
    : fail(`Values equal: ${stringify(leftValue)} == ${stringify(rightValue)}`, {
        left: leftValue,
        right: rightValue,
      });
}

function evalLessThan(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  return evalNumericComparison(left, right, ctx, depth, maxDepth, (a, b) => a < b, '<');
}

function evalLessOrEqual(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  return evalNumericComparison(left, right, ctx, depth, maxDepth, (a, b) => a <= b, '<=');
}

function evalGreaterThan(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  return evalNumericComparison(left, right, ctx, depth, maxDepth, (a, b) => a > b, '>');
}

function evalGreaterOrEqual(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  return evalNumericComparison(left, right, ctx, depth, maxDepth, (a, b) => a >= b, '>=');
}

function evalNumericComparison(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number,
  compareFn: (a: number, b: number) => boolean,
  op: string
): EvalResult {
  const leftValue = extractValue(left, ctx, depth, maxDepth);
  const rightValue = extractValue(right, ctx, depth, maxDepth);
  
  if (leftValue === 'unknown' || rightValue === 'unknown') {
    return unknown('PROPAGATED', `Cannot compare: operand is unknown`, { left: leftValue, right: rightValue });
  }
  
  if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
    return fail(`Cannot compare non-numbers with ${op}`, { left: leftValue, right: rightValue });
  }
  
  const result = compareFn(leftValue, rightValue);
  return result
    ? ok({ left: leftValue, right: rightValue })
    : fail(`${leftValue} ${op} ${rightValue} is false`, { left: leftValue, right: rightValue });
}

// ============================================================================
// ARITHMETIC OPERATORS
// ============================================================================

/**
 * Addition: supports numbers and string concatenation
 */
function evalAdd(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const leftValue = extractValue(left, ctx, depth, maxDepth);
  const rightValue = extractValue(right, ctx, depth, maxDepth);
  
  if (leftValue === 'unknown' || rightValue === 'unknown') {
    return unknown('PROPAGATED', 'Cannot add: operand is unknown', { left: leftValue, right: rightValue });
  }
  
  // String concatenation
  if (typeof leftValue === 'string' || typeof rightValue === 'string') {
    return ok(String(leftValue) + String(rightValue));
  }
  
  // Numeric addition
  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return ok(leftValue + rightValue);
  }
  
  return fail(`Cannot add ${typeof leftValue} and ${typeof rightValue}`, { left: leftValue, right: rightValue });
}

/**
 * Subtraction: numbers only
 */
function evalSubtract(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const leftValue = extractValue(left, ctx, depth, maxDepth);
  const rightValue = extractValue(right, ctx, depth, maxDepth);
  
  if (leftValue === 'unknown' || rightValue === 'unknown') {
    return unknown('PROPAGATED', 'Cannot subtract: operand is unknown', { left: leftValue, right: rightValue });
  }
  
  if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
    return fail(`Cannot subtract non-numbers`, { left: leftValue, right: rightValue });
  }
  
  return ok(leftValue - rightValue);
}

/**
 * Multiplication: numbers only
 */
function evalMultiply(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const leftValue = extractValue(left, ctx, depth, maxDepth);
  const rightValue = extractValue(right, ctx, depth, maxDepth);
  
  if (leftValue === 'unknown' || rightValue === 'unknown') {
    return unknown('PROPAGATED', 'Cannot multiply: operand is unknown', { left: leftValue, right: rightValue });
  }
  
  if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
    return fail(`Cannot multiply non-numbers`, { left: leftValue, right: rightValue });
  }
  
  return ok(leftValue * rightValue);
}

/**
 * Division: numbers only, with divide-by-zero check
 */
function evalDivide(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const leftValue = extractValue(left, ctx, depth, maxDepth);
  const rightValue = extractValue(right, ctx, depth, maxDepth);
  
  if (leftValue === 'unknown' || rightValue === 'unknown') {
    return unknown('PROPAGATED', 'Cannot divide: operand is unknown', { left: leftValue, right: rightValue });
  }
  
  if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
    return fail(`Cannot divide non-numbers`, { left: leftValue, right: rightValue });
  }
  
  if (rightValue === 0) {
    return unknown('DIVISION_BY_ZERO', 'Division by zero', { left: leftValue, right: rightValue });
  }
  
  return ok(leftValue / rightValue);
}

/**
 * Modulo: numbers only, with divide-by-zero check
 */
function evalModulo(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const leftValue = extractValue(left, ctx, depth, maxDepth);
  const rightValue = extractValue(right, ctx, depth, maxDepth);
  
  if (leftValue === 'unknown' || rightValue === 'unknown') {
    return unknown('PROPAGATED', 'Cannot modulo: operand is unknown', { left: leftValue, right: rightValue });
  }
  
  if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
    return fail(`Cannot modulo non-numbers`, { left: leftValue, right: rightValue });
  }
  
  if (rightValue === 0) {
    return unknown('DIVISION_BY_ZERO', 'Modulo by zero', { left: leftValue, right: rightValue });
  }
  
  return ok(leftValue % rightValue);
}

/**
 * Membership test: value in collection
 */
function evalIn(
  left: Expression,
  right: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const leftValue = extractValue(left, ctx, depth, maxDepth);
  const rightValue = extractValue(right, ctx, depth, maxDepth);
  
  if (leftValue === 'unknown' || rightValue === 'unknown') {
    return unknown('PROPAGATED', 'Cannot test membership: operand is unknown', { left: leftValue, right: rightValue });
  }
  
  // Check if right is an array
  if (Array.isArray(rightValue)) {
    for (const item of rightValue) {
      if (deepEqual(leftValue, item)) {
        return ok({ left: leftValue, right: rightValue });
      }
    }
    return fail(`Value not in collection`, { left: leftValue, right: rightValue });
  }
  
  // Check if right is a string (substring check)
  if (typeof rightValue === 'string' && typeof leftValue === 'string') {
    if (rightValue.includes(leftValue)) {
      return ok({ left: leftValue, right: rightValue });
    }
    return fail(`Substring not found`, { left: leftValue, right: rightValue });
  }
  
  // Check if right is an object (key check)
  if (typeof rightValue === 'object' && rightValue !== null) {
    if (typeof leftValue === 'string' && leftValue in (rightValue as Record<string, unknown>)) {
      return ok({ left: leftValue, right: rightValue });
    }
    return fail(`Key not in object`, { left: leftValue, right: rightValue });
  }
  
  return fail(`Cannot test membership in ${typeof rightValue}`, { left: leftValue, right: rightValue });
}

// ============================================================================
// UNARY EXPRESSION HANDLER
// ============================================================================

function evalUnaryExpr(
  expr: { operator: string; operand: Expression },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  switch (expr.operator) {
    // Support both 'not' and '!' for logical negation
    case 'not':
    case '!': {
      const operandResult = evalExpr(expr.operand, ctx, depth + 1, maxDepth);
      const negated = triNot(operandResult.kind);
      return fromKind(negated, `NOT(${operandResult.reason ?? operandResult.kind})`, {
        operand: operandResult,
      });
    }
    
    case '-': {
      const value = extractValue(expr.operand, ctx, depth, maxDepth);
      if (value === 'unknown') {
        return unknown('PROPAGATED', 'Cannot negate unknown value');
      }
      if (typeof value !== 'number') {
        return fail('Cannot negate non-number');
      }
      return ok(-value);
    }
    
    default:
      return unknown('UNSUPPORTED_OP', `Unsupported unary operator: ${expr.operator}`);
  }
}

// ============================================================================
// MEMBER EXPRESSION HANDLER
// ============================================================================

function evalMemberExpr(
  expr: { object: Expression; property: { name: string } },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const objectValue = extractValue(expr.object, ctx, depth, maxDepth);
  const property = expr.property.name;
  
  if (objectValue === 'unknown') {
    return unknown('PROPAGATED', `Cannot access property '${property}': object is unknown`);
  }
  
  if (objectValue === null || objectValue === undefined) {
    return unknown('INVALID_OPERAND', `Cannot access property '${property}': object is null/undefined`);
  }
  
  // Use adapter for safe property access
  const propertyValue = ctx.adapter.getProperty(objectValue, property);
  
  if (propertyValue === 'unknown') {
    return unknown('MISSING_PROPERTY', `Property '${property}' not found or unknown`);
  }
  
  return valueToResult(propertyValue, `Property '${property}'`);
}

// ============================================================================
// INDEX EXPRESSION HANDLER
// ============================================================================

function evalIndexExpr(
  expr: { object: Expression; index: Expression },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const objectValue = extractValue(expr.object, ctx, depth, maxDepth);
  const indexValue = extractValue(expr.index, ctx, depth, maxDepth);
  
  if (objectValue === 'unknown') {
    return unknown('PROPAGATED', 'Cannot index: object is unknown');
  }
  
  if (indexValue === 'unknown') {
    return unknown('PROPAGATED', 'Cannot index: index is unknown');
  }
  
  if (objectValue === null || objectValue === undefined) {
    return unknown('INVALID_OPERAND', 'Cannot index null/undefined');
  }
  
  // Array indexing
  if (Array.isArray(objectValue)) {
    if (typeof indexValue !== 'number') {
      return fail('Array index must be a number', { object: objectValue, index: indexValue });
    }
    const idx = Math.floor(indexValue);
    if (idx < 0 || idx >= objectValue.length) {
      return fail(`Index ${idx} out of bounds (length: ${objectValue.length})`, { object: objectValue, index: idx });
    }
    return valueToResult(objectValue[idx], `Element at index ${idx}`);
  }
  
  // String indexing
  if (typeof objectValue === 'string') {
    if (typeof indexValue !== 'number') {
      return fail('String index must be a number', { object: objectValue, index: indexValue });
    }
    const idx = Math.floor(indexValue);
    if (idx < 0 || idx >= objectValue.length) {
      return fail(`Index ${idx} out of bounds (length: ${objectValue.length})`, { object: objectValue, index: idx });
    }
    return ok(objectValue[idx]);
  }
  
  // Object/Map indexing
  if (typeof objectValue === 'object') {
    const key = typeof indexValue === 'string' ? indexValue : String(indexValue);
    if (!(key in (objectValue as Record<string, unknown>))) {
      return unknown('MISSING_PROPERTY', `Key '${key}' not found in object`);
    }
    const value = (objectValue as Record<string, unknown>)[key];
    return valueToResult(value, `Value at key '${key}'`);
  }
  
  return fail(`Cannot index type ${typeof objectValue}`);
}

// ============================================================================
// CALL EXPRESSION HANDLER
// ============================================================================

function evalCallExpr(
  expr: { callee: Expression; arguments: Expression[] },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  // Handle member calls (e.g., User.exists(...), str.is_valid())
  if (expr.callee.kind === 'MemberExpr') {
    return evalMemberCall(expr, ctx, depth, maxDepth);
  }
  
  // Handle direct function calls
  if (expr.callee.kind === 'Identifier') {
    return evalFunctionCall(expr, ctx, depth, maxDepth);
  }
  
  return unknown('UNSUPPORTED_EXPR', 'Unsupported callee expression type');
}

function evalMemberCall(
  expr: { callee: Expression; arguments: Expression[] },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const memberExpr = expr.callee as { object: Expression; property: { name: string } };
  const method = memberExpr.property.name;
  const objectValue = extractValue(memberExpr.object, ctx, depth, maxDepth);
  const args = expr.arguments.map(arg => extractValue(arg, ctx, depth, maxDepth));
  
  // Handle is_valid method
  if (method === 'is_valid') {
    const target = objectValue !== 'unknown' ? objectValue : args[0];
    if (target === 'unknown') {
      return unknown('PROPAGATED', 'Cannot validate unknown value');
    }
    const result = ctx.adapter.isValid(target);
    return fromKind(result, 'Validation result');
  }
  
  // Handle length method
  if (method === 'length') {
    const target = objectValue !== 'unknown' ? objectValue : args[0];
    if (target === 'unknown') {
      return unknown('PROPAGATED', 'Cannot get length of unknown value');
    }
    const length = ctx.adapter.length(target);
    if (length === 'unknown') {
      return unknown('TYPE_MISMATCH', 'Value does not have length');
    }
    return ok(length);
  }
  
  // Handle exists method (Entity.exists(...))
  if (method === 'exists') {
    if (memberExpr.object.kind === 'Identifier') {
      const entityName = (memberExpr.object as { name: string }).name;
      const criteria = args[0] && typeof args[0] === 'object' ? args[0] as Record<string, unknown> : undefined;
      const result = ctx.adapter.exists(entityName, criteria);
      return fromKind(result, `Entity '${entityName}' existence check`);
    }
  }
  
  // Handle lookup method (Entity.lookup(...))
  if (method === 'lookup') {
    if (memberExpr.object.kind === 'Identifier') {
      const entityName = (memberExpr.object as { name: string }).name;
      const criteria = args[0] && typeof args[0] === 'object' ? args[0] as Record<string, unknown> : undefined;
      const result = ctx.adapter.lookup(entityName, criteria);
      if (result === 'unknown') {
        return unknown('EXTERNAL_CALL', `Entity '${entityName}' lookup returned unknown`);
      }
      return valueToResult(result, `Entity '${entityName}' lookup`);
    }
  }
  
  // Handle string methods
  if (typeof objectValue === 'string') {
    return evalStringMethod(objectValue, method, args);
  }
  
  // Handle array methods
  if (Array.isArray(objectValue)) {
    return evalArrayMethod(objectValue, method, args, expr, ctx, depth, maxDepth);
  }
  
  return unknown('UNSUPPORTED_FUNCTION', `Unknown method: ${method}`);
}

/**
 * Evaluate string methods: startsWith, endsWith, includes, trim, toLowerCase, toUpperCase, split, substring, charAt
 */
function evalStringMethod(str: string, method: string, args: unknown[]): EvalResult {
  switch (method) {
    case 'startsWith': {
      if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot check startsWith with unknown argument');
      if (typeof args[0] !== 'string') return fail('startsWith requires a string argument');
      return str.startsWith(args[0]) ? ok(true) : fail(`String does not start with '${args[0]}'`);
    }
    case 'endsWith': {
      if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot check endsWith with unknown argument');
      if (typeof args[0] !== 'string') return fail('endsWith requires a string argument');
      return str.endsWith(args[0]) ? ok(true) : fail(`String does not end with '${args[0]}'`);
    }
    case 'includes':
    case 'contains': {
      if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot check includes with unknown argument');
      if (typeof args[0] !== 'string') return fail('includes requires a string argument');
      return str.includes(args[0]) ? ok(true) : fail(`String does not contain '${args[0]}'`);
    }
    case 'trim':
      return ok(str.trim());
    case 'toLowerCase':
      return ok(str.toLowerCase());
    case 'toUpperCase':
      return ok(str.toUpperCase());
    case 'split': {
      if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot split with unknown delimiter');
      const delimiter = typeof args[0] === 'string' ? args[0] : '';
      return ok(str.split(delimiter));
    }
    case 'substring':
    case 'slice': {
      if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot substring with unknown start');
      const start = typeof args[0] === 'number' ? args[0] : 0;
      const end = args[1] === 'unknown' ? undefined : (typeof args[1] === 'number' ? args[1] : undefined);
      if (args[1] === 'unknown') return unknown('PROPAGATED', 'Cannot substring with unknown end');
      return ok(str.substring(start, end));
    }
    case 'charAt': {
      if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot charAt with unknown index');
      if (typeof args[0] !== 'number') return fail('charAt requires a number argument');
      const idx = Math.floor(args[0]);
      if (idx < 0 || idx >= str.length) return fail(`Index ${idx} out of bounds`);
      return ok(str.charAt(idx));
    }
    case 'length':
      return ok(str.length);
    case 'replace': {
      if (args[0] === 'unknown' || args[1] === 'unknown') return unknown('PROPAGATED', 'Cannot replace with unknown arguments');
      if (typeof args[0] !== 'string' || typeof args[1] !== 'string') return fail('replace requires string arguments');
      return ok(str.replace(args[0], args[1]));
    }
    case 'replaceAll': {
      if (args[0] === 'unknown' || args[1] === 'unknown') return unknown('PROPAGATED', 'Cannot replaceAll with unknown arguments');
      if (typeof args[0] !== 'string' || typeof args[1] !== 'string') return fail('replaceAll requires string arguments');
      return ok(str.split(args[0]).join(args[1]));
    }
    default:
      return unknown('UNSUPPORTED_FUNCTION', `Unknown string method: ${method}`);
  }
}

/**
 * Evaluate array methods: indexOf, includes, join, slice, concat, reverse, at
 */
function evalArrayMethod(
  arr: unknown[],
  method: string,
  args: unknown[],
  _expr: { callee: Expression; arguments: Expression[] },
  _ctx: EvalContext,
  _depth: number,
  _maxDepth: number
): EvalResult {
  switch (method) {
    case 'indexOf': {
      if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot indexOf with unknown value');
      for (let i = 0; i < arr.length; i++) {
        if (deepEqual(arr[i], args[0])) return ok(i);
      }
      return ok(-1);
    }
    case 'includes':
    case 'contains': {
      if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot check includes with unknown value');
      for (const item of arr) {
        if (deepEqual(item, args[0])) return ok(true);
      }
      return fail('Array does not contain value');
    }
    case 'join': {
      if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot join with unknown separator');
      const sep = typeof args[0] === 'string' ? args[0] : ',';
      return ok(arr.map(v => String(v)).join(sep));
    }
    case 'slice': {
      if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot slice with unknown start');
      const start = typeof args[0] === 'number' ? args[0] : 0;
      const end = args[1] === 'unknown' ? undefined : (typeof args[1] === 'number' ? args[1] : undefined);
      if (args[1] === 'unknown') return unknown('PROPAGATED', 'Cannot slice with unknown end');
      return ok(arr.slice(start, end));
    }
    case 'concat': {
      if (args.some(a => a === 'unknown')) return unknown('PROPAGATED', 'Cannot concat with unknown values');
      let result = [...arr];
      for (const arg of args) {
        if (Array.isArray(arg)) {
          result = result.concat(arg);
        } else {
          result.push(arg);
        }
      }
      return ok(result);
    }
    case 'reverse':
      return ok([...arr].reverse());
    case 'at': {
      if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot access at unknown index');
      if (typeof args[0] !== 'number') return fail('at requires a number argument');
      const idx = Math.floor(args[0]);
      const actualIdx = idx < 0 ? arr.length + idx : idx;
      if (actualIdx < 0 || actualIdx >= arr.length) return fail(`Index ${idx} out of bounds`);
      return valueToResult(arr[actualIdx], `Element at index ${idx}`);
    }
    case 'length':
      return ok(arr.length);
    case 'first':
      if (arr.length === 0) return fail('Cannot get first element of empty array');
      return valueToResult(arr[0], 'First element');
    case 'last':
      if (arr.length === 0) return fail('Cannot get last element of empty array');
      return valueToResult(arr[arr.length - 1], 'Last element');
    case 'isEmpty':
      return arr.length === 0 ? ok(true) : fail('Array is not empty');
    default:
      return unknown('UNSUPPORTED_FUNCTION', `Unknown array method: ${method}`);
  }
}

function evalFunctionCall(
  expr: { callee: Expression; arguments: Expression[] },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const callee = expr.callee as { name: string };
  const name = callee.name;
  const args = expr.arguments.map(arg => extractValue(arg, ctx, depth, maxDepth));
  
  // ============================================================================
  // BUILT-IN FUNCTIONS - WHITELISTED PURE STDLIB FUNCTIONS
  // ============================================================================
  
  // now() - Returns current timestamp (non-deterministic but supported)
  if (name === 'now') {
    const timestamp = ctx.adapter.now();
    return ok(timestamp);
  }
  
  // is_valid(value) - Check if value is non-null/non-empty
  if (name === 'is_valid' && args.length >= 1) {
    if (args[0] === 'unknown') {
      return unknown('PROPAGATED', 'Cannot validate unknown value');
    }
    const result = ctx.adapter.isValid(args[0]);
    return fromKind(result, 'Validation result');
  }
  
  // is_valid_format(value, format) - Check if string matches format
  if (name === 'is_valid_format' && args.length >= 2) {
    if (args[0] === 'unknown') {
      return unknown('PROPAGATED', 'Cannot validate format of unknown value');
    }
    if (typeof args[1] !== 'string') {
      return fail('is_valid_format() requires format name as second argument');
    }
    const result = ctx.adapter.isValidFormat(args[0], args[1]);
    return fromKind(result, `Format validation (${args[1]})`);
  }
  
  // length(value) - Get length of string or array
  if (name === 'length' && args.length >= 1) {
    if (args[0] === 'unknown') {
      return unknown('PROPAGATED', 'Cannot get length of unknown value');
    }
    const length = ctx.adapter.length(args[0]);
    if (length === 'unknown') {
      return unknown('TYPE_MISMATCH', 'Value does not have length');
    }
    return ok(length);
  }
  
  // regex(value, pattern) - Test string against regex
  if (name === 'regex' && args.length >= 2) {
    if (args[0] === 'unknown') {
      return unknown('PROPAGATED', 'Cannot test regex on unknown value');
    }
    if (typeof args[1] !== 'string') {
      return fail('regex() requires pattern as second argument');
    }
    const result = ctx.adapter.regex(args[0], args[1]);
    return fromKind(result, 'Regex match');
  }
  
  // contains(collection, value) - Check if collection contains value
  if (name === 'contains' && args.length >= 2) {
    if (args[0] === 'unknown' || args[1] === 'unknown') {
      return unknown('PROPAGATED', 'Cannot check contains with unknown values');
    }
    const result = ctx.adapter.contains(args[0], args[1]);
    return fromKind(result, 'Contains check');
  }
  
  // exists(entityName, criteria?) - Check if entity exists
  if (name === 'exists' && args.length >= 1) {
    const entityName = args[0];
    if (typeof entityName !== 'string') {
      return fail('exists() requires entity name as first argument');
    }
    const criteria = args[1] && typeof args[1] === 'object' ? args[1] as Record<string, unknown> : undefined;
    const result = ctx.adapter.exists(entityName, criteria);
    return fromKind(result, `Entity '${entityName}' existence check`);
  }
  
  // lookup(entityName, criteria?) - Lookup entity by criteria
  if (name === 'lookup' && args.length >= 1) {
    const entityName = args[0];
    if (typeof entityName !== 'string') {
      return fail('lookup() requires entity name as first argument');
    }
    const criteria = args[1] && typeof args[1] === 'object' ? args[1] as Record<string, unknown> : undefined;
    const result = ctx.adapter.lookup(entityName, criteria);
    if (result === 'unknown') {
      return unknown('EXTERNAL_CALL', `Entity '${entityName}' lookup returned unknown`);
    }
    return valueToResult(result, `Entity '${entityName}' lookup`);
  }
  
  // ============================================================================
  // MATH FUNCTIONS (Pure, deterministic)
  // ============================================================================
  
  if (name === 'abs' && args.length >= 1) {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot compute abs of unknown');
    if (typeof args[0] !== 'number') return fail('abs() requires a number');
    return ok(Math.abs(args[0]));
  }
  
  if (name === 'ceil' && args.length >= 1) {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot compute ceil of unknown');
    if (typeof args[0] !== 'number') return fail('ceil() requires a number');
    return ok(Math.ceil(args[0]));
  }
  
  if (name === 'floor' && args.length >= 1) {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot compute floor of unknown');
    if (typeof args[0] !== 'number') return fail('floor() requires a number');
    return ok(Math.floor(args[0]));
  }
  
  if (name === 'round' && args.length >= 1) {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot compute round of unknown');
    if (typeof args[0] !== 'number') return fail('round() requires a number');
    return ok(Math.round(args[0]));
  }
  
  if (name === 'min' && args.length >= 1) {
    const nums = args.filter(a => a !== 'unknown');
    if (args.some(a => a === 'unknown')) return unknown('PROPAGATED', 'Cannot compute min with unknown values');
    if (nums.some(n => typeof n !== 'number')) return fail('min() requires numbers');
    return ok(Math.min(...(nums as number[])));
  }
  
  if (name === 'max' && args.length >= 1) {
    const nums = args.filter(a => a !== 'unknown');
    if (args.some(a => a === 'unknown')) return unknown('PROPAGATED', 'Cannot compute max with unknown values');
    if (nums.some(n => typeof n !== 'number')) return fail('max() requires numbers');
    return ok(Math.max(...(nums as number[])));
  }
  
  if (name === 'pow' && args.length >= 2) {
    if (args[0] === 'unknown' || args[1] === 'unknown') return unknown('PROPAGATED', 'Cannot compute pow with unknown values');
    if (typeof args[0] !== 'number' || typeof args[1] !== 'number') return fail('pow() requires numbers');
    return ok(Math.pow(args[0], args[1]));
  }
  
  if (name === 'sqrt' && args.length >= 1) {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot compute sqrt of unknown');
    if (typeof args[0] !== 'number') return fail('sqrt() requires a number');
    if (args[0] < 0) return fail('sqrt() of negative number');
    return ok(Math.sqrt(args[0]));
  }
  
  // ============================================================================
  // TYPE CHECKING FUNCTIONS (Pure, deterministic)
  // ============================================================================
  
  if (name === 'typeof') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot get typeof unknown');
    return ok(typeof args[0]);
  }
  
  if (name === 'isNull' || name === 'is_null') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot check if unknown is null');
    return args[0] === null ? ok(true) : fail('Value is not null');
  }
  
  if (name === 'isNumber' || name === 'is_number') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot check if unknown is number');
    return typeof args[0] === 'number' ? ok(true) : fail('Value is not a number');
  }
  
  if (name === 'isString' || name === 'is_string') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot check if unknown is string');
    return typeof args[0] === 'string' ? ok(true) : fail('Value is not a string');
  }
  
  if (name === 'isBoolean' || name === 'is_boolean') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot check if unknown is boolean');
    return typeof args[0] === 'boolean' ? ok(true) : fail('Value is not a boolean');
  }
  
  if (name === 'isArray' || name === 'is_array') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot check if unknown is array');
    return Array.isArray(args[0]) ? ok(true) : fail('Value is not an array');
  }
  
  if (name === 'isObject' || name === 'is_object') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot check if unknown is object');
    return (typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0]))
      ? ok(true) : fail('Value is not an object');
  }
  
  // ============================================================================
  // STRING FUNCTIONS (Pure, deterministic)
  // ============================================================================
  
  if (name === 'concat' && args.length >= 1) {
    if (args.some(a => a === 'unknown')) return unknown('PROPAGATED', 'Cannot concat with unknown values');
    return ok(args.map(a => String(a)).join(''));
  }
  
  if (name === 'upper' || name === 'toUpperCase') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot convert unknown to uppercase');
    if (typeof args[0] !== 'string') return fail('upper() requires a string');
    return ok(args[0].toUpperCase());
  }
  
  if (name === 'lower' || name === 'toLowerCase') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot convert unknown to lowercase');
    if (typeof args[0] !== 'string') return fail('lower() requires a string');
    return ok(args[0].toLowerCase());
  }
  
  if (name === 'trim') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot trim unknown');
    if (typeof args[0] !== 'string') return fail('trim() requires a string');
    return ok(args[0].trim());
  }
  
  if (name === 'startsWith' || name === 'starts_with') {
    if (args[0] === 'unknown' || args[1] === 'unknown') return unknown('PROPAGATED', 'Cannot check startsWith with unknown');
    if (typeof args[0] !== 'string' || typeof args[1] !== 'string') return fail('startsWith() requires strings');
    return args[0].startsWith(args[1]) ? ok(true) : fail(`String does not start with '${args[1]}'`);
  }
  
  if (name === 'endsWith' || name === 'ends_with') {
    if (args[0] === 'unknown' || args[1] === 'unknown') return unknown('PROPAGATED', 'Cannot check endsWith with unknown');
    if (typeof args[0] !== 'string' || typeof args[1] !== 'string') return fail('endsWith() requires strings');
    return args[0].endsWith(args[1]) ? ok(true) : fail(`String does not end with '${args[1]}'`);
  }
  
  // ============================================================================
  // COLLECTION FUNCTIONS (Pure, deterministic)
  // ============================================================================
  
  if (name === 'len' && args.length >= 1) {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot get length of unknown');
    if (typeof args[0] === 'string') return ok(args[0].length);
    if (Array.isArray(args[0])) return ok(args[0].length);
    if (typeof args[0] === 'object' && args[0] !== null) return ok(Object.keys(args[0] as object).length);
    return unknown('TYPE_MISMATCH', 'Value does not have length');
  }
  
  if (name === 'keys' && args.length >= 1) {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot get keys of unknown');
    if (typeof args[0] !== 'object' || args[0] === null) return fail('keys() requires an object');
    return ok(Object.keys(args[0] as object));
  }
  
  if (name === 'values' && args.length >= 1) {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot get values of unknown');
    if (typeof args[0] !== 'object' || args[0] === null) return fail('values() requires an object');
    return ok(Object.values(args[0] as object));
  }
  
  if (name === 'isEmpty' || name === 'is_empty') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot check if unknown is empty');
    if (typeof args[0] === 'string') return args[0].length === 0 ? ok(true) : fail('String is not empty');
    if (Array.isArray(args[0])) return args[0].length === 0 ? ok(true) : fail('Array is not empty');
    if (typeof args[0] === 'object' && args[0] !== null) {
      return Object.keys(args[0] as object).length === 0 ? ok(true) : fail('Object is not empty');
    }
    return fail('Value is not a collection');
  }
  
  // ============================================================================
  // COERCION FUNCTIONS (Pure, deterministic)
  // ============================================================================
  
  if (name === 'toString' || name === 'to_string' || name === 'str') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot convert unknown to string');
    return ok(String(args[0]));
  }
  
  if (name === 'toNumber' || name === 'to_number' || name === 'num') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot convert unknown to number');
    const num = Number(args[0]);
    if (isNaN(num)) return fail('Cannot convert to number');
    return ok(num);
  }
  
  if (name === 'toBoolean' || name === 'to_boolean' || name === 'bool') {
    if (args[0] === 'unknown') return unknown('PROPAGATED', 'Cannot convert unknown to boolean');
    return ok(Boolean(args[0]));
  }
  
  return unknown('UNSUPPORTED_FUNCTION', `Unknown function: ${name}`);
}

// ============================================================================
// QUANTIFIER HANDLER
// ============================================================================

function evalQuantifierExpr(
  expr: { quantifier: string; variable: { name: string }; collection: Expression; predicate: Expression; location?: unknown },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const collection = extractValue(expr.collection, ctx, depth, maxDepth);
  
  if (collection === 'unknown') {
    // Determine if this is a bounded or unbounded domain
    // If the collection expression is a type reference (e.g., Integer, String), it's unbounded
    const isUnboundedDomain = 
      expr.collection.kind === 'Identifier' && 
      ['Integer', 'Number', 'String', 'Int', 'Float'].includes((expr.collection as { name: string }).name);
    
    if (isUnboundedDomain) {
      return unknown(
        'UNBOUNDED_DOMAIN',
        `Cannot evaluate quantifier over unbounded domain: ${(expr.collection as { name: string }).name}`,
        undefined,
        createBlameSpan(expr as Expression, `quantifier.collection`)
      );
    }
    
    return unknown(
      'COLLECTION_UNKNOWN',
      'Cannot evaluate quantifier: collection is unknown',
      undefined,
      createBlameSpan(expr.collection as Expression, 'quantifier.collection')
    );
  }
  
  if (!Array.isArray(collection)) {
    return fail('Quantifier requires an array collection');
  }
  
  const variable = expr.variable.name;
  
  // Empty collection special cases
  if (collection.length === 0) {
    switch (expr.quantifier) {
      case 'all':
        return ok({ reason: 'Vacuously true: empty collection' });
      case 'any':
        return fail('No elements satisfy predicate: empty collection');
      case 'none':
        return ok({ reason: 'Vacuously true: no elements to violate' });
      case 'count':
        return ok(0);
      case 'sum':
        return ok(0);
      case 'filter':
        return ok([]);
    }
  }
  
  // Evaluate predicate for each element
  let allTrue = true;
  let anyTrue = false;
  let hasUnknown = false;
  const results: EvalResult[] = [];
  const trueItems: unknown[] = [];
  let sum = 0;
  let count = 0;
  
  for (const item of collection) {
    const innerCtx: EvalContext = {
      ...ctx,
      variables: new Map(ctx.variables).set(variable, item),
    };
    
    const result = evalExpr(expr.predicate, innerCtx, depth + 1, maxDepth);
    results.push(result);
    
    if (result.kind === 'true') {
      anyTrue = true;
      count++;
      trueItems.push(item);
      // For sum, extract the numeric evidence if available
      if (expr.quantifier === 'sum') {
        const value = result.evidence;
        if (typeof value === 'number') {
          sum += value;
        } else if (typeof item === 'number') {
          sum += item;
        }
      }
    } else if (result.kind === 'false') {
      allTrue = false;
    } else {
      hasUnknown = true;
    }
  }
  
  switch (expr.quantifier) {
    case 'all':
      if (!allTrue) {
        return fail('Not all elements satisfy predicate', { results });
      }
      if (hasUnknown) {
        return unknown('PROPAGATED', 'Some predicate evaluations returned unknown', { results });
      }
      return ok({ results });
    
    case 'any':
      if (anyTrue) {
        return ok({ results });
      }
      if (hasUnknown) {
        return unknown('PROPAGATED', 'No elements definitely satisfy predicate', { results });
      }
      return fail('No elements satisfy predicate', { results });
    
    case 'none':
      if (anyTrue) {
        return fail('Some elements satisfy predicate (expected none)', { results });
      }
      if (hasUnknown) {
        return unknown('PROPAGATED', 'Cannot confirm no elements satisfy predicate', { results });
      }
      return ok({ results });
    
    case 'count':
      if (hasUnknown) {
        return unknown('PROPAGATED', 'Cannot count: some predicate evaluations returned unknown', { results, partialCount: count });
      }
      return ok(count);
    
    case 'sum':
      if (hasUnknown) {
        return unknown('PROPAGATED', 'Cannot sum: some predicate evaluations returned unknown', { results, partialSum: sum });
      }
      return ok(sum);
    
    case 'filter':
      if (hasUnknown) {
        return unknown('PROPAGATED', 'Cannot filter: some predicate evaluations returned unknown', { results, partialFilter: trueItems });
      }
      return ok(trueItems);
    
    default:
      return unknown('UNSUPPORTED_QUANTIFIER', `Unsupported quantifier: ${expr.quantifier}`);
  }
}

// ============================================================================
// LIST EXPRESSION HANDLER
// ============================================================================

function evalListExpr(
  expr: { elements: Expression[] },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const values: unknown[] = [];
  
  for (const element of expr.elements) {
    const value = extractValue(element, ctx, depth, maxDepth);
    if (value === 'unknown') {
      return unknown('ELEMENT_UNKNOWN', 'List contains unknown element');
    }
    values.push(value);
  }
  
  return ok(values);
}

// ============================================================================
// MAP EXPRESSION HANDLER
// ============================================================================

function evalMapExpr(
  expr: { entries: Array<{ key: Expression; value: Expression }> },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const result: Record<string, unknown> = {};
  
  for (const entry of expr.entries) {
    const keyValue = extractValue(entry.key, ctx, depth, maxDepth);
    const valueValue = extractValue(entry.value, ctx, depth, maxDepth);
    
    if (keyValue === 'unknown') {
      return unknown('ELEMENT_UNKNOWN', 'Map contains unknown key');
    }
    if (valueValue === 'unknown') {
      return unknown('ELEMENT_UNKNOWN', 'Map contains unknown value');
    }
    
    // Keys must be convertible to strings
    const key = typeof keyValue === 'string' ? keyValue : String(keyValue);
    result[key] = valueValue;
  }
  
  return ok(result);
}

// ============================================================================
// CONDITIONAL EXPRESSION HANDLER (Ternary)
// ============================================================================

function evalConditionalExpr(
  expr: { condition: Expression; thenBranch: Expression; elseBranch: Expression },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const conditionResult = evalExpr(expr.condition, ctx, depth + 1, maxDepth);
  
  // If condition is unknown, we cannot determine which branch to take
  if (conditionResult.kind === 'unknown') {
    return unknown('PROPAGATED', 'Conditional has unknown condition', { condition: conditionResult });
  }
  
  // Evaluate the appropriate branch
  if (conditionResult.kind === 'true') {
    return evalExpr(expr.thenBranch, ctx, depth + 1, maxDepth);
  } else {
    return evalExpr(expr.elseBranch, ctx, depth + 1, maxDepth);
  }
}

// ============================================================================
// OLD EXPRESSION HANDLER
// ============================================================================

function evalOldExpr(
  expr: { expression: Expression; location?: unknown },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  if (!ctx.oldState) {
    return unknown(
      'MISSING_OLD_STATE',
      'old() called without previous state snapshot',
      undefined,
      createBlameSpan(expr as Expression, 'old()')
    );
  }
  
  // Create context with old state as variables
  const oldCtx: EvalContext = {
    ...ctx,
    variables: new Map([...Array.from(ctx.variables), ...Array.from(ctx.oldState)]),
  };
  
  return evalExpr(expr.expression, oldCtx, depth + 1, maxDepth);
}

// ============================================================================
// INPUT EXPRESSION HANDLER
// ============================================================================

function evalInputExpr(
  expr: { property: { name: string }; location?: unknown },
  ctx: EvalContext
): EvalResult {
  const property = expr.property.name;
  
  if (!ctx.input) {
    return unknown(
      'MISSING_INPUT',
      'Input not available',
      undefined,
      createBlameSpan(expr as Expression, `input.${property}`)
    );
  }
  
  if (!(property in ctx.input)) {
    return unknown(
      'MISSING_INPUT',
      `Input property '${property}' not found`,
      undefined,
      createBlameSpan(expr as Expression, `input.${property}`)
    );
  }
  
  return valueToResult(ctx.input[property], `Input '${property}'`);
}

// ============================================================================
// RESULT EXPRESSION HANDLER
// ============================================================================

function evalResultExpr(
  expr: { property?: { name: string }; location?: unknown },
  ctx: EvalContext,
  _depth: number,
  _maxDepth: number
): EvalResult {
  if (ctx.result === undefined) {
    return unknown(
      'MISSING_RESULT',
      'Result not available',
      undefined,
      createBlameSpan(expr as Expression, 'result')
    );
  }
  
  // If no property specified, return the whole result
  if (!expr.property) {
    return valueToResult(ctx.result, 'Result');
  }
  
  const property = expr.property.name;
  
  // Access property on result
  if (typeof ctx.result !== 'object' || ctx.result === null) {
    return unknown(
      'TYPE_MISMATCH',
      `Cannot access property '${property}' on non-object result`,
      undefined,
      createBlameSpan(expr as Expression, `result.${property}`)
    );
  }
  
  const value = ctx.adapter.getProperty(ctx.result, property);
  if (value === 'unknown') {
    return unknown(
      'MISSING_PROPERTY',
      `Result property '${property}' not found`,
      undefined,
      createBlameSpan(expr as Expression, `result.${property}`)
    );
  }
  
  return valueToResult(value, `Result.${property}`);
}

// ============================================================================
// LAMBDA EXPRESSION HANDLER
// ============================================================================

function evalLambdaExpr(
  expr: { params: Array<{ name: string }>; body: Expression }
): EvalResult {
  // Lambda expressions themselves are values (first-class functions)
  // They can't be evaluated to true/false directly - they need to be called
  // Return the lambda as a value
  return ok({ 
    type: 'lambda',
    params: expr.params.map(p => p.name),
    body: expr.body
  });
}

// ============================================================================
// QUALIFIED NAME HANDLER
// ============================================================================

function evalQualifiedName(
  expr: { parts: Array<{ name: string }> },
  ctx: EvalContext,
  _depth: number,
  _maxDepth: number
): EvalResult {
  if (!expr.parts || expr.parts.length === 0) {
    return unknown('INVALID_OPERAND', 'Empty qualified name');
  }
  
  // Start with the first part as an identifier
  const firstPart = expr.parts[0];
  if (!firstPart) {
    return unknown('INVALID_OPERAND', 'Empty qualified name');
  }
  const firstName = firstPart.name;
  let current: unknown;
  
  // Check special identifiers
  if (firstName === 'input') {
    current = ctx.input;
  } else if (firstName === 'result') {
    current = ctx.result;
  } else if (ctx.variables.has(firstName)) {
    current = ctx.variables.get(firstName);
  } else if (ctx.input && firstName in ctx.input) {
    current = ctx.input[firstName];
  } else {
    return unknown('MISSING_BINDING', `Unknown identifier: '${firstName}'`);
  }
  
  // Navigate through remaining parts
  for (let i = 1; i < expr.parts.length; i++) {
    const partObj = expr.parts[i];
    if (!partObj) continue;
    const part = partObj.name;
    
    if (current === 'unknown') {
      return unknown('PROPAGATED', `Cannot access '${part}': previous part is unknown`);
    }
    
    if (current === null || current === undefined) {
      return unknown('INVALID_OPERAND', `Cannot access '${part}' on null/undefined`);
    }
    
    current = ctx.adapter.getProperty(current, part);
    
    if (current === 'unknown') {
      return unknown('MISSING_PROPERTY', `Property '${part}' not found`);
    }
  }
  
  return valueToResult(current, `QualifiedName: ${expr.parts.map(p => p.name).join('.')}`);
}

// ============================================================================
// DURATION LITERAL HANDLER
// ============================================================================

function evalDurationLiteral(
  expr: { value: number; unit: string }
): EvalResult {
  // Convert duration to milliseconds for consistent handling
  const multipliers: Record<string, number> = {
    'ms': 1,
    'milliseconds': 1,
    'seconds': 1000,
    's': 1000,
    'minutes': 60000,
    'm': 60000,
    'hours': 3600000,
    'h': 3600000,
    'days': 86400000,
    'd': 86400000,
  };
  
  const multiplier = multipliers[expr.unit.toLowerCase()] ?? multipliers[expr.unit];
  if (multiplier === undefined) {
    return unknown('UNSUPPORTED_EXPR', `Unknown duration unit: ${expr.unit}`);
  }
  
  const ms = expr.value * multiplier;
  return ok({ value: expr.value, unit: expr.unit, milliseconds: ms });
}

// ============================================================================
// REGEX LITERAL HANDLER
// ============================================================================

function evalRegexLiteral(
  expr: { pattern: string; flags: string }
): EvalResult {
  // Return the regex as a value (can be used with regex() function)
  try {
    const regex = new RegExp(expr.pattern, expr.flags);
    return ok({ type: 'regex', pattern: expr.pattern, flags: expr.flags, regex });
  } catch {
    return unknown('INVALID_PATTERN', `Invalid regex pattern: ${expr.pattern}`);
  }
}

// ============================================================================
// GENERIC LITERAL HANDLER
// ============================================================================

function evalGenericLiteral(
  expr: { litKind: string; value?: unknown }
): EvalResult {
  switch (expr.litKind) {
    case 'string':
      return ok(expr.value ?? '');
    case 'number':
      return ok(expr.value ?? 0);
    case 'boolean':
      return expr.value ? ok(true) : fail('Boolean literal is false', false);
    case 'null':
      return fail('Null value', null);
    case 'duration':
    case 'regex':
      // These should be handled by specific literal types
      return unknown('UNKNOWN_LITERAL_TYPE', `Generic literal kind '${expr.litKind}' should use specific type`);
    default:
      return unknown('UNKNOWN_LITERAL_TYPE', `Unknown literal kind: ${expr.litKind}`);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract the actual value from an expression
 */
function extractValue(
  expr: Expression,
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): unknown {
  switch (expr.kind) {
    case 'BooleanLiteral':
      return (expr as { value: boolean }).value;
    case 'StringLiteral':
      return (expr as { value: string }).value;
    case 'NumberLiteral':
      return (expr as { value: number }).value;
    case 'NullLiteral':
      return null;
    case 'DurationLiteral': {
      const durationExpr = expr as { value: number; unit: string };
      const multipliers: Record<string, number> = {
        'ms': 1, 'milliseconds': 1, 'seconds': 1000, 's': 1000,
        'minutes': 60000, 'm': 60000, 'hours': 3600000, 'h': 3600000,
        'days': 86400000, 'd': 86400000,
      };
      const multiplier = multipliers[durationExpr.unit.toLowerCase()] ?? 1;
      return durationExpr.value * multiplier;
    }
    case 'RegexLiteral': {
      const regexExpr = expr as { pattern: string; flags: string };
      try {
        return new RegExp(regexExpr.pattern, regexExpr.flags);
      } catch {
        return 'unknown';
      }
    }
    case 'Literal': {
      const lit = expr as { litKind: string; value?: unknown };
      if (lit.litKind === 'null') return null;
      return lit.value ?? 'unknown';
    }
    case 'Identifier': {
      const name = (expr as { name: string }).name;
      if (name === 'true') return true;
      if (name === 'false') return false;
      if (name === 'null') return null;
      if (ctx.variables.has(name)) return ctx.variables.get(name);
      // Handle 'input' as the whole input object
      if (name === 'input') return ctx.input ?? 'unknown';
      if (ctx.input && name in ctx.input) return ctx.input[name];
      if (name === 'result') return ctx.result ?? 'unknown';
      if (name === 'error' && ctx.variables.has('error')) return ctx.variables.get('error');
      return 'unknown';
    }
    case 'QualifiedName': {
      const qn = expr as { parts: Array<{ name: string }> };
      if (!qn.parts || qn.parts.length === 0) return 'unknown';
      let current: unknown;
      const firstPart = qn.parts[0];
      if (!firstPart) return 'unknown';
      const firstName = firstPart.name;
      if (firstName === 'input') current = ctx.input;
      else if (firstName === 'result') current = ctx.result;
      else if (ctx.variables.has(firstName)) current = ctx.variables.get(firstName);
      else if (ctx.input && firstName in ctx.input) current = ctx.input[firstName];
      else return 'unknown';
      for (let i = 1; i < qn.parts.length; i++) {
        if (current === 'unknown' || current === null || current === undefined) return 'unknown';
        const part = qn.parts[i];
        if (!part) continue;
        current = ctx.adapter.getProperty(current, part.name);
      }
      return current;
    }
    case 'MemberExpr': {
      const memberExpr = expr as { object: Expression; property: { name: string } };
      const objectValue = extractValue(memberExpr.object, ctx, depth, maxDepth);
      if (objectValue === 'unknown' || objectValue === null || objectValue === undefined) {
        return 'unknown';
      }
      return ctx.adapter.getProperty(objectValue, memberExpr.property.name);
    }
    case 'IndexExpr': {
      const indexExpr = expr as { object: Expression; index: Expression };
      const objectValue = extractValue(indexExpr.object, ctx, depth, maxDepth);
      const indexValue = extractValue(indexExpr.index, ctx, depth, maxDepth);
      if (objectValue === 'unknown' || indexValue === 'unknown') return 'unknown';
      if (Array.isArray(objectValue) && typeof indexValue === 'number') {
        const idx = Math.floor(indexValue);
        if (idx >= 0 && idx < objectValue.length) return objectValue[idx];
        return 'unknown';
      }
      if (typeof objectValue === 'string' && typeof indexValue === 'number') {
        const idx = Math.floor(indexValue);
        if (idx >= 0 && idx < objectValue.length) return objectValue[idx];
        return 'unknown';
      }
      if (typeof objectValue === 'object' && objectValue !== null) {
        const key = String(indexValue);
        return (objectValue as Record<string, unknown>)[key] ?? 'unknown';
      }
      return 'unknown';
    }
    case 'ListExpr': {
      const listExpr = expr as { elements: Expression[] };
      const values = listExpr.elements.map(el => extractValue(el, ctx, depth, maxDepth));
      if (values.some(v => v === 'unknown')) return 'unknown';
      return values;
    }
    case 'MapExpr': {
      const mapExpr = expr as { entries: Array<{ key: Expression; value: Expression }> };
      const result: Record<string, unknown> = {};
      for (const entry of mapExpr.entries) {
        const key = extractValue(entry.key, ctx, depth, maxDepth);
        const value = extractValue(entry.value, ctx, depth, maxDepth);
        if (key === 'unknown' || value === 'unknown') return 'unknown';
        result[String(key)] = value;
      }
      return result;
    }
    case 'ConditionalExpr': {
      const condExpr = expr as { condition: Expression; thenBranch: Expression; elseBranch: Expression };
      const condResult = evalExpr(condExpr.condition, ctx, depth + 1, maxDepth);
      if (condResult.kind === 'unknown') return 'unknown';
      if (condResult.kind === 'true') {
        return extractValue(condExpr.thenBranch, ctx, depth + 1, maxDepth);
      } else {
        return extractValue(condExpr.elseBranch, ctx, depth + 1, maxDepth);
      }
    }
    case 'CallExpr': {
      // Handle function calls in value extraction context
      const result = evalCallExpr(
        expr as { callee: Expression; arguments: Expression[] },
        ctx,
        depth,
        maxDepth
      );
      // Return the evidence (actual value) if available, otherwise return based on kind
      if (result.evidence !== undefined) return result.evidence;
      if (result.kind === 'true') return true;
      if (result.kind === 'false') return false;
      return 'unknown';
    }
    case 'BinaryExpr': {
      // For arithmetic operations, extract the computed value
      const binExpr = expr as { operator: string; left: Expression; right: Expression };
      const result = evalBinaryExpr(binExpr, ctx, depth + 1, maxDepth);
      if (result.evidence !== undefined) return result.evidence;
      if (result.kind === 'true') return true;
      if (result.kind === 'false') return false;
      return 'unknown';
    }
    case 'UnaryExpr': {
      const unaryExpr = expr as { operator: string; operand: Expression };
      const result = evalUnaryExpr(unaryExpr, ctx, depth + 1, maxDepth);
      if (result.evidence !== undefined) return result.evidence;
      if (result.kind === 'true') return true;
      if (result.kind === 'false') return false;
      return 'unknown';
    }
    case 'OldExpr': {
      // Handle old() expressions - evaluate using old state
      const oldExpr = expr as { expression: Expression };
      if (!ctx.oldState) return 'unknown';
      
      // Create context where old state values take precedence
      const oldCtx: EvalContext = {
        ...ctx,
        variables: new Map([...Array.from(ctx.variables), ...Array.from(ctx.oldState)]),
      };
      
      return extractValue(oldExpr.expression, oldCtx, depth + 1, maxDepth);
    }
    case 'InputExpr': {
      const inputExpr = expr as { property: { name: string } };
      if (!ctx.input || !(inputExpr.property.name in ctx.input)) return 'unknown';
      return ctx.input[inputExpr.property.name];
    }
    case 'ResultExpr': {
      const resultExpr = expr as { property?: { name: string } };
      if (ctx.result === undefined) return 'unknown';
      if (!resultExpr.property) return ctx.result;
      if (typeof ctx.result !== 'object' || ctx.result === null) return 'unknown';
      return ctx.adapter.getProperty(ctx.result, resultExpr.property.name);
    }
    case 'QuantifierExpr': {
      // Quantifiers return their computed result
      const result = evalQuantifierExpr(
        expr as { quantifier: string; variable: { name: string }; collection: Expression; predicate: Expression },
        ctx, depth + 1, maxDepth
      );
      if (result.evidence !== undefined) return result.evidence;
      return 'unknown';
    }
    default:
      return 'unknown';
  }
}

/**
 * Deep equality check
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key =>
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    );
  }
  
  return false;
}

/**
 * Safe stringify for error messages
 */
function stringify(value: unknown): string {
  if (value === 'unknown') return 'unknown';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ============================================================================
// CONSTANT FOLDING PASS
// ============================================================================

/**
 * Constant folding result
 */
export interface FoldResult {
  /** The folded expression (may be simplified or unchanged) */
  expr: Expression;
  /** Whether the expression was folded (simplified) */
  folded: boolean;
  /** If fully constant, the computed value */
  value?: unknown;
}

/**
 * Check if an expression is a constant (no runtime dependencies)
 */
export function isConstant(expr: Expression): boolean {
  switch (expr.kind) {
    case 'BooleanLiteral':
    case 'StringLiteral':
    case 'NumberLiteral':
    case 'NullLiteral':
    case 'DurationLiteral':
    case 'RegexLiteral':
      return true;
    
    case 'Identifier': {
      const name = (expr as { name: string }).name;
      return name === 'true' || name === 'false' || name === 'null';
    }
    
    case 'ListExpr': {
      const listExpr = expr as { elements: Expression[] };
      return listExpr.elements.every(isConstant);
    }
    
    case 'MapExpr': {
      const mapExpr = expr as { entries: Array<{ key: Expression; value: Expression }> };
      return mapExpr.entries.every(e => isConstant(e.key) && isConstant(e.value));
    }
    
    case 'BinaryExpr': {
      const binExpr = expr as { left: Expression; right: Expression };
      return isConstant(binExpr.left) && isConstant(binExpr.right);
    }
    
    case 'UnaryExpr': {
      const unaryExpr = expr as { operand: Expression };
      return isConstant(unaryExpr.operand);
    }
    
    case 'ConditionalExpr': {
      const condExpr = expr as { condition: Expression; thenBranch: Expression; elseBranch: Expression };
      return isConstant(condExpr.condition) && isConstant(condExpr.thenBranch) && isConstant(condExpr.elseBranch);
    }
    
    default:
      return false;
  }
}

/**
 * Fold constant subtrees in an expression
 * This pre-evaluates constant expressions to reduce runtime work
 */
export function foldConstants(expr: Expression): FoldResult {
  // Create a minimal context for constant evaluation
  const ctx = createEvalContext();
  
  switch (expr.kind) {
    // Literals are already folded
    case 'BooleanLiteral':
    case 'StringLiteral':
    case 'NumberLiteral':
    case 'NullLiteral':
    case 'DurationLiteral':
    case 'RegexLiteral':
      return { expr, folded: false, value: extractValue(expr, ctx, 0, 100) };
    
    case 'Identifier': {
      const name = (expr as { name: string }).name;
      if (name === 'true') return { expr, folded: false, value: true };
      if (name === 'false') return { expr, folded: false, value: false };
      if (name === 'null') return { expr, folded: false, value: null };
      return { expr, folded: false };
    }
    
    case 'ListExpr': {
      const listExpr = expr as unknown as { elements: Expression[]; kind: 'ListExpr'; location: unknown };
      let anyFolded = false;
      const newElements: Expression[] = [];
      
      for (const element of listExpr.elements) {
        const result = foldConstants(element);
        newElements.push(result.expr);
        if (result.folded) anyFolded = true;
      }
      
      // If all elements are constant, we could replace with a literal
      // but we keep the structure for now (AST preservation)
      if (anyFolded) {
        return {
          expr: { ...listExpr, elements: newElements } as unknown as Expression,
          folded: true,
        };
      }
      return { expr, folded: false };
    }
    
    case 'BinaryExpr': {
      const binExpr = expr as unknown as { operator: string; left: Expression; right: Expression; kind: 'BinaryExpr'; location: unknown };
      const leftResult = foldConstants(binExpr.left);
      const rightResult = foldConstants(binExpr.right);
      
      // If both operands are constant, evaluate the whole expression
      if (isConstant(leftResult.expr) && isConstant(rightResult.expr)) {
        const result = evalBinaryExpr(
          { operator: binExpr.operator, left: leftResult.expr, right: rightResult.expr },
          ctx, 0, 100
        );
        
        if (result.kind !== 'unknown' && result.evidence !== undefined) {
          // Create a literal from the result
          const value = result.evidence;
          if (typeof value === 'boolean') {
            return {
              expr: { kind: 'BooleanLiteral' as const, value, location: binExpr.location } as unknown as Expression,
              folded: true,
              value,
            };
          }
          if (typeof value === 'number') {
            return {
              expr: { kind: 'NumberLiteral' as const, value, isFloat: !Number.isInteger(value), location: binExpr.location } as unknown as Expression,
              folded: true,
              value,
            };
          }
          if (typeof value === 'string') {
            return {
              expr: { kind: 'StringLiteral' as const, value, location: binExpr.location } as unknown as Expression,
              folded: true,
              value,
            };
          }
        }
      }
      
      // Return with folded children
      const anyFolded = leftResult.folded || rightResult.folded;
      if (anyFolded) {
        return {
          expr: { ...binExpr, left: leftResult.expr, right: rightResult.expr } as unknown as Expression,
          folded: true,
        };
      }
      return { expr, folded: false };
    }
    
    case 'UnaryExpr': {
      const unaryExpr = expr as unknown as { operator: string; operand: Expression; kind: 'UnaryExpr'; location: unknown };
      const operandResult = foldConstants(unaryExpr.operand);
      
      // If operand is constant, evaluate
      if (isConstant(operandResult.expr)) {
        const result = evalUnaryExpr(
          { operator: unaryExpr.operator, operand: operandResult.expr },
          ctx, 0, 100
        );
        
        if (result.kind !== 'unknown' && result.evidence !== undefined) {
          const value = result.evidence;
          if (typeof value === 'boolean') {
            return {
              expr: { kind: 'BooleanLiteral' as const, value, location: unaryExpr.location } as unknown as Expression,
              folded: true,
              value,
            };
          }
          if (typeof value === 'number') {
            return {
              expr: { kind: 'NumberLiteral' as const, value, isFloat: !Number.isInteger(value), location: unaryExpr.location } as unknown as Expression,
              folded: true,
              value,
            };
          }
        }
      }
      
      if (operandResult.folded) {
        return {
          expr: { ...unaryExpr, operand: operandResult.expr } as unknown as Expression,
          folded: true,
        };
      }
      return { expr, folded: false };
    }
    
    case 'ConditionalExpr': {
      const condExpr = expr as unknown as { condition: Expression; thenBranch: Expression; elseBranch: Expression; kind: 'ConditionalExpr'; location: unknown };
      const condResult = foldConstants(condExpr.condition);
      const thenResult = foldConstants(condExpr.thenBranch);
      const elseResult = foldConstants(condExpr.elseBranch);
      
      // If condition is constant, we can simplify to just one branch
      if (isConstant(condResult.expr)) {
        const evalResult = evalExpr(condResult.expr, ctx, 0, 100);
        if (evalResult.kind === 'true') {
          return { expr: thenResult.expr, folded: true, value: thenResult.value };
        }
        if (evalResult.kind === 'false') {
          return { expr: elseResult.expr, folded: true, value: elseResult.value };
        }
      }
      
      const anyFolded = condResult.folded || thenResult.folded || elseResult.folded;
      if (anyFolded) {
        return {
          expr: { ...condExpr, condition: condResult.expr, thenBranch: thenResult.expr, elseBranch: elseResult.expr } as unknown as Expression,
          folded: true,
        };
      }
      return { expr, folded: false };
    }
    
    default:
      // For other expression types, return as-is (could be extended)
      return { expr, folded: false };
  }
}

/**
 * Analyze an expression and return statistics about coverage
 */
export interface ExpressionStats {
  /** Total number of expression nodes */
  totalNodes: number;
  /** Nodes that can be evaluated */
  evaluableNodes: number;
  /** Nodes that would return unknown */
  unknownNodes: number;
  /** Breakdown by expression type */
  byType: Record<string, { total: number; evaluable: number }>;
}

export function analyzeExpression(expr: Expression, ctx: EvalContext): ExpressionStats {
  const stats: ExpressionStats = {
    totalNodes: 0,
    evaluableNodes: 0,
    unknownNodes: 0,
    byType: {},
  };
  
  function analyze(e: Expression): boolean {
    stats.totalNodes++;
    
    const kind = e.kind;
    if (!stats.byType[kind]) {
      stats.byType[kind] = { total: 0, evaluable: 0 };
    }
    stats.byType[kind].total++;
    
    // Try to evaluate
    const result = evalExpr(e, ctx, 0, 100);
    const isEvaluable = result.kind !== 'unknown';
    
    if (isEvaluable) {
      stats.evaluableNodes++;
      stats.byType[kind].evaluable++;
    } else {
      stats.unknownNodes++;
    }
    
    return isEvaluable;
  }
  
  analyze(expr);
  return stats;
}

/**
 * Get a coverage report for the evaluator
 */
export function getCoverageReport(): { supported: string[]; partial: string[]; unsupported: string[] } {
  return {
    supported: [
      'BooleanLiteral', 'StringLiteral', 'NumberLiteral', 'NullLiteral',
      'DurationLiteral', 'RegexLiteral', 'Literal',
      'Identifier', 'QualifiedName',
      'BinaryExpr', 'UnaryExpr',
      'MemberExpr', 'IndexExpr',
      'CallExpr',
      'QuantifierExpr', // all, any, none, count, sum, filter
      'ListExpr', 'MapExpr',
      'ConditionalExpr',
      'OldExpr', 'InputExpr', 'ResultExpr',
      'LambdaExpr', // as value
    ],
    partial: [], // All previously partial types are now fully supported
    unsupported: [], // All expression types are now supported
  };
}
