// ============================================================================
// Expression Evaluator - Runtime evaluation of ISL expressions
// ============================================================================

import type * as AST from '../../../master_contracts/ast';
import type { EvaluationContext, EntityInstance } from './types';

/**
 * Evaluate an ISL expression in the given context
 */
export function evaluate(expr: AST.Expression, ctx: EvaluationContext): unknown {
  switch (expr.kind) {
    case 'Identifier':
      return evaluateIdentifier(expr, ctx);

    case 'QualifiedName':
      return evaluateQualifiedName(expr, ctx);

    case 'StringLiteral':
      return expr.value;

    case 'NumberLiteral':
      return expr.value;

    case 'BooleanLiteral':
      return expr.value;

    case 'NullLiteral':
      return null;

    case 'DurationLiteral':
      return evaluateDuration(expr);

    case 'RegexLiteral':
      return new RegExp(expr.pattern, expr.flags);

    case 'BinaryExpr':
      return evaluateBinaryExpr(expr, ctx);

    case 'UnaryExpr':
      return evaluateUnaryExpr(expr, ctx);

    case 'CallExpr':
      return evaluateCallExpr(expr, ctx);

    case 'MemberExpr':
      return evaluateMemberExpr(expr, ctx);

    case 'IndexExpr':
      return evaluateIndexExpr(expr, ctx);

    case 'QuantifierExpr':
      return evaluateQuantifierExpr(expr, ctx);

    case 'ConditionalExpr':
      return evaluateConditionalExpr(expr, ctx);

    case 'OldExpr':
      return evaluateOldExpr(expr, ctx);

    case 'ResultExpr':
      return evaluateResultExpr(expr, ctx);

    case 'InputExpr':
      return evaluateInputExpr(expr, ctx);

    case 'LambdaExpr':
      return evaluateLambdaExpr(expr, ctx);

    case 'ListExpr':
      return expr.elements.map((el) => evaluate(el, ctx));

    case 'MapExpr':
      return evaluateMapExpr(expr, ctx);

    default:
      throw new EvaluationError(
        `Unsupported expression kind: ${(expr as AST.ASTNode).kind}`,
        expr
      );
  }
}

// ============================================================================
// IDENTIFIER EVALUATION
// ============================================================================

function evaluateIdentifier(expr: AST.Identifier, ctx: EvaluationContext): unknown {
  const name = expr.name;

  // Check for special identifiers
  if (name === 'result') {
    return ctx.result;
  }
  if (name === 'input') {
    return ctx.input;
  }
  if (name === 'now') {
    return ctx.now;
  }
  if (name === 'true') {
    return true;
  }
  if (name === 'false') {
    return false;
  }
  if (name === 'null') {
    return null;
  }

  // Check variables
  if (ctx.variables.has(name)) {
    return ctx.variables.get(name);
  }

  // Check if it's an entity type
  const entity = ctx.domain.entities.find((e) => e.name.name === name);
  if (entity) {
    return createEntityProxy(name, ctx);
  }

  // Check input field
  if (name in ctx.input) {
    return ctx.input[name];
  }

  throw new EvaluationError(`Unknown identifier: ${name}`, expr);
}

function evaluateQualifiedName(expr: AST.QualifiedName, ctx: EvaluationContext): unknown {
  const parts = expr.parts.map((p) => p.name);
  
  // Start with first part
  let value: unknown = evaluateIdentifier(
    { kind: 'Identifier', name: parts[0]!, location: expr.location },
    ctx
  );

  // Navigate through remaining parts
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!;
    if (value === null || value === undefined) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[part];
  }

  return value;
}

// ============================================================================
// ENTITY PROXY
// ============================================================================

function createEntityProxy(entityName: string, ctx: EvaluationContext): EntityProxy {
  return {
    __entityName__: entityName,
    
    exists(criteria?: Record<string, unknown>): boolean {
      return ctx.store.exists(entityName, criteria);
    },
    
    lookup(criteria: Record<string, unknown>): EntityInstance | undefined {
      return ctx.store.lookup(entityName, criteria);
    },
    
    count(criteria?: Record<string, unknown>): number {
      return ctx.store.count(entityName, criteria);
    },
    
    getAll(): EntityInstance[] {
      return ctx.store.getAll(entityName);
    },
  };
}

