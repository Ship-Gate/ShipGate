// ============================================================================
// ISL Expression Evaluator v1 - Core Implementation
// ============================================================================

import type { Expression } from '@isl-lang/parser';
import type { EvalResult, EvalContext, EvalKind, EvalAdapter } from './types.js';
import {
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
} = {}): EvalContext {
  return {
    variables: options.variables ?? new Map(),
    input: options.input ?? {},
    result: options.result,
    oldState: options.oldState,
    adapter: options.adapter ?? new DefaultEvalAdapter(),
    maxDepth: options.maxDepth ?? 1000,
  };
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
  };
}

// ============================================================================
// RECURSIVE EVALUATOR
// ============================================================================

function evalExpr(expr: Expression, ctx: EvalContext, depth: number, maxDepth: number): EvalResult {
  if (depth > maxDepth) {
    return fail(`Maximum evaluation depth (${maxDepth}) exceeded`);
  }

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
    
    // Identifiers
    case 'Identifier':
      return evalIdentifier(expr, ctx);
    
    // Binary operations
    case 'BinaryExpr':
      return evalBinaryExpr(expr, ctx, depth, maxDepth);
    
    // Unary operations
    case 'UnaryExpr':
      return evalUnaryExpr(expr, ctx, depth, maxDepth);
    
    // Member access
    case 'MemberExpr':
      return evalMemberExpr(expr, ctx, depth, maxDepth);
    
    // Function calls
    case 'CallExpr':
      return evalCallExpr(expr, ctx, depth, maxDepth);
    
    // Quantifiers
    case 'QuantifierExpr':
      return evalQuantifierExpr(expr, ctx, depth, maxDepth);
    
    // List literals
    case 'ListExpr':
      return evalListExpr(expr, ctx, depth, maxDepth);
    
    // Old expression (for postconditions)
    case 'OldExpr':
      return evalOldExpr(expr, ctx, depth, maxDepth);
    
    default:
      return unknown(`Unsupported expression kind: ${(expr as { kind: string }).kind}`);
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

function evalIdentifier(expr: { name: string }, ctx: EvalContext): EvalResult {
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
      return unknown('Input not available');
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
      return unknown('Result not available');
    }
    return valueToResult(ctx.result, 'Result');
  }
  
  // Handle 'error' identifier for error variants
  if (name === 'error') {
    // Error is typically checked via comparison, return unknown if not set
    if (ctx.variables.has('error')) {
      return valueToResult(ctx.variables.get('error'), 'Error');
    }
    return unknown('Error not available');
  }

  // Unknown identifier
  return unknown(`Unknown identifier: '${name}'`);
}

/**
 * Convert a runtime value to EvalResult
 */
function valueToResult(value: unknown, label: string): EvalResult {
  if (value === null || value === undefined) {
    return fail(`${label} is null/undefined`, value);
  }
  if (value === 'unknown') {
    return unknown(`${label} has unknown value`);
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
    
    default:
      return unknown(`Unsupported operator: ${expr.operator}`);
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
    return unknown('AND has unknown operand', { left: leftResult, right: rightResult });
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
    return unknown('OR has unknown operands', { left: leftResult, right: rightResult });
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
    return unknown('Implication has unknown value', { left: leftResult, right: rightResult });
  }
  return fail('Implication failed: antecedent true but consequent false', {
    left: leftResult,
    right: rightResult,
  });
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
    return unknown('Cannot compare: operand is unknown', { left: leftValue, right: rightValue });
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
    return unknown('Cannot compare: operand is unknown', { left: leftValue, right: rightValue });
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
    return unknown(`Cannot compare: operand is unknown`, { left: leftValue, right: rightValue });
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
        return unknown('Cannot negate unknown value');
      }
      if (typeof value !== 'number') {
        return fail('Cannot negate non-number');
      }
      return ok(-value);
    }
    
    default:
      return unknown(`Unsupported unary operator: ${expr.operator}`);
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
    return unknown(`Cannot access property '${property}': object is unknown`);
  }
  
  if (objectValue === null || objectValue === undefined) {
    return unknown(`Cannot access property '${property}': object is null/undefined`);
  }
  
  // Use adapter for safe property access
  const propertyValue = ctx.adapter.getProperty(objectValue, property);
  
  if (propertyValue === 'unknown') {
    return unknown(`Property '${property}' not found or unknown`);
  }
  
  return valueToResult(propertyValue, `Property '${property}'`);
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
  
  return unknown('Unsupported callee expression type');
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
      return unknown('Cannot validate unknown value');
    }
    const result = ctx.adapter.isValid(target);
    return fromKind(result, 'Validation result');
  }
  
  // Handle length method
  if (method === 'length') {
    const target = objectValue !== 'unknown' ? objectValue : args[0];
    if (target === 'unknown') {
      return unknown('Cannot get length of unknown value');
    }
    const length = ctx.adapter.length(target);
    if (length === 'unknown') {
      return unknown('Value does not have length');
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
        return unknown(`Entity '${entityName}' lookup returned unknown`);
      }
      return valueToResult(result, `Entity '${entityName}' lookup`);
    }
  }
  
  return unknown(`Unknown method: ${method}`);
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
  // BUILT-IN FUNCTIONS
  // ============================================================================
  
  // now() - Returns current timestamp
  if (name === 'now') {
    const timestamp = ctx.adapter.now();
    return ok(timestamp);
  }
  
  // is_valid(value) - Check if value is non-null/non-empty
  if (name === 'is_valid' && args.length >= 1) {
    if (args[0] === 'unknown') {
      return unknown('Cannot validate unknown value');
    }
    const result = ctx.adapter.isValid(args[0]);
    return fromKind(result, 'Validation result');
  }
  
  // is_valid_format(value, format) - Check if string matches format
  if (name === 'is_valid_format' && args.length >= 2) {
    if (args[0] === 'unknown') {
      return unknown('Cannot validate format of unknown value');
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
      return unknown('Cannot get length of unknown value');
    }
    const length = ctx.adapter.length(args[0]);
    if (length === 'unknown') {
      return unknown('Value does not have length');
    }
    return ok(length);
  }
  
  // regex(value, pattern) - Test string against regex
  if (name === 'regex' && args.length >= 2) {
    if (args[0] === 'unknown') {
      return unknown('Cannot test regex on unknown value');
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
      return unknown('Cannot check contains with unknown values');
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
      return unknown(`Entity '${entityName}' lookup returned unknown`);
    }
    return valueToResult(result, `Entity '${entityName}' lookup`);
  }
  
  return unknown(`Unknown function: ${name}`);
}

