/**
 * ISL Expression Encoder
 * 
 * Encodes ISL AST expressions to SMT expressions.
 * Supports a subset of expressions suitable for SMT solving:
 * - Boolean logic (and, or, not, implies)
 * - Arithmetic (comparisons, +, -, *, /)
 * - Quantifiers (all, some, none)
 * - Member access (limited)
 */

import type {
  Expression,
  Identifier,
  BooleanLiteral,
  NumberLiteral,
  StringLiteral,
  NullLiteral,
  BinaryExpression,
  UnaryExpression,
  ComparisonExpression,
  LogicalExpression,
  QuantifiedExpression,
  MemberExpression,
  CallExpression,
  OldExpression,
  ConditionStatement,
  TypeConstraint,
} from '@isl-lang/isl-core/ast';
import { Expr, Sort, type SMTExpr, type SMTSort } from '@isl-lang/prover';

/**
 * Encoding context - tracks variable types and scope
 */
export interface EncodingContext {
  /** Variable name -> sort mapping */
  variables: Map<string, SMTSort>;
  /** Entity field types (entity.field -> sort) */
  fieldTypes: Map<string, SMTSort>;
  /** Whether we're inside an old() expression */
  inOldContext: boolean;
  /** Bound quantifier variables */
  boundVars: Set<string>;
}

/**
 * Create empty encoding context
 */
export function createContext(): EncodingContext {
  return {
    variables: new Map(),
    fieldTypes: new Map(),
    inOldContext: false,
    boundVars: new Set(),
  };
}

/**
 * Expression encoding result
 */
export type EncodeResult = {
  success: true;
  expr: SMTExpr;
} | {
  success: false;
  error: string;
  unsupportedFeature?: string;
};

/**
 * ISL type name to SMT sort mapping
 */
export function islTypeToSort(typeName: string): SMTSort {
  const normalized = typeName.toLowerCase().trim();
  
  switch (normalized) {
    case 'int':
    case 'integer':
    case 'i32':
    case 'i64':
      return Sort.Int();
      
    case 'decimal':
    case 'float':
    case 'real':
    case 'f32':
    case 'f64':
    case 'money':
    case 'currency':
      return Sort.Real();
      
    case 'bool':
    case 'boolean':
      return Sort.Bool();
      
    case 'string':
    case 'text':
    case 'email':
    case 'url':
    case 'uuid':
      return Sort.String();
      
    default:
      // For complex types, use uninterpreted sort
      return Sort.Uninterpreted(typeName);
  }
}

/**
 * Encode an ISL expression to SMT
 */