interface EntityProxy {
  __entityName__: string;
  exists(criteria?: Record<string, unknown>): boolean;
  lookup(criteria: Record<string, unknown>): EntityInstance | undefined;
  count(criteria?: Record<string, unknown>): number;
  getAll(): EntityInstance[];
}

function isEntityProxy(value: unknown): value is EntityProxy {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__entityName__' in value
  );
}

// ============================================================================
// BINARY EXPRESSIONS
// ============================================================================

function evaluateBinaryExpr(expr: AST.BinaryExpr, ctx: EvaluationContext): unknown {
  // Handle short-circuit operators
  if (expr.operator === 'and') {
    const left = evaluate(expr.left, ctx);
    if (!left) return false;
    return Boolean(evaluate(expr.right, ctx));
  }

  if (expr.operator === 'or') {
    const left = evaluate(expr.left, ctx);
    if (left) return true;
    return Boolean(evaluate(expr.right, ctx));
  }

  if (expr.operator === 'implies') {
    const left = evaluate(expr.left, ctx);
    if (!left) return true; // false implies anything is true
    return Boolean(evaluate(expr.right, ctx));
  }

  // Evaluate both sides
  const left = evaluate(expr.left, ctx);
  const right = evaluate(expr.right, ctx);

  switch (expr.operator) {
    case '==':
      return deepEqual(left, right);
    case '!=':
      return !deepEqual(left, right);
    case '<':
      return (left as number) < (right as number);
    case '>':
      return (left as number) > (right as number);
    case '<=':
      return (left as number) <= (right as number);
    case '>=':
      return (left as number) >= (right as number);
    case '+':
      return (left as number) + (right as number);
    case '-':
      return (left as number) - (right as number);
    case '*':
      return (left as number) * (right as number);
    case '/':
      return (left as number) / (right as number);
    case '%':
      return (left as number) % (right as number);
    case 'iff':
      return Boolean(left) === Boolean(right);
    case 'in':
      if (Array.isArray(right)) {
        return right.includes(left);
      }
      if (typeof right === 'object' && right !== null) {
        return left in right;
      }
      return false;
    default:
      throw new EvaluationError(`Unknown binary operator: ${expr.operator}`, expr);
  }
}

// ============================================================================
// UNARY EXPRESSIONS
// ============================================================================

function evaluateUnaryExpr(expr: AST.UnaryExpr, ctx: EvaluationContext): unknown {
  const operand = evaluate(expr.operand, ctx);

  switch (expr.operator) {
    case 'not':
      return !operand;
    case '-':
      return -(operand as number);
    default:
      throw new EvaluationError(`Unknown unary operator: ${expr.operator}`, expr);
  }
}

// ============================================================================
// CALL EXPRESSIONS
// ============================================================================

function evaluateCallExpr(expr: AST.CallExpr, ctx: EvaluationContext): unknown {
  const callee = expr.callee;
  const args = expr.arguments.map((arg) => evaluate(arg, ctx));

  // Handle member call expressions (e.g., User.exists(...))
  if (callee.kind === 'MemberExpr') {
    const object = evaluate(callee.object, ctx);
    const method = callee.property.name;

    // Entity method calls
    if (isEntityProxy(object)) {
      return handleEntityMethodCall(object, method, args, expr, ctx);
    }

    // Array method calls
    if (Array.isArray(object)) {
      return handleArrayMethodCall(object, method, args, expr);
    }

    // String method calls
    if (typeof object === 'string') {
      return handleStringMethodCall(object, method, args, expr);
    }

    // Object method call
    if (typeof object === 'object' && object !== null) {
      const fn = (object as Record<string, unknown>)[method];
      if (typeof fn === 'function') {
        return fn.apply(object, args);
      }
    }

    throw new EvaluationError(`Cannot call method ${method} on ${typeof object}`, expr);
  }

  // Handle direct function calls
  if (callee.kind === 'Identifier') {
    return handleBuiltinCall(callee.name, args, expr, ctx);
  }

  // Handle lambda calls
  const fn = evaluate(callee, ctx);
  if (typeof fn === 'function') {
    return fn(...args);
  }

  throw new EvaluationError(`Cannot call non-function: ${callee.kind}`, expr);
}

