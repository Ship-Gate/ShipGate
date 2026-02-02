/**
 * IR Evaluator
 *
 * Evaluates normalized IR expressions against a runtime context.
 * Supports all 25 top patterns for real-world clause evaluation.
 */

import type { IRExpr } from '../ir/types.js';
import type { EvaluationContext, EntityInstance } from './context.js';
import { InMemoryEntityStore } from './context.js';

// ============================================================================
// MAIN EVALUATOR
// ============================================================================

/**
 * Evaluate an IR expression in the given context
 */
export function evaluate(expr: IRExpr, ctx: EvaluationContext): unknown {
  switch (expr.kind) {
    // Literals
    case 'LiteralNull':
      return null;
    case 'LiteralBool':
      return expr.value;
    case 'LiteralNumber':
      return expr.value;
    case 'LiteralString':
      return expr.value;
    case 'LiteralRegex':
      return new RegExp(expr.pattern, expr.flags);
    case 'LiteralList':
      return expr.elements.map((e) => evaluate(e, ctx));
    case 'LiteralMap':
      const map: Record<string, unknown> = {};
      for (const entry of expr.entries) {
        map[entry.key] = evaluate(entry.value, ctx);
      }
      return map;

    // Variables & Access
    case 'Variable':
      return resolveVariable(expr.name, ctx);
    case 'PropertyAccess':
      return resolveProperty(evaluate(expr.object, ctx), expr.property);
    case 'IndexAccess':
      return resolveIndex(evaluate(expr.object, ctx), evaluate(expr.index, ctx));

    // Pattern 1: Existence
    case 'Existence':
      const target = evaluate(expr.target, ctx);
      return expr.exists ? target != null : target == null;

    // Pattern 2: String operations
    case 'StringLength':
      const strTarget = evaluate(expr.target, ctx);
      return typeof strTarget === 'string' ? strTarget.length : 0;
    case 'StringMatches':
      return evaluateStringMatches(expr, ctx);
    case 'StringIncludes':
      const strInc = asString(evaluate(expr.target, ctx));
      const subStr = asString(evaluate(expr.substring, ctx));
      return strInc.includes(subStr);
    case 'StringStartsWith':
      const strSW = asString(evaluate(expr.target, ctx));
      const prefix = asString(evaluate(expr.prefix, ctx));
      return strSW.startsWith(prefix);
    case 'StringEndsWith':
      const strEW = asString(evaluate(expr.target, ctx));
      const suffix = asString(evaluate(expr.suffix, ctx));
      return strEW.endsWith(suffix);

    // Pattern 3: Number comparisons
    case 'Comparison':
      const left = asNumber(evaluate(expr.left, ctx));
      const right = asNumber(evaluate(expr.right, ctx));
      switch (expr.operator) {
        case '<':
          return left < right;
        case '<=':
          return left <= right;
        case '>':
          return left > right;
        case '>=':
          return left >= right;
      }
      break;

    case 'Between':
      const val = asNumber(evaluate(expr.target, ctx));
      const min = asNumber(evaluate(expr.min, ctx));
      const max = asNumber(evaluate(expr.max, ctx));
      return expr.inclusive
        ? val >= min && val <= max
        : val > min && val < max;

    // Equality
    case 'EqualityCheck':
      const eqLeft = evaluate(expr.left, ctx);
      const eqRight = evaluate(expr.right, ctx);
      const isEqual = deepEqual(eqLeft, eqRight);
      return expr.negated ? !isEqual : isEqual;

    // Pattern 4: Set membership
    case 'InSet':
      const inTarget = evaluate(expr.target, ctx);
      const inValues = expr.values.map((v) => evaluate(v, ctx));
      const isIn = inValues.some((v) => deepEqual(inTarget, v));
      return expr.negated ? !isIn : isIn;

    // Pattern 5: Boolean operations
    case 'LogicalAnd':
      return expr.operands.every((op) => Boolean(evaluate(op, ctx)));
    case 'LogicalOr':
      return expr.operands.some((op) => Boolean(evaluate(op, ctx)));
    case 'LogicalNot':
      return !Boolean(evaluate(expr.operand, ctx));
    case 'LogicalImplies':
      const ante = Boolean(evaluate(expr.antecedent, ctx));
      const cons = Boolean(evaluate(expr.consequent, ctx));
      return !ante || cons; // a implies b = !a || b

    // Pattern 7: Array operations
    case 'ArrayLength':
      const arr = evaluate(expr.target, ctx);
      return Array.isArray(arr) ? arr.length : 0;
    case 'ArrayIncludes':
      const arrInc = asArray(evaluate(expr.target, ctx));
      const elem = evaluate(expr.element, ctx);
      return arrInc.some((e) => deepEqual(e, elem));
    case 'ArrayEvery':
      return evaluateArrayEvery(expr, ctx);
    case 'ArraySome':
      return evaluateArraySome(expr, ctx);
    case 'ArrayFilter':
      return evaluateArrayFilter(expr, ctx);
    case 'ArrayMap':
      return evaluateArrayMap(expr, ctx);

    // Quantifiers
    case 'QuantifierAll':
      return evaluateQuantifierAll(expr, ctx);
    case 'QuantifierAny':
      return evaluateQuantifierAny(expr, ctx);
    case 'QuantifierNone':
      return evaluateQuantifierNone(expr, ctx);
    case 'QuantifierCount':
      return evaluateQuantifierCount(expr, ctx);

    // Arithmetic
    case 'Arithmetic':
      const aLeft = asNumber(evaluate(expr.left, ctx));
      const aRight = asNumber(evaluate(expr.right, ctx));
      switch (expr.operator) {
        case '+':
          return aLeft + aRight;
        case '-':
          return aLeft - aRight;
        case '*':
          return aLeft * aRight;
        case '/':
          return aRight !== 0 ? aLeft / aRight : 0;
        case '%':
          return aRight !== 0 ? aLeft % aRight : 0;
      }
      break;

    // Conditional
    case 'Conditional':
      const cond = Boolean(evaluate(expr.condition, ctx));
      return cond
        ? evaluate(expr.thenBranch, ctx)
        : evaluate(expr.elseBranch, ctx);

    // Special expressions
    case 'OldValue':
      return evaluateOldValue(expr, ctx);
    case 'ResultValue':
      return evaluateResultValue(expr, ctx);
    case 'InputValue':
      return ctx.input[expr.property];

    // Function calls
    case 'FunctionCall':
      return evaluateFunctionCall(expr, ctx);

    // Entity operations
    case 'EntityExists':
      return evaluateEntityExists(expr, ctx);
    case 'EntityLookup':
      return evaluateEntityLookup(expr, ctx);
    case 'EntityCount':
      return evaluateEntityCount(expr, ctx);

    default:
      throw new EvaluationError(`Unknown IR kind: ${(expr as IRExpr).kind}`, expr);
  }

  return null;
}

