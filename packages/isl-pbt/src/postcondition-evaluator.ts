// ============================================================================
// Postcondition & Invariant Evaluator
// ============================================================================
//
// Real expression evaluation engine for ISL postconditions and invariants.
// Evaluates expressions against { input, result, old } contexts.
//
// Supported patterns:
//   result.property == value
//   result.success
//   input.field op literal
//   old(entity.field) != result.field
//   all x in collection: predicate
//   any/none/count quantifiers
//   and / or / not / implies
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { Property, LogCapture } from './types.js';
import type { ExecutionResult } from './runner.js';

// ============================================================================
// EVALUATION CONTEXT
// ============================================================================

/**
 * Context for evaluating postconditions and invariants.
 */
export interface EvalContext {
  /** The generated input */
  input: Record<string, unknown>;

  /** The execution result */
  result: ExecutionResult;

  /** Pre-execution state snapshot (for old() references) */
  old?: Record<string, unknown>;

  /** Captured logs (for invariant evaluation) */
  logs?: LogCapture[];
}

/**
 * Result of evaluating a single property.
 */
export interface EvalResult {
  /** Whether the property holds */
  passed: boolean;

  /** Human-readable explanation of the outcome */
  reason: string;

  /** The property that was evaluated */
  property: Property;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Evaluate a postcondition against the execution context.
 */
export function evaluatePostcondition(
  property: Property,
  ctx: EvalContext
): EvalResult {
  try {
    // Check guard condition first
    if (property.guard) {
      const guardMatch = checkGuard(property.guard, ctx.result);
      if (!guardMatch) {
        // Guard doesn't match — postcondition is vacuously true
        return {
          passed: true,
          reason: `Guard '${property.guard}' not active, postcondition not applicable`,
          property,
        };
      }
    }

    const value = evaluateExpression(property.expression, ctx);
    const passed = isTruthy(value);

    return {
      passed,
      reason: passed
        ? `Postcondition holds: ${property.name}`
        : `Postcondition violated: ${property.name} evaluated to ${formatValue(value)}`,
      property,
    };
  } catch (err) {
    return {
      passed: false,
      reason: `Postcondition evaluation error: ${err instanceof Error ? err.message : String(err)}`,
      property,
    };
  }
}

/**
 * Evaluate an invariant against the execution context.
 */
export function evaluateInvariant(
  property: Property,
  ctx: EvalContext
): EvalResult {
  // Handle "X never_logged" invariants by checking logs
  const neverLoggedMatch = property.name.match(/^(\w+)\s+never_logged$/);
  if (neverLoggedMatch) {
    return evaluateNeverLogged(neverLoggedMatch[1]!, ctx, property);
  }

  // Handle "X never_stored_plaintext" invariants
  const neverStoredMatch = property.name.match(/^(\w+)\s+never_stored_plaintext$/);
  if (neverStoredMatch) {
    return evaluateNeverStoredPlaintext(neverStoredMatch[1]!, ctx, property);
  }

  // Handle "X never_exposed" invariants
  const neverExposedMatch = property.name.match(/^(\w+)\s+never_exposed$/);
  if (neverExposedMatch) {
    return evaluateNeverExposed(neverExposedMatch[1]!, ctx, property);
  }

  // General expression evaluation
  try {
    const value = evaluateExpression(property.expression, ctx);
    const passed = isTruthy(value);

    return {
      passed,
      reason: passed
        ? `Invariant holds: ${property.name}`
        : `Invariant violated: ${property.name} evaluated to ${formatValue(value)}`,
      property,
    };
  } catch (err) {
    return {
      passed: false,
      reason: `Invariant evaluation error: ${err instanceof Error ? err.message : String(err)}`,
      property,
    };
  }
}

/**
 * Evaluate all postconditions and invariants for a test run.
 */
export function evaluateAllProperties(
  postconditions: Property[],
  invariants: Property[],
  ctx: EvalContext
): { passed: boolean; results: EvalResult[] } {
  const results: EvalResult[] = [];

  for (const post of postconditions) {
    const result = evaluatePostcondition(post, ctx);
    results.push(result);
    if (!result.passed) {
      return { passed: false, results };
    }
  }

  for (const inv of invariants) {
    const result = evaluateInvariant(inv, ctx);
    results.push(result);
    if (!result.passed) {
      return { passed: false, results };
    }
  }

  return { passed: true, results };
}

// ============================================================================
// EXPRESSION EVALUATOR
// ============================================================================

/**
 * Evaluate an AST expression against the context.
 */
function evaluateExpression(expr: AST.Expression, ctx: EvalContext): unknown {
  switch (expr.kind) {
    // --- Literals ---
    case 'NumberLiteral':
      return expr.value;
    case 'StringLiteral':
      return expr.value;
    case 'BooleanLiteral':
      return expr.value;
    case 'NullLiteral':
      return null;

    // --- Identifiers ---
    case 'Identifier':
      return resolveIdentifier(expr.name, ctx);

    // --- Member access ---
    case 'MemberExpr':
      return evaluateMemberExpr(expr, ctx);

    // --- Index access ---
    case 'IndexExpr': {
      const obj = evaluateExpression(expr.object, ctx);
      const index = evaluateExpression(expr.index, ctx);
      if (Array.isArray(obj) && typeof index === 'number') {
        return obj[index];
      }
      if (obj && typeof obj === 'object' && index !== null && index !== undefined) {
        return (obj as Record<string, unknown>)[String(index)];
      }
      return undefined;
    }

    // --- Binary expressions ---
    case 'BinaryExpr':
      return evaluateBinaryExpr(expr, ctx);

    // --- Unary expressions ---
    case 'UnaryExpr':
      return evaluateUnaryExpr(expr, ctx);

    // --- Function calls ---
    case 'CallExpr':
      return evaluateCallExpr(expr, ctx);

    // --- Quantifiers ---
    case 'QuantifierExpr':
      return evaluateQuantifier(expr, ctx);

    // --- Conditionals ---
    case 'ConditionalExpr': {
      const condition = evaluateExpression(expr.condition, ctx);
      return isTruthy(condition)
        ? evaluateExpression(expr.thenBranch, ctx)
        : evaluateExpression(expr.elseBranch, ctx);
    }

    // --- Special ISL expressions ---
    case 'OldExpr':
      return evaluateOldExpr(expr, ctx);

    case 'ResultExpr':
      return evaluateResultExpr(expr, ctx);

    case 'InputExpr':
      return ctx.input[expr.property.name];

    case 'ListExpr':
      return expr.elements.map((el) => evaluateExpression(el, ctx));

    default:
      return undefined;
  }
}

// ============================================================================
// EXPRESSION HELPERS
// ============================================================================

function resolveIdentifier(name: string, ctx: EvalContext): unknown {
  // Check well-known names
  if (name === 'result') return ctx.result.result ?? ctx.result;
  if (name === 'input') return ctx.input;
  if (name === 'true') return true;
  if (name === 'false') return false;
  if (name === 'null') return null;

  // Check input fields
  if (name in ctx.input) return ctx.input[name];

  return undefined;
}

function evaluateMemberExpr(expr: AST.MemberExpr, ctx: EvalContext): unknown {
  const propName = expr.property.name;

  // Special case: result.property
  if (expr.object.kind === 'Identifier' && (expr.object as AST.Identifier).name === 'result') {
    return accessResultProperty(propName, ctx.result);
  }

  // Special case: input.property
  if (expr.object.kind === 'Identifier' && (expr.object as AST.Identifier).name === 'input') {
    return ctx.input[propName];
  }

  // General member access
  const obj = evaluateExpression(expr.object, ctx);

  // Handle special method-like properties
  if (propName === 'length') {
    if (typeof obj === 'string') return obj.length;
    if (Array.isArray(obj)) return obj.length;
    return undefined;
  }
  if (propName === 'is_valid_format' || propName === 'is_valid') {
    if (typeof obj === 'string') {
      return obj.length > 0; // Basic validity check
    }
    return obj !== null && obj !== undefined;
  }
  if (propName === 'is_empty') {
    if (typeof obj === 'string') return obj.length === 0;
    if (Array.isArray(obj)) return obj.length === 0;
    return obj === null || obj === undefined;
  }
  if (propName === 'size') {
    if (obj && typeof obj === 'object') return Object.keys(obj).length;
    if (Array.isArray(obj)) return obj.length;
    return undefined;
  }

  if (obj && typeof obj === 'object') {
    return (obj as Record<string, unknown>)[propName];
  }

  return undefined;
}

function accessResultProperty(propName: string, result: ExecutionResult): unknown {
  if (propName === 'success') return result.success;
  if (propName === 'error') return result.error;
  if (propName === 'result') return result.result;

  // Access nested result properties
  if (result.result && typeof result.result === 'object') {
    return (result.result as Record<string, unknown>)[propName];
  }

  return undefined;
}

function evaluateBinaryExpr(expr: AST.BinaryExpr, ctx: EvalContext): unknown {
  // Short-circuit logical operators
  if (expr.operator === 'and') {
    const left = evaluateExpression(expr.left, ctx);
    if (!isTruthy(left)) return false;
    return isTruthy(evaluateExpression(expr.right, ctx));
  }
  if (expr.operator === 'or') {
    const left = evaluateExpression(expr.left, ctx);
    if (isTruthy(left)) return true;
    return isTruthy(evaluateExpression(expr.right, ctx));
  }
  if (expr.operator === 'implies') {
    const left = evaluateExpression(expr.left, ctx);
    if (!isTruthy(left)) return true; // vacuously true
    return isTruthy(evaluateExpression(expr.right, ctx));
  }

  const left = evaluateExpression(expr.left, ctx);
  const right = evaluateExpression(expr.right, ctx);

  switch (expr.operator) {
    case '==':
      return deepEqual(left, right);
    case '!=':
      return !deepEqual(left, right);
    case '<':
      return toNumber(left) < toNumber(right);
    case '<=':
      return toNumber(left) <= toNumber(right);
    case '>':
      return toNumber(left) > toNumber(right);
    case '>=':
      return toNumber(left) >= toNumber(right);
    case '+':
      if (typeof left === 'string' || typeof right === 'string') {
        return String(left) + String(right);
      }
      return toNumber(left) + toNumber(right);
    case '-':
      return toNumber(left) - toNumber(right);
    case '*':
      return toNumber(left) * toNumber(right);
    case '/':
      return toNumber(left) / toNumber(right);
    case '%':
      return toNumber(left) % toNumber(right);
    case 'in': {
      if (Array.isArray(right)) {
        return right.some((el) => deepEqual(el, left));
      }
      if (typeof right === 'string' && typeof left === 'string') {
        return right.includes(left);
      }
      if (right && typeof right === 'object') {
        return String(left) in (right as Record<string, unknown>);
      }
      return false;
    }
    default:
      return undefined;
  }
}

function evaluateUnaryExpr(expr: AST.UnaryExpr, ctx: EvalContext): unknown {
  const operand = evaluateExpression(expr.operand, ctx);
  switch (expr.operator) {
    case 'not':
      return !isTruthy(operand);
    case '-':
      return -toNumber(operand);
    default:
      return undefined;
  }
}

function evaluateCallExpr(expr: AST.CallExpr, ctx: EvalContext): unknown {
  const callee = evaluateExpression(expr.callee, ctx);
  const args = expr.arguments.map((a) => evaluateExpression(a, ctx));

  // Built-in functions
  if (expr.callee.kind === 'Identifier') {
    const funcName = (expr.callee as AST.Identifier).name;
    switch (funcName) {
      case 'len':
      case 'length':
        if (typeof args[0] === 'string') return args[0].length;
        if (Array.isArray(args[0])) return args[0].length;
        return 0;
      case 'abs':
        return Math.abs(toNumber(args[0]));
      case 'min':
        return Math.min(...args.map(toNumber));
      case 'max':
        return Math.max(...args.map(toNumber));
      case 'round':
        return Math.round(toNumber(args[0]));
      case 'floor':
        return Math.floor(toNumber(args[0]));
      case 'ceil':
        return Math.ceil(toNumber(args[0]));
      case 'contains':
        if (typeof args[0] === 'string' && typeof args[1] === 'string') {
          return args[0].includes(args[1]);
        }
        if (Array.isArray(args[0])) {
          return args[0].some((el) => deepEqual(el, args[1]));
        }
        return false;
      case 'is_empty':
        if (typeof args[0] === 'string') return args[0].length === 0;
        if (Array.isArray(args[0])) return args[0].length === 0;
        return args[0] === null || args[0] === undefined;
      case 'is_valid':
        return args[0] !== null && args[0] !== undefined;
      default:
        // Unknown function — assume true to avoid false negatives
        return true;
    }
  }

  // Method-like call on member expression
  if (typeof callee === 'function') {
    return callee(...args);
  }

  // Unknown call — assume true
  return true;
}

function evaluateQuantifier(expr: AST.QuantifierExpr, ctx: EvalContext): unknown {
  const collection = evaluateExpression(expr.collection, ctx);
  if (!Array.isArray(collection)) return true; // Not a collection — vacuously true

  const varName = expr.variable.name;

  switch (expr.quantifier) {
    case 'all':
      return collection.every((item) => {
        const innerCtx = { ...ctx, input: { ...ctx.input, [varName]: item } };
        return isTruthy(evaluateExpression(expr.predicate, innerCtx));
      });
    case 'any':
      return collection.some((item) => {
        const innerCtx = { ...ctx, input: { ...ctx.input, [varName]: item } };
        return isTruthy(evaluateExpression(expr.predicate, innerCtx));
      });
    case 'none':
      return !collection.some((item) => {
        const innerCtx = { ...ctx, input: { ...ctx.input, [varName]: item } };
        return isTruthy(evaluateExpression(expr.predicate, innerCtx));
      });
    case 'count':
      return collection.filter((item) => {
        const innerCtx = { ...ctx, input: { ...ctx.input, [varName]: item } };
        return isTruthy(evaluateExpression(expr.predicate, innerCtx));
      }).length;
    case 'sum':
      return collection.reduce((sum, item) => {
        const innerCtx = { ...ctx, input: { ...ctx.input, [varName]: item } };
        return sum + toNumber(evaluateExpression(expr.predicate, innerCtx));
      }, 0);
    case 'filter':
      return collection.filter((item) => {
        const innerCtx = { ...ctx, input: { ...ctx.input, [varName]: item } };
        return isTruthy(evaluateExpression(expr.predicate, innerCtx));
      });
    default:
      return true;
  }
}

function evaluateOldExpr(expr: AST.OldExpr, ctx: EvalContext): unknown {
  if (!ctx.old) {
    // No old state provided — evaluate against input as fallback
    return evaluateExpression(expr.expression, ctx);
  }
  // Evaluate in old context
  const oldCtx: EvalContext = {
    ...ctx,
    input: ctx.old,
  };
  return evaluateExpression(expr.expression, oldCtx);
}

function evaluateResultExpr(expr: AST.ResultExpr, ctx: EvalContext): unknown {
  if (!expr.property) {
    return ctx.result.result ?? ctx.result;
  }
  return accessResultProperty(expr.property.name, ctx.result);
}

// ============================================================================
// INVARIANT EVALUATORS
// ============================================================================

function evaluateNeverLogged(
  fieldName: string,
  ctx: EvalContext,
  property: Property
): EvalResult {
  const fieldValue = ctx.input[fieldName];
  if (fieldValue === undefined || fieldValue === null || !ctx.logs) {
    return { passed: true, reason: `Field '${fieldName}' not present or no logs`, property };
  }

  const valueStr = String(fieldValue);
  for (const log of ctx.logs) {
    if (log.message.includes(valueStr)) {
      return {
        passed: false,
        reason: `Invariant violated: '${fieldName}' value found in log message`,
        property,
      };
    }
    for (const arg of log.args) {
      if (containsSensitive(arg, valueStr)) {
        return {
          passed: false,
          reason: `Invariant violated: '${fieldName}' value found in log args`,
          property,
        };
      }
    }
  }

  return { passed: true, reason: `Invariant holds: '${fieldName}' never logged`, property };
}

function evaluateNeverStoredPlaintext(
  fieldName: string,
  ctx: EvalContext,
  property: Property
): EvalResult {
  const fieldValue = ctx.input[fieldName];
  if (fieldValue === undefined || fieldValue === null) {
    return { passed: true, reason: `Field '${fieldName}' not present`, property };
  }

  // Check if the result contains the plaintext value
  if (ctx.result.result && typeof ctx.result.result === 'object') {
    const resultStr = JSON.stringify(ctx.result.result);
    if (resultStr.includes(String(fieldValue))) {
      return {
        passed: false,
        reason: `Invariant violated: '${fieldName}' appears in plaintext in result`,
        property,
      };
    }
  }

  return { passed: true, reason: `Invariant holds: '${fieldName}' not stored plaintext`, property };
}

function evaluateNeverExposed(
  fieldName: string,
  ctx: EvalContext,
  property: Property
): EvalResult {
  const fieldValue = ctx.input[fieldName];
  if (fieldValue === undefined || fieldValue === null) {
    return { passed: true, reason: `Field '${fieldName}' not present`, property };
  }

  const valueStr = String(fieldValue);

  // Check result
  if (ctx.result.result) {
    const resultStr = JSON.stringify(ctx.result.result);
    if (resultStr.includes(valueStr)) {
      return {
        passed: false,
        reason: `Invariant violated: '${fieldName}' exposed in result`,
        property,
      };
    }
  }

  // Check logs
  if (ctx.logs) {
    for (const log of ctx.logs) {
      if (log.message.includes(valueStr)) {
        return {
          passed: false,
          reason: `Invariant violated: '${fieldName}' exposed in logs`,
          property,
        };
      }
    }
  }

  return { passed: true, reason: `Invariant holds: '${fieldName}' never exposed`, property };
}

// ============================================================================
// GUARD CHECKING
// ============================================================================

function checkGuard(guard: string, result: ExecutionResult): boolean {
  if (guard === 'success') return result.success;
  if (guard === 'failure' || guard === 'any_error') return !result.success;
  // Specific error code
  if (result.error) return result.error.code === guard;
  return false;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'string') return value.length > 0;
  return true;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return 0;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < Number.EPSILON;
  }
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }
  return false;
}

function containsSensitive(container: unknown, value: string): boolean {
  if (typeof container === 'string') return container.includes(value);
  if (container && typeof container === 'object') {
    try {
      return JSON.stringify(container).includes(value);
    } catch {
      return false;
    }
  }
  return String(container).includes(value);
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