// ============================================================================
// QUANTIFIER HANDLER
// ============================================================================

function evalQuantifierExpr(
  expr: { quantifier: string; variable: { name: string }; collection: Expression; predicate: Expression },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  const collection = extractValue(expr.collection, ctx, depth, maxDepth);
  
  if (collection === 'unknown') {
    return unknown('Cannot evaluate quantifier: collection is unknown');
  }
  
  if (!Array.isArray(collection)) {
    return fail('Quantifier requires an array collection');
  }
  
  const variable = expr.variable.name;
  
  // Empty collection special cases
  if (collection.length === 0) {
    if (expr.quantifier === 'all') {
      return ok({ reason: 'Vacuously true: empty collection' });
    }
    if (expr.quantifier === 'any') {
      return fail('No elements satisfy predicate: empty collection');
    }
  }
  
  // Evaluate predicate for each element
  let allTrue = true;
  let anyTrue = false;
  let hasUnknown = false;
  const results: EvalResult[] = [];
  
  for (const item of collection) {
    const innerCtx: EvalContext = {
      ...ctx,
      variables: new Map(ctx.variables).set(variable, item),
    };
    
    const result = evalExpr(expr.predicate, innerCtx, depth + 1, maxDepth);
    results.push(result);
    
    if (result.kind === 'true') {
      anyTrue = true;
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
        return unknown('Some predicate evaluations returned unknown', { results });
      }
      return ok({ results });
    
    case 'any':
      if (anyTrue) {
        return ok({ results });
      }
      if (hasUnknown) {
        return unknown('No elements definitely satisfy predicate', { results });
      }
      return fail('No elements satisfy predicate', { results });
    
    default:
      return unknown(`Unsupported quantifier: ${expr.quantifier}`);
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
      return unknown('List contains unknown element');
    }
    values.push(value);
  }
  
  return ok(values);
}

// ============================================================================
// OLD EXPRESSION HANDLER
// ============================================================================

function evalOldExpr(
  expr: { expression: Expression },
  ctx: EvalContext,
  depth: number,
  maxDepth: number
): EvalResult {
  if (!ctx.oldState) {
    return unknown('old() called without previous state snapshot');
  }
  
  // Create context with old state as variables
  const oldCtx: EvalContext = {
    ...ctx,
    variables: new Map([...ctx.variables, ...ctx.oldState]),
  };
  
  return evalExpr(expr.expression, oldCtx, depth + 1, maxDepth);
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
    case 'MemberExpr': {
      const memberExpr = expr as { object: Expression; property: { name: string } };
      const objectValue = extractValue(memberExpr.object, ctx, depth, maxDepth);
      if (objectValue === 'unknown' || objectValue === null || objectValue === undefined) {
        return 'unknown';
      }
      return ctx.adapter.getProperty(objectValue, memberExpr.property.name);
    }
    case 'ListExpr': {
      const listExpr = expr as { elements: Expression[] };
      return listExpr.elements.map(el => extractValue(el, ctx, depth, maxDepth));
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
    case 'OldExpr': {
      // Handle old() expressions - evaluate using old state
      const oldExpr = expr as { expression: Expression };
      if (!ctx.oldState) return 'unknown';
      
      // Create context where old state values take precedence
      const oldCtx: EvalContext = {
        ...ctx,
        variables: new Map([...ctx.variables, ...ctx.oldState]),
      };
      
      return extractValue(oldExpr.expression, oldCtx, depth + 1, maxDepth);
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
