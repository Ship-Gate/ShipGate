/**
 * AST to IR Compiler
 *
 * Compiles ISL parser AST expressions to normalized IR.
 */

import type * as AST from '@isl-lang/parser';
import type { IRExpr, IRSourceLoc, ComparisonOperator, ArithmeticOperator } from '../ir/types.js';
import { IR, resetNodeIdCounter } from '../ir/types.js';
import { normalizeIR } from '../ir/normalize.js';

// ============================================================================
// COMPILER CONTEXT
// ============================================================================

export interface CompilerContext {
  /** Known entity names in the domain */
  entities: Set<string>;
  /** Variables currently in scope */
  variables: Set<string>;
  /** Whether we're inside an old() expression */
  inOldExpr: boolean;
  /** Whether we're in a postcondition (can use result/old) */
  inPostcondition: boolean;
}

export function createContext(options: Partial<CompilerContext> = {}): CompilerContext {
  return {
    entities: options.entities ?? new Set(),
    variables: options.variables ?? new Set(),
    inOldExpr: options.inOldExpr ?? false,
    inPostcondition: options.inPostcondition ?? false,
  };
}

// ============================================================================
// MAIN COMPILER
// ============================================================================

/**
 * Compile an AST expression to normalized IR
 */
export function compileToIR(
  expr: AST.Expression,
  ctx: CompilerContext = createContext()
): IRExpr {
  // Reset node ID counter for deterministic output
  resetNodeIdCounter();

  const ir = compileExpr(expr, ctx);
  return normalizeIR(ir);
}

/**
 * Compile without normalization (for testing)
 */
export function compileToIRRaw(
  expr: AST.Expression,
  ctx: CompilerContext = createContext()
): IRExpr {
  resetNodeIdCounter();
  return compileExpr(expr, ctx);
}

// ============================================================================
// EXPRESSION COMPILATION
// ============================================================================

function compileExpr(expr: AST.Expression, ctx: CompilerContext): IRExpr {
  const loc = astToIRLoc(expr.location);

  switch (expr.kind) {
    case 'Identifier':
      return compileIdentifier(expr, ctx, loc);

    case 'QualifiedName':
      return compileQualifiedName(expr, ctx, loc);

    case 'StringLiteral':
      return IR.string(expr.value, loc);

    case 'NumberLiteral':
      return IR.number(expr.value, loc);

    case 'BooleanLiteral':
      return IR.bool(expr.value, loc);

    case 'NullLiteral':
      return IR.null(loc);

    case 'DurationLiteral':
      return IR.number(durationToMs(expr), loc);

    case 'RegexLiteral':
      return IR.regex(expr.pattern, expr.flags, loc);

    case 'BinaryExpr':
      return compileBinaryExpr(expr, ctx, loc);

    case 'UnaryExpr':
      return compileUnaryExpr(expr, ctx, loc);

    case 'CallExpr':
      return compileCallExpr(expr, ctx, loc);

    case 'MemberExpr':
      return compileMemberExpr(expr, ctx, loc);

    case 'IndexExpr':
      return IR.index(
        compileExpr(expr.object, ctx),
        compileExpr(expr.index, ctx),
        loc
      );

    case 'QuantifierExpr':
      return compileQuantifierExpr(expr, ctx, loc);

    case 'ConditionalExpr':
      return IR.conditional(
        compileExpr(expr.condition, ctx),
        compileExpr(expr.thenBranch, ctx),
        compileExpr(expr.elseBranch, ctx),
        loc
      );

    case 'OldExpr':
      return compileOldExpr(expr, ctx, loc);

    case 'ResultExpr':
      return IR.result(expr.property?.name, loc);

    case 'InputExpr':
      return IR.input(expr.property.name, loc);

    case 'LambdaExpr':
      // Lambdas become special IR for higher-order operations
      // For now, compile the body with variables in scope
      const newCtx = {
        ...ctx,
        variables: new Set([...ctx.variables, ...expr.params.map((p) => p.name)]),
      };
      return compileExpr(expr.body, newCtx);

    case 'ListExpr':
      return IR.list(expr.elements.map((e) => compileExpr(e, ctx)), loc);

    case 'MapExpr':
      return IR.map(
        expr.entries.map((e) => ({
          key: getMapKey(e.key, ctx),
          value: compileExpr(e.value, ctx),
        })),
        loc
      );

    default:
      throw new CompilerError(
        `Unsupported expression kind: ${(expr as AST.ASTNode).kind}`,
        expr
      );
  }
}