export function encodeExpression(
  expr: Expression,
  ctx: EncodingContext
): EncodeResult {
  try {
    const result = encode(expr, ctx);
    return { success: true, expr: result };
  } catch (error) {
    if (error instanceof UnsupportedFeatureError) {
      return { 
        success: false, 
        error: error.message,
        unsupportedFeature: error.feature,
      };
    }
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Error for unsupported features
 */
class UnsupportedFeatureError extends Error {
  constructor(public feature: string, message: string) {
    super(message);
    this.name = 'UnsupportedFeatureError';
  }
}

/**
 * Internal encode function
 */
function encode(expr: Expression, ctx: EncodingContext): SMTExpr {
  switch (expr.kind) {
    case 'BooleanLiteral':
      return Expr.bool(expr.value);
      
    case 'NumberLiteral':
      // Check if it's a real number
      if (Number.isInteger(expr.value)) {
        return Expr.int(expr.value);
      }
      return Expr.real(expr.value);
      
    case 'StringLiteral':
      return Expr.string(expr.value);
      
    case 'NullLiteral':
      // Represent null as a special constant
      throw new UnsupportedFeatureError('null', 'Null values not supported in SMT encoding');
      
    case 'DurationLiteral':
      // Convert duration to milliseconds as integer
      const ms = durationToMs(expr.value, expr.unit);
      return Expr.int(ms);
      
    case 'Identifier':
      return encodeIdentifier(expr, ctx);
      
    case 'BinaryExpression':
      return encodeBinaryExpression(expr, ctx);
      
    case 'UnaryExpression':
      return encodeUnaryExpression(expr, ctx);
      
    case 'ComparisonExpression':
      return encodeComparisonExpression(expr, ctx);
      
    case 'LogicalExpression':
      return encodeLogicalExpression(expr, ctx);
      
    case 'QuantifiedExpression':
      return encodeQuantifiedExpression(expr, ctx);
      
    case 'MemberExpression':
      return encodeMemberExpression(expr, ctx);
      
    case 'CallExpression':
      return encodeCallExpression(expr, ctx);
      
    case 'OldExpression':
      return encodeOldExpression(expr, ctx);
      
    default: {
      // Cast to any for exhaustiveness checking - TypeScript thinks this is unreachable
      const unknownExpr = expr as { kind: string };
      throw new UnsupportedFeatureError(
        unknownExpr.kind,
        `Expression kind '${unknownExpr.kind}' not supported in SMT encoding`
      );
    }
  }
}

/**
 * Encode identifier
 */
function encodeIdentifier(expr: Identifier, ctx: EncodingContext): SMTExpr {
  const name = expr.name;
  
  // Check if it's a known variable
  const sort = ctx.variables.get(name);
  if (sort) {
    // Add prefix for old context
    const varName = ctx.inOldContext ? `old_${name}` : name;
    return Expr.var(varName, sort);
  }
  
  // Check for special keywords
  if (name === 'result') {
    const resultSort = ctx.variables.get('__result__') ?? Sort.Bool();
    return Expr.var('result', resultSort);
  }
  
  if (name === 'true') return Expr.bool(true);
  if (name === 'false') return Expr.bool(false);
  
  // Default: treat as boolean variable
  return Expr.var(name, Sort.Bool());
}

/**
 * Encode binary expression (+, -, *, /, %)
 */
function encodeBinaryExpression(expr: BinaryExpression, ctx: EncodingContext): SMTExpr {
  const left = encode(expr.left, ctx);
  const right = encode(expr.right, ctx);
  
  switch (expr.operator) {
    case '+':
      return Expr.add(left, right);
    case '-':
      return Expr.sub(left, right);
    case '*':
      return Expr.mul(left, right);
    case '/':
      return Expr.div(left, right);
    case '%':
      return Expr.mod(left, right);
    case 'and':
      return Expr.and(left, right);
    case 'or':
      return Expr.or(left, right);
    case 'implies':
      return Expr.implies(left, right);
    case '==':
      return Expr.eq(left, right);
    case '!=':
      return Expr.neq(left, right);
    case '<':
      return Expr.lt(left, right);
    case '<=':
      return Expr.le(left, right);
    case '>':
      return Expr.gt(left, right);
    case '>=':
      return Expr.ge(left, right);
    default:
      throw new UnsupportedFeatureError(
        `operator:${expr.operator}`,
        `Binary operator '${expr.operator}' not supported in SMT encoding`
      );
  }
}

/**
 * Encode unary expression (not, -)
 */
function encodeUnaryExpression(expr: UnaryExpression, ctx: EncodingContext): SMTExpr {
  const operand = encode(expr.operand, ctx);
  
  switch (expr.operator) {
    case 'not':
      return Expr.not(operand);
    case '-':
      return Expr.neg(operand);
    default:
      throw new UnsupportedFeatureError(
        `operator:${expr.operator}`,
        `Unary operator '${expr.operator}' not supported in SMT encoding`
      );
  }
}

/**
 * Encode comparison expression
 */
function encodeComparisonExpression(expr: ComparisonExpression, ctx: EncodingContext): SMTExpr {
  const left = encode(expr.left, ctx);
  const right = encode(expr.right, ctx);
  
  switch (expr.operator) {
    case '==':
      return Expr.eq(left, right);
    case '!=':
      return Expr.neq(left, right);
    case '<':
      return Expr.lt(left, right);
    case '<=':
      return Expr.le(left, right);
    case '>':
      return Expr.gt(left, right);
    case '>=':
      return Expr.ge(left, right);
    default:
      throw new UnsupportedFeatureError(
        `operator:${expr.operator}`,
        `Comparison operator '${expr.operator}' not supported in SMT encoding`
      );
  }
}

/**
 * Encode logical expression (and, or)
 */
function encodeLogicalExpression(expr: LogicalExpression, ctx: EncodingContext): SMTExpr {
  const left = encode(expr.left, ctx);
  const right = encode(expr.right, ctx);
  
  switch (expr.operator) {
    case 'and':
      return Expr.and(left, right);
    case 'or':
      return Expr.or(left, right);
    default:
      throw new UnsupportedFeatureError(
        `operator:${expr.operator}`,
        `Logical operator '${expr.operator}' not supported in SMT encoding`
      );
  }
}

/**
 * Encode quantified expression (all, some, none)
 */
function encodeQuantifiedExpression(expr: QuantifiedExpression, ctx: EncodingContext): SMTExpr {
  const varName = expr.variable.name;
  
  // Create new context with bound variable
  const newCtx: EncodingContext = {
    ...ctx,
    variables: new Map(ctx.variables),
    boundVars: new Set(ctx.boundVars),
  };
  
  // Infer sort from collection or default to Int
  const varSort = inferQuantifierSort(expr.collection, ctx);
  newCtx.variables.set(varName, varSort);
  newCtx.boundVars.add(varName);
  
  // Encode predicate
  const predicate = encode(expr.predicate, newCtx);
  
  // Encode collection constraint (if it's a range or array)
  const collectionConstraint = encodeCollectionConstraint(expr.collection, varName, varSort, ctx);
  
  // Combine with quantifier
  const boundVars = [{ name: varName, sort: varSort }];
  
  switch (expr.quantifier) {
    case 'all':
      // forall x in C. P(x)  =>  forall x. (x in C) => P(x)
      if (collectionConstraint) {
        return Expr.forall(boundVars, Expr.implies(collectionConstraint, predicate));
      }
      return Expr.forall(boundVars, predicate);
      
    case 'some':
      // exists x in C. P(x)  =>  exists x. (x in C) and P(x)
      if (collectionConstraint) {
        return Expr.exists(boundVars, Expr.and(collectionConstraint, predicate));
      }
      return Expr.exists(boundVars, predicate);
      
    case 'none':
      // none x in C. P(x)  =>  not exists x in C. P(x)  =>  forall x. (x in C) => not P(x)
      if (collectionConstraint) {
        return Expr.forall(boundVars, Expr.implies(collectionConstraint, Expr.not(predicate)));
      }
      return Expr.forall(boundVars, Expr.not(predicate));
      
    default:
      throw new UnsupportedFeatureError(
        `quantifier:${expr.quantifier}`,
        `Quantifier '${expr.quantifier}' not supported in SMT encoding`
      );
  }
}

/**
 * Infer sort for quantifier variable from collection
 */
function inferQuantifierSort(collection: Expression, ctx: EncodingContext): SMTSort {
  // For now, default to Int for numeric ranges, otherwise Bool
  // In a more complete implementation, we'd infer from the collection type
  return Sort.Int();
}

/**
 * Encode collection constraint for quantifier
 */
function encodeCollectionConstraint(
  collection: Expression,
  varName: string,
  varSort: SMTSort,
  ctx: EncodingContext
): SMTExpr | null {
  // Handle range expressions like 1..10
  if (collection.kind === 'BinaryExpression' && collection.operator === '..') {
    const lower = encode(collection.left, ctx);
    const upper = encode(collection.right, ctx);
    const v = Expr.var(varName, varSort);
    
    return Expr.and(
      Expr.ge(v, lower),
      Expr.le(v, upper)
    );
  }
  
  // For other collections, return null (no constraint)
  return null;
}

/**
 * Encode member expression (object.property)
 */
function encodeMemberExpression(expr: MemberExpression, ctx: EncodingContext): SMTExpr {
  const propName = expr.property.name;
  
  // Handle result.field
  if (expr.object.kind === 'Identifier' && expr.object.name === 'result') {
    const fieldKey = `result.${propName}`;
    const sort = ctx.fieldTypes.get(fieldKey) ?? Sort.Bool();
    return Expr.var(`result_${propName}`, sort);
  }
  
  // Handle input.field or entity.field
  if (expr.object.kind === 'Identifier') {
    const objName = expr.object.name;
    const fieldKey = `${objName}.${propName}`;
    const sort = ctx.fieldTypes.get(fieldKey) ?? ctx.variables.get(objName) ?? Sort.Bool();
    
    // Create function application for field access
    const prefix = ctx.inOldContext ? 'old_' : '';
    return Expr.var(`${prefix}${objName}_${propName}`, sort);
  }
  
  throw new UnsupportedFeatureError(
    'complex_member_access',
    `Complex member access not supported in SMT encoding`
  );
}

/**
 * Encode call expression
 */
function encodeCallExpression(expr: CallExpression, ctx: EncodingContext): SMTExpr {
  // Handle special built-in functions
  if (expr.callee.kind === 'Identifier') {
    const funcName = expr.callee.name;
    
    switch (funcName) {
      case 'abs':
        if (expr.arguments.length === 1) {
          return Expr.abs(encode(expr.arguments[0]!, ctx));
        }
        break;
        
      case 'len':
      case 'length':
        // Length is modeled as uninterpreted function
        if (expr.arguments.length === 1) {
          const arg = encode(expr.arguments[0]!, ctx);
          return Expr.apply('len', arg);
        }
        break;
        
      case 'min':
        if (expr.arguments.length === 2) {
          const a = encode(expr.arguments[0]!, ctx);
          const b = encode(expr.arguments[1]!, ctx);
          return Expr.ite(Expr.le(a, b), a, b);
        }
        break;
        
      case 'max':
        if (expr.arguments.length === 2) {
          const a = encode(expr.arguments[0]!, ctx);
          const b = encode(expr.arguments[1]!, ctx);
          return Expr.ite(Expr.ge(a, b), a, b);
        }
        break;
    }
  }
  
  // Handle method calls like Entity.exists()
  if (expr.callee.kind === 'MemberExpression') {
    const member = expr.callee;
    if (member.object.kind === 'Identifier') {
      const objName = member.object.name;
      const methodName = member.property.name;
      
      // Encode as uninterpreted function
      const args = expr.arguments.map(a => encode(a, ctx));
      return Expr.apply(`${objName}_${methodName}`, ...args);
    }
  }
  
  throw new UnsupportedFeatureError(
    'call_expression',
    `Call expression not fully supported in SMT encoding`
  );
}

/**
 * Encode old() expression (pre-state reference)
 */
function encodeOldExpression(expr: OldExpression, ctx: EncodingContext): SMTExpr {
  const newCtx: EncodingContext = {
    ...ctx,
    inOldContext: true,
  };
  
  return encode(expr.expression, newCtx);
}

/**
 * Convert duration to milliseconds
 */
function durationToMs(value: number, unit: 'ms' | 's' | 'm' | 'h' | 'd'): number {
  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
  }
}

/**
 * Encode a condition statement
 */
export function encodeCondition(
  condition: ConditionStatement,
  ctx: EncodingContext
): EncodeResult {
  return encodeExpression(condition.expression, ctx);
}

/**
 * Encode a type constraint (for refinement types)
 */
export function encodeTypeConstraint(
  constraint: TypeConstraint,
  variableName: string,
  ctx: EncodingContext
): EncodeResult {
  const constraintName = constraint.name.name;
  const varSort = ctx.variables.get(variableName) ?? Sort.Int();
  const v = Expr.var(variableName, varSort);
  
  // Handle common constraint types
  switch (constraintName) {
    case 'min':
      if (constraint.value) {
        const minVal = encodeExpression(constraint.value, ctx);
        if (!minVal.success) return minVal;
        return { success: true, expr: Expr.ge(v, minVal.expr) };
      }
      break;
      
    case 'max':
      if (constraint.value) {
        const maxVal = encodeExpression(constraint.value, ctx);
        if (!maxVal.success) return maxVal;
        return { success: true, expr: Expr.le(v, maxVal.expr) };
      }
      break;
      
    case 'positive':
      return { success: true, expr: Expr.gt(v, Expr.int(0)) };
      
    case 'non_negative':
      return { success: true, expr: Expr.ge(v, Expr.int(0)) };
      
    case 'negative':
      return { success: true, expr: Expr.lt(v, Expr.int(0)) };
      
    case 'min_length':
      if (constraint.value) {
        const minLen = encodeExpression(constraint.value, ctx);
        if (!minLen.success) return minLen;
        return { success: true, expr: Expr.ge(Expr.apply('len', v), minLen.expr) };
      }
      break;
      
    case 'max_length':
      if (constraint.value) {
        const maxLen = encodeExpression(constraint.value, ctx);
        if (!maxLen.success) return maxLen;
        return { success: true, expr: Expr.le(Expr.apply('len', v), maxLen.expr) };
      }
      break;
      
    case 'not_empty':
      return { success: true, expr: Expr.gt(Expr.apply('len', v), Expr.int(0)) };
  }
  
  // For unknown constraints, encode the value expression if present
  if (constraint.value) {
    return encodeExpression(constraint.value, ctx);
  }
  
  return { 
    success: false, 
    error: `Cannot encode constraint '${constraintName}'`,
    unsupportedFeature: `constraint:${constraintName}`,
  };
}