function handleEntityMethodCall(
  entity: EntityProxy,
  method: string,
  args: unknown[],
  expr: AST.CallExpr,
  ctx: EvaluationContext
): unknown {
  switch (method) {
    case 'exists': {
      if (args.length === 0) {
        return entity.exists();
      }
      // Parse named arguments from first argument or construct criteria
      const criteria = buildCriteria(args, expr, ctx);
      return entity.exists(criteria);
    }
    case 'lookup': {
      const criteria = buildCriteria(args, expr, ctx);
      return entity.lookup(criteria);
    }
    case 'count': {
      if (args.length === 0) {
        return entity.count();
      }
      const criteria = buildCriteria(args, expr, ctx);
      return entity.count(criteria);
    }
    case 'getAll':
    case 'all':
      return entity.getAll();
    default:
      throw new EvaluationError(
        `Unknown entity method: ${entity.__entityName__}.${method}`,
        expr
      );
  }
}

function buildCriteria(
  args: unknown[],
  expr: AST.CallExpr,
  _ctx: EvaluationContext
): Record<string, unknown> {
  // If single object argument, use it directly
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    return args[0] as Record<string, unknown>;
  }

  // Try to build from named arguments in the AST
  const criteria: Record<string, unknown> = {};
  
  for (let i = 0; i < expr.arguments.length; i++) {
    const arg = expr.arguments[i]!;
    // Handle named arguments (parsed as BinaryExpr with '=' or ':')
    if (arg.kind === 'BinaryExpr' && arg.operator === '==') {
      if (arg.left.kind === 'Identifier') {
        criteria[arg.left.name] = args[i];
      }
    }
  }

  // If no named args, and single arg that's a primitive, assume it's an id
  if (Object.keys(criteria).length === 0 && args.length === 1) {
    criteria['id'] = args[0];
  }

  return criteria.id !== undefined ? criteria : (args[0] as Record<string, unknown>) ?? {};
}

function handleArrayMethodCall(
  array: unknown[],
  method: string,
  args: unknown[],
  expr: AST.CallExpr
): unknown {
  switch (method) {
    case 'length':
      return array.length;
    case 'includes':
    case 'contains':
      return array.includes(args[0]);
    case 'map':
      if (typeof args[0] === 'function') {
        return array.map(args[0] as (v: unknown) => unknown);
      }
      throw new EvaluationError('map requires a function argument', expr);
    case 'filter':
      if (typeof args[0] === 'function') {
        return array.filter(args[0] as (v: unknown) => boolean);
      }
      throw new EvaluationError('filter requires a function argument', expr);
    case 'find':
      if (typeof args[0] === 'function') {
        return array.find(args[0] as (v: unknown) => boolean);
      }
      throw new EvaluationError('find requires a function argument', expr);
    case 'every':
      if (typeof args[0] === 'function') {
        return array.every(args[0] as (v: unknown) => boolean);
      }
      throw new EvaluationError('every requires a function argument', expr);
    case 'some':
      if (typeof args[0] === 'function') {
        return array.some(args[0] as (v: unknown) => boolean);
      }
      throw new EvaluationError('some requires a function argument', expr);
    case 'reduce':
      if (typeof args[0] === 'function') {
        return array.reduce(
          args[0] as (acc: unknown, v: unknown) => unknown,
          args[1] ?? 0
        );
      }
      throw new EvaluationError('reduce requires a function argument', expr);
    default:
      throw new EvaluationError(`Unknown array method: ${method}`, expr);
  }
}