// ============================================================================
// IDENTIFIER COMPILATION
// ============================================================================

function compileIdentifier(
  expr: AST.Identifier,
  ctx: CompilerContext,
  loc: IRSourceLoc | undefined
): IRExpr {
  const name = expr.name;

  // Check for special built-in identifiers
  if (name === 'true') return IR.bool(true, loc);
  if (name === 'false') return IR.bool(false, loc);
  if (name === 'null') return IR.null(loc);

  // Check if it's a known entity
  if (ctx.entities.has(name)) {
    // Return as variable - entity methods will be handled at call site
    return IR.variable(name, loc);
  }

  return IR.variable(name, loc);
}

function compileQualifiedName(
  expr: AST.QualifiedName,
  ctx: CompilerContext,
  loc: IRSourceLoc | undefined
): IRExpr {
  // Build property chain
  const parts = expr.parts;
  if (parts.length === 0) {
    throw new CompilerError('Empty qualified name', expr);
  }

  let result: IRExpr = compileIdentifier(parts[0]!, ctx, loc);

  for (let i = 1; i < parts.length; i++) {
    result = IR.prop(result, parts[i]!.name, loc);
  }

  return result;
}

// ============================================================================
// BINARY EXPRESSION COMPILATION
// ============================================================================

function compileBinaryExpr(
  expr: AST.BinaryExpr,
  ctx: CompilerContext,
  loc: IRSourceLoc | undefined
): IRExpr {
  const left = compileExpr(expr.left, ctx);
  const right = compileExpr(expr.right, ctx);

  switch (expr.operator) {
    // Existence patterns (x == null, x != null)
    case '==':
      if (isNullLiteral(right)) {
        return IR.exists(left, false, loc); // x == null means NOT exists
      }
      if (isNullLiteral(left)) {
        return IR.exists(right, false, loc);
      }
      return IR.eq(left, right, false, loc);

    case '!=':
      if (isNullLiteral(right)) {
        return IR.exists(left, true, loc); // x != null means exists
      }
      if (isNullLiteral(left)) {
        return IR.exists(right, true, loc);
      }
      return IR.eq(left, right, true, loc);

    // Comparisons
    case '<':
    case '<=':
    case '>':
    case '>=':
      return IR.compare(expr.operator as ComparisonOperator, left, right, loc);

    // Boolean operators
    case 'and':
      return IR.and(flattenAnd(left, right), loc);

    case 'or':
      return IR.or(flattenOr(left, right), loc);

    case 'implies':
      return IR.implies(left, right, loc);

    case 'iff':
      // a iff b = (a && b) || (!a && !b)
      return IR.or([
        IR.and([left, right]),
        IR.and([IR.not(left), IR.not(right)]),
      ], loc);

    // Set membership
    case 'in':
      if (right.kind === 'LiteralList') {
        return IR.inSet(left, [...right.elements], false, loc);
      }
      // For non-list right sides, use array includes
      return IR.arrayIncludes(right, left, loc);

    // Arithmetic
    case '+':
    case '-':
    case '*':
    case '/':
    case '%':
      return IR.arithmetic(expr.operator as ArithmeticOperator, left, right, loc);

    default:
      throw new CompilerError(`Unknown binary operator: ${expr.operator}`, expr);
  }
}

function flattenAnd(left: IRExpr, right: IRExpr): IRExpr[] {
  const result: IRExpr[] = [];

  if (left.kind === 'LogicalAnd') {
    result.push(...left.operands);
  } else {
    result.push(left);
  }

  if (right.kind === 'LogicalAnd') {
    result.push(...right.operands);
  } else {
    result.push(right);
  }

  return result;
}

function flattenOr(left: IRExpr, right: IRExpr): IRExpr[] {
  const result: IRExpr[] = [];

  if (left.kind === 'LogicalOr') {
    result.push(...left.operands);
  } else {
    result.push(left);
  }

  if (right.kind === 'LogicalOr') {
    result.push(...right.operands);
  } else {
    result.push(right);
  }

  return result;
}

