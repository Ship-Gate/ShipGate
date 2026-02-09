// ============================================================================
// ISL Expression Evaluator - Core Implementation
// ============================================================================

import type {
  Expression,
  BinaryExpr,
  UnaryExpr,
  CallExpr,
  MemberExpr,
  Identifier,
  Literal,
  StringLiteral,
  NumberLiteral,
  BooleanLiteral,
  NullLiteral,
  QuantifierExpr,
  ListExpr,
  SourceLocation,
} from '@isl-lang/parser';
import type {
  TriState,
  EvaluationResult,
  EvaluationContext,
  Diagnostic,
  ExpressionAdapter,
} from './types.js';
import {
  triStateAnd,
  triStateOr,
  triStateNot,
  triStateImplies,
  EvaluationError,
} from './types.js';

// ============================================================================
// MAIN EVALUATOR
// ============================================================================

/**
 * Evaluate an ISL expression with tri-state logic
 */
export function evaluate(
  expression: Expression,
  context: EvaluationContext
): EvaluationResult {
  const startTime = performance.now();
  const maxDepth = context.maxDepth ?? 1000;
  let depth = 0;

  const evalExpr = (expr: Expression, loc: SourceLocation, ctx?: EvaluationContext): TriState => {
    const evalContext = ctx ?? context;
    if (++depth > maxDepth) {
      throw new EvaluationError(
        `Maximum evaluation depth exceeded (${maxDepth})`,
        loc
      );
    }

    try {
      switch (expr.kind) {
        case 'BooleanLiteral':
          return expr.value ? 'true' : 'false';

        case 'StringLiteral':
        case 'NumberLiteral':
          return 'true'; // Literals are always known

        case 'NullLiteral':
          return 'false'; // null is falsy

        case 'Identifier':
          return evalIdentifier(expr, evalContext);

        case 'BinaryExpr':
          return evalBinary(expr, evalContext, evalExpr);

        case 'UnaryExpr':
          return evalUnary(expr, evalContext, evalExpr);

        case 'CallExpr':
          return evalCall(expr, evalContext, evalExpr);

        case 'MemberExpr':
          return evalMember(expr, evalContext, evalExpr);

        case 'QuantifierExpr':
          return evalQuantifier(expr, evalContext, evalExpr);

        case 'ListExpr':
          // List literals evaluate to true (non-null)
          return 'true';

        default:
          // For other expression types, return unknown
          return 'unknown';
      }
    } finally {
      depth--;
    }
  };

  const value = evalExpr(expression, expression.location);
  const evaluationTime = performance.now() - startTime;

  return {
    value,
    location: expression.location,
    reason: value === 'unknown' ? 'Expression contains unknown values' : undefined,
    metrics: {
      evaluationTime,
      subExpressionCount: depth,
    },
  };
}

// ============================================================================
// IDENTIFIER EVALUATION
// ============================================================================

function evalIdentifier(
  expr: Identifier,
  context: EvaluationContext
): TriState {
  const name = expr.name;

  // Special identifiers
  if (name === 'true') return 'true';
  if (name === 'false') return 'false';
  if (name === 'null') return 'false';

  // Check variables
  if (context.variables.has(name)) {
    const value = context.variables.get(name);
    return valueToTriState(value);
  }

  // Check input
  if (context.input && name in context.input) {
    const value = context.input[name];
    return valueToTriState(value);
  }

  // Check result
  if (name === 'result' && context.result !== undefined) {
    return valueToTriState(context.result);
  }

  return 'unknown';
}

/**
 * Convert a runtime value to tri-state
 */
function valueToTriState(value: unknown): TriState {
  if (value === null || value === undefined) return 'false';
  if (value === 'unknown') return 'unknown'; // Explicit unknown marker
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  // For other types, assume true (non-null, non-false values are truthy)
  return 'true';
}

// ============================================================================
// BINARY OPERATIONS
// ============================================================================

function evalBinary(
  expr: BinaryExpr,
  context: EvaluationContext,
  evalExpr: (e: Expression, loc: SourceLocation) => TriState
): TriState {
  const left = evalExpr(expr.left, expr.left.location);
  const right = evalExpr(expr.right, expr.right.location);

  switch (expr.operator) {
    // Logical operators
    case 'and':
      return triStateAnd(left, right);

    case 'or':
      return triStateOr(left, right);

    case 'implies':
      return triStateImplies(left, right);

    // Comparison operators
    case '==':
      return evalEquals(left, right, expr.left, expr.right, context);

    case '!=':
      return triStateNot(evalEquals(left, right, expr.left, expr.right, context));

    case '<':
      return evalComparison(left, right, expr.left, expr.right, context, (a, b) => a < b);

    case '<=':
      return evalComparison(left, right, expr.left, expr.right, context, (a, b) => a <= b);

    case '>':
      return evalComparison(left, right, expr.left, expr.right, context, (a, b) => a > b);

    case '>=':
      return evalComparison(left, right, expr.left, expr.right, context, (a, b) => a >= b);

    default:
      return 'unknown';
  }
}