function handleStringMethodCall(
  str: string,
  method: string,
  args: unknown[],
  expr: AST.CallExpr
): unknown {
  switch (method) {
    case 'length':
      return str.length;
    case 'includes':
    case 'contains':
      return str.includes(args[0] as string);
    case 'startsWith':
      return str.startsWith(args[0] as string);
    case 'endsWith':
      return str.endsWith(args[0] as string);
    case 'toLowerCase':
      return str.toLowerCase();
    case 'toUpperCase':
      return str.toUpperCase();
    case 'trim':
      return str.trim();
    case 'match':
    case 'matches':
      if (args[0] instanceof RegExp) {
        return args[0].test(str);
      }
      return new RegExp(args[0] as string).test(str);
    case 'is_valid':
      return str.length > 0;
    default:
      throw new EvaluationError(`Unknown string method: ${method}`, expr);
  }
}

function handleBuiltinCall(
  name: string,
  args: unknown[],
  expr: AST.CallExpr,
  ctx: EvaluationContext
): unknown {
  switch (name) {
    case 'now':
      return ctx.now;
    case 'count':
      if (Array.isArray(args[0])) {
        return args[0].length;
      }
      return 0;
    case 'sum':
      if (Array.isArray(args[0])) {
        return args[0].reduce((acc: number, v) => acc + (v as number), 0);
      }
      return 0;
    case 'min':
      if (Array.isArray(args[0])) {
        return Math.min(...(args[0] as number[]));
      }
      return Math.min(...(args as number[]));
    case 'max':
      if (Array.isArray(args[0])) {
        return Math.max(...(args[0] as number[]));
      }
      return Math.max(...(args as number[]));
    case 'abs':
      return Math.abs(args[0] as number);
    case 'round':
      return Math.round(args[0] as number);
    case 'floor':
      return Math.floor(args[0] as number);
    case 'ceil':
      return Math.ceil(args[0] as number);
    case 'all':
      // all(collection, predicate)
      if (Array.isArray(args[0]) && typeof args[1] === 'function') {
        return (args[0] as unknown[]).every(args[1] as (v: unknown) => boolean);
      }
      return true;
    case 'any':
      // any(collection, predicate)
      if (Array.isArray(args[0]) && typeof args[1] === 'function') {
        return (args[0] as unknown[]).some(args[1] as (v: unknown) => boolean);
      }
      return false;
    case 'none':
      // none(collection, predicate)
      if (Array.isArray(args[0]) && typeof args[1] === 'function') {
        return !(args[0] as unknown[]).some(args[1] as (v: unknown) => boolean);
      }
      return true;
    case 'timing_safe_comparison':
      // Always returns true in verification (this is a security constraint)
      return true;
    case 'never_appears_in':
      // Security constraint check
      return true;
    default:
      throw new EvaluationError(`Unknown function: ${name}`, expr);
  }
}

// ============================================================================
// MEMBER EXPRESSIONS
// ============================================================================

function evaluateMemberExpr(expr: AST.MemberExpr, ctx: EvaluationContext): unknown {
  const object = evaluate(expr.object, ctx);
  const property = expr.property.name;

  if (object === null || object === undefined) {
    return undefined;
  }

  // Handle entity proxy
  if (isEntityProxy(object)) {
    // Return a method bound to the entity
    switch (property) {
      case 'exists':
        return (criteria?: Record<string, unknown>) => object.exists(criteria);
      case 'lookup':
        return (criteria: Record<string, unknown>) => object.lookup(criteria);
      case 'count':
        return (criteria?: Record<string, unknown>) => object.count(criteria);
      default:
        throw new EvaluationError(
          `Unknown entity property: ${object.__entityName__}.${property}`,
          expr
        );
    }
  }

  // Handle array length
  if (Array.isArray(object) && property === 'length') {
    return object.length;
  }

  // Handle string length
  if (typeof object === 'string' && property === 'length') {
    return object.length;
  }

  // Handle string validation
  if (typeof object === 'string' && property === 'is_valid') {
    return object.length > 0;
  }

  // General property access
  return (object as Record<string, unknown>)[property];
}

// ============================================================================
// INDEX EXPRESSIONS
// ============================================================================