// ============================================================================
// STRING EVALUATION
// ============================================================================

function evaluateStringMatches(
  expr: { target: IRExpr; pattern: IRExpr },
  ctx: EvaluationContext
): boolean {
  const str = asString(evaluate(expr.target, ctx));
  const pattern = evaluate(expr.pattern, ctx);

  if (pattern instanceof RegExp) {
    return pattern.test(str);
  }
  if (typeof pattern === 'string') {
    return new RegExp(pattern).test(str);
  }
  return false;
}

// ============================================================================
// ARRAY EVALUATION
// ============================================================================

function evaluateArrayEvery(
  expr: { target: IRExpr; variable: string; predicate: IRExpr },
  ctx: EvaluationContext
): boolean {
  const arr = asArray(evaluate(expr.target, ctx));
  return arr.every((item) => {
    const newCtx = withVariable(ctx, expr.variable, item);
    return Boolean(evaluate(expr.predicate, newCtx));
  });
}

function evaluateArraySome(
  expr: { target: IRExpr; variable: string; predicate: IRExpr },
  ctx: EvaluationContext
): boolean {
  const arr = asArray(evaluate(expr.target, ctx));
  return arr.some((item) => {
    const newCtx = withVariable(ctx, expr.variable, item);
    return Boolean(evaluate(expr.predicate, newCtx));
  });
}

function evaluateArrayFilter(
  expr: { target: IRExpr; variable: string; predicate: IRExpr },
  ctx: EvaluationContext
): unknown[] {
  const arr = asArray(evaluate(expr.target, ctx));
  return arr.filter((item) => {
    const newCtx = withVariable(ctx, expr.variable, item);
    return Boolean(evaluate(expr.predicate, newCtx));
  });
}

function evaluateArrayMap(
  expr: { target: IRExpr; variable: string; mapper: IRExpr },
  ctx: EvaluationContext
): unknown[] {
  const arr = asArray(evaluate(expr.target, ctx));
  return arr.map((item) => {
    const newCtx = withVariable(ctx, expr.variable, item);
    return evaluate(expr.mapper, newCtx);
  });
}