/**
 * Evaluate equality with tri-state logic
 */
function evalEquals(
  left: TriState,
  right: TriState,
  leftExpr: Expression,
  rightExpr: Expression,
  context: EvaluationContext
): TriState {
  // If either is unknown, try to get actual values for comparison
  const leftValue = getRuntimeValue(leftExpr, context);
  const rightValue = getRuntimeValue(rightExpr, context);

  if (leftValue === 'unknown' || rightValue === 'unknown') {
    // If we can't get values, check tri-states
    if (left === 'unknown' || right === 'unknown') {
      return 'unknown';
    }
    // If tri-states are known, compare them
    return left === right ? 'true' : 'false';
  }

  // Deep equality check on actual values
  return deepEqual(leftValue, rightValue) ? 'true' : 'false';
}

/**
 * Evaluate comparison operators
 */
function evalComparison(
  left: TriState,
  right: TriState,
  leftExpr: Expression,
  rightExpr: Expression,
  context: EvaluationContext,
  compareFn: (a: number, b: number) => boolean
): TriState {
  // Always try to get actual numeric values (context may have bound variables)
  const leftValue = getRuntimeValue(leftExpr, context);
  const rightValue = getRuntimeValue(rightExpr, context);

  // If we can't get values, check tri-states
  if (leftValue === 'unknown' || rightValue === 'unknown') {
    // If tri-states are also unknown, return unknown
    if (left === 'unknown' || right === 'unknown') {
      return 'unknown';
    }
    // If we have tri-states but not values, we can't compare
    return 'unknown';
  }

  if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
    return 'unknown';
  }

  return compareFn(leftValue, rightValue) ? 'true' : 'false';
}

// ============================================================================
// UNARY OPERATIONS
// ============================================================================

function evalUnary(
  expr: UnaryExpr,
  context: EvaluationContext,
  evalExpr: (e: Expression, loc: SourceLocation, ctx?: EvaluationContext) => TriState
): TriState {
  const operand = evalExpr(expr.operand, expr.operand.location, context);

  switch (expr.operator) {
    case 'not':
      return triStateNot(operand);

    case '-':
      // Unary minus - get numeric value
      const value = getRuntimeValue(expr.operand, context);
      if (typeof value === 'number') {
        return valueToTriState(-value);
      }
      return 'unknown';

    default:
      return 'unknown';
  }
}

// ============================================================================
// CALL EXPRESSIONS
// ============================================================================

function evalCall(
  expr: CallExpr,
  context: EvaluationContext,
  evalExpr: (e: Expression, loc: SourceLocation, ctx?: EvaluationContext) => TriState
): TriState {
  // Handle member calls (e.g., User.exists(...))
  if (expr.callee.kind === 'MemberExpr') {
    return evalMemberCall(expr, context, evalExpr);
  }

  // Handle direct function calls
  if (expr.callee.kind === 'Identifier') {
    return evalFunctionCall(expr, context, evalExpr);
  }

  return 'unknown';
}

/**
 * Evaluate member method calls (e.g., User.exists(...), str.length)
 */
function evalMemberCall(
  expr: CallExpr,
  context: EvaluationContext,
  evalExpr: (e: Expression, loc: SourceLocation) => TriState
): TriState {
  const memberExpr = expr.callee as MemberExpr;
  const object = getRuntimeValue(memberExpr.object, context);
  const method = memberExpr.property.name;
  const args = expr.arguments.map(arg => getRuntimeValue(arg, context));

  // Handle adapter methods
  if (method === 'is_valid') {
    if (args.length === 0 && object !== 'unknown') {
      return context.adapter.is_valid(object);
    }
    if (args.length === 1) {
      return context.adapter.is_valid(args[0]);
    }
  }

  if (method === 'length') {
    if (object !== 'unknown') {
      const len = context.adapter.length(object);
      return len === 'unknown' ? 'unknown' : 'true';
    }
  }

  if (method === 'exists') {
    // Expect entity name as object or first arg
    if (typeof object === 'string' && args.length === 0) {
      return context.adapter.exists(object);
    }
    if (args.length >= 1 && typeof args[0] === 'string') {
      const criteria = args.length > 1 && typeof args[1] === 'object' 
        ? args[1] as Record<string, unknown>
        : undefined;
      return context.adapter.exists(args[0] as string, criteria);
    }
  }

  if (method === 'lookup') {
    if (typeof object === 'string' && args.length >= 1) {
      const criteria = typeof args[0] === 'object' 
        ? args[0] as Record<string, unknown>
        : undefined;
      const result = context.adapter.lookup(object, criteria);
      return result === 'unknown' ? 'unknown' : valueToTriState(result);
    }
  }

  return 'unknown';
}

/**
 * Evaluate direct function calls
 */