// ============================================================================
// UNARY EXPRESSION COMPILATION
// ============================================================================

function compileUnaryExpr(
  expr: AST.UnaryExpr,
  ctx: CompilerContext,
  loc: IRSourceLoc | undefined
): IRExpr {
  const operand = compileExpr(expr.operand, ctx);

  switch (expr.operator) {
    case 'not':
      // Handle "not in" pattern
      if (operand.kind === 'InSet') {
        return { ...operand, negated: !operand.negated };
      }
      if (operand.kind === 'ArrayIncludes') {
        return IR.not(operand, loc);
      }
      return IR.not(operand, loc);

    case '-':
      if (operand.kind === 'LiteralNumber') {
        return IR.number(-operand.value, loc);
      }
      return IR.arithmetic('-', IR.number(0), operand, loc);

    default:
      throw new CompilerError(`Unknown unary operator: ${expr.operator}`, expr);
  }
}

// ============================================================================
// CALL EXPRESSION COMPILATION
// ============================================================================

function compileCallExpr(
  expr: AST.CallExpr,
  ctx: CompilerContext,
  loc: IRSourceLoc | undefined
): IRExpr {
  const callee = expr.callee;
  const args = expr.arguments.map((a) => compileExpr(a, ctx));

  // Handle member call expressions (e.g., User.exists(...), str.includes(...))
  if (callee.kind === 'MemberExpr') {
    const method = callee.property.name;

    // Check for entity method calls
    if (callee.object.kind === 'Identifier' && ctx.entities.has(callee.object.name)) {
      return compileEntityMethodCall(callee.object.name, method, args, loc);
    }

    // Compile the object
    const obj = compileExpr(callee.object, ctx);

    // String methods
    switch (method) {
      case 'includes':
      case 'contains':
        return IR.strIncludes(obj, args[0]!, loc);
      case 'startsWith':
        return IR.strStartsWith(obj, args[0]!, loc);
      case 'endsWith':
        return IR.strEndsWith(obj, args[0]!, loc);
      case 'matches':
      case 'match':
        return IR.strMatches(obj, args[0]!, loc);
      case 'length':
        // length() as method call
        return IR.strLen(obj, loc);
    }

    // Array methods
    switch (method) {
      case 'includes':
        return IR.arrayIncludes(obj, args[0]!, loc);
      case 'every':
        if (args[0]) {
          // Extract variable and predicate from lambda IR
          return IR.arrayEvery(obj, '_item', args[0], loc);
        }
        break;
      case 'some':
        if (args[0]) {
          return IR.arraySome(obj, '_item', args[0], loc);
        }
        break;
      case 'filter':
        if (args[0]) {
          return IR.arrayFilter(obj, '_item', args[0], loc);
        }
        break;
      case 'map':
        if (args[0]) {
          return IR.arrayMap(obj, '_item', args[0], loc);
        }
        break;
    }

    // Default: generic function call
    return IR.call(`${serializeForCall(obj)}.${method}`, args, loc);
  }

  // Direct function calls
  if (callee.kind === 'Identifier') {
    const name = callee.name;

    // Built-in functions
    switch (name) {
      case 'between':
        if (args.length === 3) {
          return IR.between(args[0]!, args[1]!, args[2]!, true, loc);
        }
        break;
      case 'length':
        if (args.length === 1) {
          return IR.strLen(args[0]!, loc);
        }
        break;
      case 'count':
        if (args.length === 1) {
          return IR.arrayLen(args[0]!, loc);
        }
        break;
    }

    return IR.call(name, args, loc);
  }

  // Lambda calls or other
  const compiledCallee = compileExpr(callee, ctx);
  return IR.call(serializeForCall(compiledCallee), args, loc);
}

function compileEntityMethodCall(
  entityName: string,
  method: string,
  args: IRExpr[],
  loc: IRSourceLoc | undefined
): IRExpr {
  switch (method) {
    case 'exists':
      return IR.entityExists(entityName, args[0], loc);
    case 'lookup':
      return IR.entityLookup(entityName, args[0]!, loc);
    case 'count':
      return IR.entityCount(entityName, args[0], loc);
    case 'getAll':
    case 'all':
      return IR.call(`${entityName}.getAll`, [], loc);
    default:
      return IR.call(`${entityName}.${method}`, args, loc);
  }
}