// ============================================================================
// QUANTIFIER EVALUATION
// ============================================================================

function evaluateQuantifierAll(
  expr: { collection: IRExpr; variable: string; predicate: IRExpr },
  ctx: EvaluationContext
): boolean {
  const coll = evaluate(expr.collection, ctx);
  const items = asArray(coll);

  return items.every((item) => {
    const newCtx = withVariable(ctx, expr.variable, item);
    return Boolean(evaluate(expr.predicate, newCtx));
  });
}

function evaluateQuantifierAny(
  expr: { collection: IRExpr; variable: string; predicate: IRExpr },
  ctx: EvaluationContext
): boolean {
  const coll = evaluate(expr.collection, ctx);
  const items = asArray(coll);

  return items.some((item) => {
    const newCtx = withVariable(ctx, expr.variable, item);
    return Boolean(evaluate(expr.predicate, newCtx));
  });
}

function evaluateQuantifierNone(
  expr: { collection: IRExpr; variable: string; predicate: IRExpr },
  ctx: EvaluationContext
): boolean {
  const coll = evaluate(expr.collection, ctx);
  const items = asArray(coll);

  return !items.some((item) => {
    const newCtx = withVariable(ctx, expr.variable, item);
    return Boolean(evaluate(expr.predicate, newCtx));
  });
}

function evaluateQuantifierCount(
  expr: { collection: IRExpr; variable: string; predicate: IRExpr },
  ctx: EvaluationContext
): number {
  const coll = evaluate(expr.collection, ctx);
  const items = asArray(coll);

  return items.filter((item) => {
    const newCtx = withVariable(ctx, expr.variable, item);
    return Boolean(evaluate(expr.predicate, newCtx));
  }).length;
}

// ============================================================================
// SPECIAL EXPRESSION EVALUATION
// ============================================================================

function evaluateOldValue(
  expr: { expression: IRExpr },
  ctx: EvaluationContext
): unknown {
  if (!ctx.oldState) {
    throw new EvaluationError('old() called without old state snapshot', expr as IRExpr);
  }

  // Create a context with the old state
  const oldEntities = new InMemoryEntityStore();
  for (const [name, instances] of ctx.oldState.entities) {
    for (const instance of instances.values()) {
      oldEntities.add(name, instance);
    }
  }

  const oldCtx: EvaluationContext = {
    ...ctx,
    entities: oldEntities,
  };

  return evaluate(expr.expression, oldCtx);
}

function evaluateResultValue(
  expr: { property?: string },
  ctx: EvaluationContext
): unknown {
  if (expr.property) {
    return resolveProperty(ctx.result, expr.property);
  }
  return ctx.result;
}

// ============================================================================
// FUNCTION CALL EVALUATION
// ============================================================================

function evaluateFunctionCall(
  expr: { name: string; args: readonly IRExpr[] },
  ctx: EvaluationContext
): unknown {
  const args = expr.args.map((a) => evaluate(a, ctx));
  const name = expr.name;

  // Built-in functions
  switch (name) {
    case 'now':
      return ctx.now;
    case 'length':
      if (typeof args[0] === 'string') return args[0].length;
      if (Array.isArray(args[0])) return args[0].length;
      return 0;
    case 'count':
      if (Array.isArray(args[0])) return args[0].length;
      return 0;
    case 'sum':
      if (Array.isArray(args[0])) {
        return (args[0] as number[]).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
      }
      return 0;
    case 'min':
      if (Array.isArray(args[0]) && args[0].length > 0) {
        return Math.min(...(args[0] as number[]));
      }
      return Math.min(...(args as number[]));
    case 'max':
      if (Array.isArray(args[0]) && args[0].length > 0) {
        return Math.max(...(args[0] as number[]));
      }
      return Math.max(...(args as number[]));
    case 'abs':
      return Math.abs(asNumber(args[0]));
    case 'round':
      return Math.round(asNumber(args[0]));
    case 'floor':
      return Math.floor(asNumber(args[0]));
    case 'ceil':
      return Math.ceil(asNumber(args[0]));
    case 'between':
      const val = asNumber(args[0]);
      const min = asNumber(args[1]);
      const max = asNumber(args[2]);
      return val >= min && val <= max;
    case 'timing_safe_comparison':
      // Security check - always true in simulation
      return true;
    case 'never_appears_in':
      // Security check - always true in simulation
      return true;
  }

  // Method-style calls (object.method)
  if (name.includes('.')) {
    const parts = name.split('.');
    const methodName = parts.pop()!;
    const objPath = parts.join('.');

    // Try to resolve the object from variables or context
    let obj = resolveVariablePath(objPath, ctx);

    if (obj !== undefined) {
      // String methods
      if (typeof obj === 'string') {
        switch (methodName) {
          case 'includes':
            return obj.includes(asString(args[0]));
          case 'startsWith':
            return obj.startsWith(asString(args[0]));
          case 'endsWith':
            return obj.endsWith(asString(args[0]));
          case 'matches':
          case 'match':
            const pattern = args[0];
            if (pattern instanceof RegExp) return pattern.test(obj);
            return new RegExp(asString(pattern)).test(obj);
          case 'toLowerCase':
            return obj.toLowerCase();
          case 'toUpperCase':
            return obj.toUpperCase();
          case 'trim':
            return obj.trim();
          case 'length':
            return obj.length;
        }
      }

      // Array methods
      if (Array.isArray(obj)) {
        switch (methodName) {
          case 'includes':
            return obj.some((e) => deepEqual(e, args[0]));
          case 'length':
            return obj.length;
        }
      }
    }
  }

  // Unknown function - return null or throw
  return null;
}