function evalFunctionCall(
  expr: CallExpr,
  context: EvaluationContext,
  evalExpr: (e: Expression, loc: SourceLocation) => TriState
): TriState {
  if (expr.callee.kind !== 'Identifier') {
    return 'unknown';
  }
  const callee = expr.callee;
  const name = callee.name;
  const args = expr.arguments.map(arg => getRuntimeValue(arg, context));

  // Built-in functions
  if (name === 'is_valid' && args.length === 1) {
    return context.adapter.is_valid(args[0]);
  }

  if (name === 'length' && args.length === 1) {
    const len = context.adapter.length(args[0]);
    return len === 'unknown' ? 'unknown' : 'true';
  }

  if (name === 'exists') {
    if (args.length >= 1 && typeof args[0] === 'string') {
      const criteria = args.length > 1 && typeof args[1] === 'object' && args[1] !== null
        ? args[1] as Record<string, unknown>
        : undefined;
      return context.adapter.exists(args[0], criteria);
    }
    return 'unknown';
  }

  if (name === 'lookup') {
    if (args.length >= 1 && typeof args[0] === 'string') {
      const criteria = args.length > 1 && typeof args[1] === 'object' && args[1] !== null
        ? args[1] as Record<string, unknown>
        : undefined;
      const result = context.adapter.lookup(args[0], criteria);
      return result === 'unknown' ? 'unknown' : valueToTriState(result);
    }
    return 'unknown';
  }

  // regex(value, pattern) - test string against regex pattern
  if (name === 'regex' && args.length === 2) {
    const value = args[0];
    const pattern = args[1];
    if (typeof pattern !== 'string') {
      return 'unknown';
    }
    return context.adapter.regex(value, pattern);
  }

  return 'unknown';
}

// ============================================================================
// MEMBER ACCESS
// ============================================================================

function evalMember(
  expr: MemberExpr,
  context: EvaluationContext,
  evalExpr: (e: Expression, loc: SourceLocation, ctx?: EvaluationContext) => TriState
): TriState {
  const object = getRuntimeValue(expr.object, context);
  const property = expr.property.name;

  if (object === 'unknown') {
    return 'unknown';
  }

  const value = context.adapter.getProperty(object, property);
  return value === 'unknown' ? 'unknown' : valueToTriState(value);
}

// ============================================================================
// QUANTIFIERS
// ============================================================================

function evalQuantifier(
  expr: QuantifierExpr,
  context: EvaluationContext,
  evalExpr: (e: Expression, loc: SourceLocation, ctx?: EvaluationContext) => TriState
): TriState {
  const collection = getRuntimeValue(expr.collection, context);

  if (!Array.isArray(collection)) {
    return 'unknown';
  }

  const variable = expr.variable.name;
  const predicate = expr.predicate;

  if (expr.quantifier === 'all') {
    // All elements must satisfy predicate
    let hasUnknown = false;
    for (const item of collection) {
      const itemContext: EvaluationContext = {
        ...context,
        variables: new Map(context.variables).set(variable, item),
      };
      const result = evalExpr(predicate, predicate.location, itemContext);
      if (result === 'false') return 'false';
      if (result === 'unknown') hasUnknown = true;
    }
    return hasUnknown ? 'unknown' : 'true';
  }

  if (expr.quantifier === 'any') {
    // At least one element must satisfy predicate
    let hasUnknown = false;
    for (const item of collection) {
      const itemContext: EvaluationContext = {
        ...context,
        variables: new Map(context.variables).set(variable, item),
      };
      const result = evalExpr(predicate, predicate.location, itemContext);
      if (result === 'true') return 'true';
      if (result === 'unknown') hasUnknown = true;
    }
    return hasUnknown ? 'unknown' : 'false';
  }

  return 'unknown';
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get runtime value from expression (for comparisons)
 * This function is used to get actual values for comparison operations
 */
function getRuntimeValue(expr: Expression, context: EvaluationContext): unknown {
  switch (expr.kind) {
    case 'BooleanLiteral':
      return expr.value;
    case 'StringLiteral':
      return expr.value;
    case 'NumberLiteral':
      return expr.value;
    case 'NullLiteral':
      return null;
    case 'ListExpr':
      // Evaluate list elements
      return expr.elements.map(el => getRuntimeValue(el, context));
    case 'Identifier': {
      const name = expr.name;
      if (context.variables.has(name)) {
        return context.variables.get(name);
      }
      if (context.input && name in context.input) {
        return context.input[name];
      }
      if (name === 'result' && context.result !== undefined) {
        return context.result;
      }
      return 'unknown';
    }
    case 'MemberExpr': {
      const memberExpr = expr as MemberExpr;
      const object = getRuntimeValue(memberExpr.object, context);
      const property = memberExpr.property.name;
      if (object === 'unknown') return 'unknown';
      return context.adapter.getProperty(object, property);
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
  if (typeof a === 'object' && a !== null && b !== null && b !== undefined) {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => deepEqual(val, b[i]));
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  }
  return false;
}