// ============================================================================
// MEMBER EXPRESSION COMPILATION
// ============================================================================

function compileMemberExpr(
  expr: AST.MemberExpr,
  ctx: CompilerContext,
  loc: IRSourceLoc | undefined
): IRExpr {
  const property = expr.property.name;

  // Handle special properties
  if (property === 'length') {
    const obj = compileExpr(expr.object, ctx);
    // Could be string or array length - return generic length
    // The evaluator will handle both
    return IR.prop(obj, 'length', loc);
  }

  if (property === 'is_valid') {
    const obj = compileExpr(expr.object, ctx);
    // is_valid typically means non-empty for strings
    return IR.compare('>', IR.strLen(obj, loc), IR.number(0), loc);
  }

  // Standard property access
  const obj = compileExpr(expr.object, ctx);
  return IR.prop(obj, property, loc);
}

// ============================================================================
// QUANTIFIER COMPILATION
// ============================================================================

function compileQuantifierExpr(
  expr: AST.QuantifierExpr,
  ctx: CompilerContext,
  loc: IRSourceLoc | undefined
): IRExpr {
  const collection = compileExpr(expr.collection, ctx);
  const variable = expr.variable.name;

  // Add variable to scope for predicate compilation
  const newCtx = {
    ...ctx,
    variables: new Set([...ctx.variables, variable]),
  };
  const predicate = compileExpr(expr.predicate, newCtx);

  switch (expr.quantifier) {
    case 'all':
      return IR.quantAll(collection, variable, predicate, loc);
    case 'any':
      return IR.quantAny(collection, variable, predicate, loc);
    case 'none':
      return IR.quantNone(collection, variable, predicate, loc);
    case 'count':
      return IR.quantCount(collection, variable, predicate, loc);
    case 'sum':
      // Sum can be represented as count with value extraction
      return IR.call('sum', [collection, IR.variable(variable), predicate], loc);
    case 'filter':
      return IR.arrayFilter(collection, variable, predicate, loc);
    default:
      throw new CompilerError(`Unknown quantifier: ${expr.quantifier}`, expr);
  }
}

// ============================================================================
// OLD EXPRESSION COMPILATION
// ============================================================================

function compileOldExpr(
  expr: AST.OldExpr,
  ctx: CompilerContext,
  loc: IRSourceLoc | undefined
): IRExpr {
  // Mark that we're inside old()
  const newCtx = { ...ctx, inOldExpr: true };
  const inner = compileExpr(expr.expression, newCtx);

  return IR.old(inner, loc);
}

// ============================================================================
// UTILITIES
// ============================================================================

function astToIRLoc(loc: AST.SourceLocation): IRSourceLoc | undefined {
  if (!loc) return undefined;
  return {
    file: loc.file,
    line: loc.line,
    column: loc.column,
  };
}

function durationToMs(expr: AST.DurationLiteral): number {
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
    default:
      return value;
  }
}

function isNullLiteral(expr: IRExpr): boolean {
  return expr.kind === 'LiteralNull';
}

function getMapKey(key: AST.Expression, ctx: CompilerContext): string {
  if (key.kind === 'StringLiteral') {
    return key.value;
  }
  if (key.kind === 'Identifier') {
    return key.name;
  }
  // For other expressions, serialize
  const ir = compileExpr(key, ctx);
  return serializeForCall(ir);
}

function serializeForCall(expr: IRExpr): string {
  switch (expr.kind) {
    case 'Variable':
      return expr.name;
    case 'PropertyAccess':
      return `${serializeForCall(expr.object)}.${expr.property}`;
    case 'InputValue':
      return `input.${expr.property}`;
    case 'ResultValue':
      return expr.property ? `result.${expr.property}` : 'result';
    default:
      return `<${expr.kind}>`;
  }
}

// ============================================================================
// ERROR CLASS
// ============================================================================

export class CompilerError extends Error {
  constructor(
    message: string,
    public readonly expression: AST.Expression
  ) {
    super(message);
    this.name = 'CompilerError';
  }
}