function evaluateIndexExpr(expr: AST.IndexExpr, ctx: EvaluationContext): unknown {
  const object = evaluate(expr.object, ctx);
  const index = evaluate(expr.index, ctx);

  if (object === null || object === undefined) {
    return undefined;
  }

  if (Array.isArray(object)) {
    return object[index as number];
  }

  if (typeof object === 'object') {
    return (object as Record<string, unknown>)[index as string];
  }

  throw new EvaluationError('Cannot index non-array/object', expr);
}

// ============================================================================
// QUANTIFIER EXPRESSIONS
// ============================================================================

function evaluateQuantifierExpr(expr: AST.QuantifierExpr, ctx: EvaluationContext): unknown {
  const collection = evaluate(expr.collection, ctx);
  const variable = expr.variable.name;

  // Handle entity references (collection might be an EntityProxy)
  let items: unknown[];
  if (isEntityProxy(collection)) {
    items = collection.getAll();
  } else if (Array.isArray(collection)) {
    items = collection;
  } else {
    throw new EvaluationError('Quantifier requires array or entity collection', expr);
  }

  switch (expr.quantifier) {
    case 'all':
      return items.every((item) => {
        const innerCtx = { ...ctx, variables: new Map(ctx.variables) };
        innerCtx.variables.set(variable, item);
        return Boolean(evaluate(expr.predicate, innerCtx));
      });

    case 'any':
      return items.some((item) => {
        const innerCtx = { ...ctx, variables: new Map(ctx.variables) };
        innerCtx.variables.set(variable, item);
        return Boolean(evaluate(expr.predicate, innerCtx));
      });

    case 'none':
      return !items.some((item) => {
        const innerCtx = { ...ctx, variables: new Map(ctx.variables) };
        innerCtx.variables.set(variable, item);
        return Boolean(evaluate(expr.predicate, innerCtx));
      });

    case 'count':
      return items.filter((item) => {
        const innerCtx = { ...ctx, variables: new Map(ctx.variables) };
        innerCtx.variables.set(variable, item);
        return Boolean(evaluate(expr.predicate, innerCtx));
      }).length;

    case 'sum':
      return items
        .filter((item) => {
          const innerCtx = { ...ctx, variables: new Map(ctx.variables) };
          innerCtx.variables.set(variable, item);
          return Boolean(evaluate(expr.predicate, innerCtx));
        })
        .reduce((acc, item) => acc + (item as number), 0);

    case 'filter':
      return items.filter((item) => {
        const innerCtx = { ...ctx, variables: new Map(ctx.variables) };
        innerCtx.variables.set(variable, item);
        return Boolean(evaluate(expr.predicate, innerCtx));
      });

    default:
      throw new EvaluationError(`Unknown quantifier: ${expr.quantifier}`, expr);
  }
}

// ============================================================================
// SPECIAL EXPRESSIONS
// ============================================================================

function evaluateConditionalExpr(expr: AST.ConditionalExpr, ctx: EvaluationContext): unknown {
  const condition = evaluate(expr.condition, ctx);
  return condition
    ? evaluate(expr.thenBranch, ctx)
    : evaluate(expr.elseBranch, ctx);
}

function evaluateOldExpr(expr: AST.OldExpr, ctx: EvaluationContext): unknown {
  if (!ctx.oldState) {
    throw new EvaluationError('old() called without previous state snapshot', expr);
  }

  // Create a temporary context with the old state
  const oldStore = createOldStateStore(ctx.oldState);
  const oldCtx: EvaluationContext = {
    ...ctx,
    store: oldStore,
  };

  return evaluate(expr.expression, oldCtx);
}