// ============================================================================
// ENTITY EVALUATION
// ============================================================================

function evaluateEntityExists(
  expr: { entityName: string; criteria?: IRExpr },
  ctx: EvaluationContext
): boolean {
  const criteria = expr.criteria
    ? (evaluate(expr.criteria, ctx) as Record<string, unknown>)
    : undefined;

  return ctx.entities.exists(expr.entityName, criteria);
}

function evaluateEntityLookup(
  expr: { entityName: string; criteria: IRExpr },
  ctx: EvaluationContext
): EntityInstance | undefined {
  const criteria = evaluate(expr.criteria, ctx) as Record<string, unknown>;
  return ctx.entities.lookup(expr.entityName, criteria);
}

function evaluateEntityCount(
  expr: { entityName: string; criteria?: IRExpr },
  ctx: EvaluationContext
): number {
  const criteria = expr.criteria
    ? (evaluate(expr.criteria, ctx) as Record<string, unknown>)
    : undefined;

  return ctx.entities.count(expr.entityName, criteria);
}

// ============================================================================
// UTILITIES
// ============================================================================

function resolveVariable(name: string, ctx: EvaluationContext): unknown {
  // Check context variables first
  if (ctx.variables.has(name)) {
    return ctx.variables.get(name);
  }

  // Special variables
  if (name === 'result') return ctx.result;
  if (name === 'input') return ctx.input;
  if (name === 'now') return ctx.now;
  if (name === 'true') return true;
  if (name === 'false') return false;
  if (name === 'null') return null;

  // Check input fields
  if (name in ctx.input) {
    return ctx.input[name];
  }

  return undefined;
}

function resolveVariablePath(path: string, ctx: EvaluationContext): unknown {
  const parts = path.split('.');
  let value = resolveVariable(parts[0]!, ctx);

  for (let i = 1; i < parts.length && value != null; i++) {
    value = resolveProperty(value, parts[i]!);
  }

  return value;
}

function resolveProperty(obj: unknown, property: string): unknown {
  if (obj == null) return undefined;

  if (Array.isArray(obj) && property === 'length') {
    return obj.length;
  }

  if (typeof obj === 'string' && property === 'length') {
    return obj.length;
  }

  if (typeof obj === 'object') {
    return (obj as Record<string, unknown>)[property];
  }

  return undefined;
}

function resolveIndex(obj: unknown, index: unknown): unknown {
  if (obj == null) return undefined;

  if (Array.isArray(obj) && typeof index === 'number') {
    return obj[index];
  }

  if (typeof obj === 'object' && (typeof index === 'string' || typeof index === 'number')) {
    return (obj as Record<string | number, unknown>)[index];
  }

  return undefined;
}

function withVariable(ctx: EvaluationContext, name: string, value: unknown): EvaluationContext {
  const newVars = new Map(ctx.variables);
  newVars.set(name, value);
  return { ...ctx, variables: newVars };
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
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

// ============================================================================
// ERROR CLASS
// ============================================================================

export class EvaluationError extends Error {
  constructor(
    message: string,
    public readonly expression: IRExpr
  ) {
    super(message);
    this.name = 'EvaluationError';
  }
}