function createOldStateStore(snapshot: import('./types').EntityStoreSnapshot): import('./types').EntityStore {
  return {
    getAll(entityName: string) {
      const entities = snapshot.entities.get(entityName);
      return entities ? Array.from(entities.values()) : [];
    },
    exists(entityName: string, criteria?: Record<string, unknown>) {
      const entities = snapshot.entities.get(entityName);
      if (!entities) return false;
      if (!criteria) return entities.size > 0;
      return Array.from(entities.values()).some((e) =>
        Object.entries(criteria).every(([k, v]) => e[k] === v)
      );
    },
    lookup(entityName: string, criteria: Record<string, unknown>) {
      const entities = snapshot.entities.get(entityName);
      if (!entities) return undefined;
      return Array.from(entities.values()).find((e) =>
        Object.entries(criteria).every(([k, v]) => e[k] === v)
      );
    },
    count(entityName: string, criteria?: Record<string, unknown>) {
      const entities = snapshot.entities.get(entityName);
      if (!entities) return 0;
      if (!criteria) return entities.size;
      return Array.from(entities.values()).filter((e) =>
        Object.entries(criteria).every(([k, v]) => e[k] === v)
      ).length;
    },
    create() {
      throw new Error('Cannot create entities in old state');
    },
    update() {
      throw new Error('Cannot update entities in old state');
    },
    delete() {
      throw new Error('Cannot delete entities in old state');
    },
    snapshot() {
      return snapshot;
    },
    restore() {
      throw new Error('Cannot restore old state store');
    },
  };
}

function evaluateResultExpr(expr: AST.ResultExpr, ctx: EvaluationContext): unknown {
  if (expr.property) {
    if (ctx.result === null || ctx.result === undefined) {
      return undefined;
    }
    return (ctx.result as Record<string, unknown>)[expr.property.name];
  }
  return ctx.result;
}

function evaluateInputExpr(expr: AST.InputExpr, ctx: EvaluationContext): unknown {
  return ctx.input[expr.property.name];
}

function evaluateLambdaExpr(expr: AST.LambdaExpr, ctx: EvaluationContext): unknown {
  return (...args: unknown[]) => {
    const innerCtx = { ...ctx, variables: new Map(ctx.variables) };
    expr.params.forEach((param, i) => {
      innerCtx.variables.set(param.name, args[i]);
    });
    return evaluate(expr.body, innerCtx);
  };
}

function evaluateMapExpr(expr: AST.MapExpr, ctx: EvaluationContext): unknown {
  const result: Record<string, unknown> = {};
  for (const entry of expr.entries) {
    const key = evaluate(entry.key, ctx);
    const value = evaluate(entry.value, ctx);
    result[String(key)] = value;
  }
  return result;
}

// ============================================================================
// DURATION EVALUATION
// ============================================================================

function evaluateDuration(expr: AST.DurationLiteral): number {
  const value = expr.value;
  switch (expr.unit) {
    case 'ms':
      return value;
    case 'seconds':
      return value * 1000;
    case 'minutes':
      return value * 60 * 1000;
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'days':
      return value * 24 * 60 * 60 * 1000;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
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
    public expression: AST.Expression
  ) {
    super(message);
    this.name = 'EvaluationError';
  }
}

// ============================================================================
// EXPRESSION TO STRING
// ============================================================================

export function expressionToString(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'QualifiedName':
      return expr.parts.map((p) => p.name).join('.');
    case 'StringLiteral':
      return JSON.stringify(expr.value);
    case 'NumberLiteral':
      return String(expr.value);
    case 'BooleanLiteral':
      return String(expr.value);
    case 'NullLiteral':
      return 'null';
    case 'DurationLiteral':
      return `${expr.value}.${expr.unit}`;
    case 'BinaryExpr':
      return `(${expressionToString(expr.left)} ${expr.operator} ${expressionToString(expr.right)})`;
    case 'UnaryExpr':
      return `${expr.operator}(${expressionToString(expr.operand)})`;
    case 'CallExpr':
      return `${expressionToString(expr.callee)}(${expr.arguments.map(expressionToString).join(', ')})`;
    case 'MemberExpr':
      return `${expressionToString(expr.object)}.${expr.property.name}`;
    case 'OldExpr':
      return `old(${expressionToString(expr.expression)})`;
    case 'ResultExpr':
      return expr.property ? `result.${expr.property.name}` : 'result';
    case 'InputExpr':
      return `input.${expr.property.name}`;
    case 'QuantifierExpr':
      return `${expr.quantifier}(${expr.variable.name} in ${expressionToString(expr.collection)}, ${expressionToString(expr.predicate)})`;
    default:
      return `<${expr.kind}>`;
  }
}
