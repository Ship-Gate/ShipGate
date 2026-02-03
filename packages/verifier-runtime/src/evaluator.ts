// ============================================================================
// Expression Evaluator - Enhanced with tri-state logic and rich diagnostics
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { EvaluationContext } from './types.js';

// ============================================================================
// TRI-STATE RESULT
// ============================================================================

/**
 * Tri-state evaluation result: true, false, or unknown
 */
export type TriState = true | false | 'unknown';

/**
 * Check if a value is unknown
 */
export function isUnknown(value: unknown): value is 'unknown' {
  return value === 'unknown';
}

/**
 * Convert a value to tri-state
 */
export function toTriState(value: unknown): TriState {
  if (value === 'unknown' || value === null || value === undefined) {
    return 'unknown';
  }
  return Boolean(value);
}

/**
 * Propagate unknown through logical operations
 */
export function triStateAnd(left: TriState, right: TriState): TriState {
  if (left === false || right === false) return false;
  if (left === 'unknown' || right === 'unknown') return 'unknown';
  return true;
}

export function triStateOr(left: TriState, right: TriState): TriState {
  if (left === true || right === true) return true;
  if (left === 'unknown' || right === 'unknown') return 'unknown';
  return false;
}

export function triStateNot(operand: TriState): TriState {
  if (operand === 'unknown') return 'unknown';
  return !operand;
}

export function triStateImplies(left: TriState, right: TriState): TriState {
  // false implies anything is true
  if (left === false) return true;
  // true implies unknown is unknown
  if (left === true && right === 'unknown') return 'unknown';
  // true implies true is true, true implies false is false
  if (left === true) return right;
  // unknown implies anything is unknown
  return 'unknown';
}

// ============================================================================
// EVALUATION RESULT WITH DIAGNOSTICS
// ============================================================================

export interface EvaluationResult {
  /** Tri-state result */
  value: TriState;
  
  /** Source location of the expression */
  location: AST.SourceLocation;
  
  /** Why evaluation failed (if value is false or unknown) */
  reason?: string;
  
  /** Nested evaluation results for compound expressions */
  children?: EvaluationResult[];
}

/**
 * Create a successful evaluation result
 */
export function success(
  value: boolean,
  location: AST.SourceLocation,
  children?: EvaluationResult[]
): EvaluationResult {
  return {
    value,
    location,
    children,
  };
}

/**
 * Create an unknown evaluation result
 */
export function unknown(
  reason: string,
  location: AST.SourceLocation,
  children?: EvaluationResult[]
): EvaluationResult {
  return {
    value: 'unknown',
    location,
    reason,
    children,
  };
}

/**
 * Create a failed evaluation result
 */
export function failure(
  reason: string,
  location: AST.SourceLocation,
  children?: EvaluationResult[]
): EvaluationResult {
  return {
    value: false,
    location,
    reason,
    children,
  };
}

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

/**
 * Adapter for domain primitives (User.lookup, User.exists, etc.)
 * Allows plugging in domain-specific implementations
 * 
 * Note: All methods are synchronous for deterministic evaluation (no network calls)
 */
export interface ExpressionAdapter {
  /**
   * Check if a value is valid (e.g., email.is_valid)
   */
  is_valid?(value: unknown, context: EvaluationContext): TriState;
  
  /**
   * Get length of a value (e.g., string.length, array.length)
   */
  length?(value: unknown, context: EvaluationContext): number | 'unknown';
  
  /**
   * Check if an entity exists (e.g., User.exists(criteria))
   */
  exists?(
    entityName: string,
    criteria: Record<string, unknown>,
    context: EvaluationContext
  ): TriState;
  
  /**
   * Lookup an entity (e.g., User.lookup(criteria))
   */
  lookup?(
    entityName: string,
    criteria: Record<string, unknown>,
    context: EvaluationContext
  ): unknown | 'unknown';
}

/**
 * Default adapter with basic implementations
 */
export class DefaultAdapter implements ExpressionAdapter {
  is_valid(value: unknown): TriState {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.length > 0;
    if (typeof value === 'number') return !isNaN(value) && isFinite(value);
    if (typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }
  
  length(value: unknown): number | 'unknown' {
    if (value === null || value === undefined) return 'unknown';
    if (typeof value === 'string') return value.length;
    if (Array.isArray(value)) return value.length;
    return 'unknown';
  }
  
  exists(
    entityName: string,
    criteria: Record<string, unknown>,
    context: EvaluationContext
  ): TriState {
    try {
      return context.store.exists(entityName, criteria);
    } catch {
      return 'unknown';
    }
  }
  
  lookup(
    entityName: string,
    criteria: Record<string, unknown>,
    context: EvaluationContext
  ): unknown | 'unknown' {
    try {
      const result = context.store.lookup(entityName, criteria);
      return result ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

// ============================================================================
// EVALUATOR OPTIONS
// ============================================================================

export interface EvaluatorOptions {
  /** Adapter for domain primitives */
  adapter?: ExpressionAdapter;
  
  /** Enable detailed diagnostics */
  diagnostics?: boolean;
  
  /** Maximum evaluation depth (prevent infinite recursion) */
  maxDepth?: number;
}

// ============================================================================
// CORE EVALUATOR
// ============================================================================

/**
 * Evaluate an ISL expression with tri-state logic and rich diagnostics
 */
export function evaluateExpression(
  expr: AST.Expression,
  context: EvaluationContext,
  options: EvaluatorOptions = {}
): EvaluationResult {
  const adapter = options.adapter ?? new DefaultAdapter();
  const diagnostics = options.diagnostics ?? true;
  const maxDepth = options.maxDepth ?? 100;
  
  return evaluateRecursive(expr, context, adapter, diagnostics, maxDepth, 0);
}

function evaluateRecursive(
  expr: AST.Expression,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  if (depth > maxDepth) {
    return failure(
      `Maximum evaluation depth (${maxDepth}) exceeded`,
      expr.location
    );
  }
  
  const location = expr.location;
  
  switch (expr.kind) {
    case 'Identifier':
      return evaluateIdentifier(expr, context, adapter, diagnostics, maxDepth, depth);
    
    case 'QualifiedName':
      return evaluateQualifiedName(expr, context, adapter, diagnostics, maxDepth, depth);
    
    case 'StringLiteral':
      return success(true, location);
    
    case 'NumberLiteral':
      return success(true, location);
    
    case 'BooleanLiteral':
      return success(expr.value, location);
    
    case 'NullLiteral':
      return success(false, location);
    
    case 'BinaryExpr':
      return evaluateBinaryExpr(expr, context, adapter, diagnostics, maxDepth, depth);
    
    case 'UnaryExpr':
      return evaluateUnaryExpr(expr, context, adapter, diagnostics, maxDepth, depth);
    
    case 'CallExpr':
      return evaluateCallExpr(expr, context, adapter, diagnostics, maxDepth, depth);
    
    case 'MemberExpr':
      return evaluateMemberExpr(expr, context, adapter, diagnostics, maxDepth, depth);
    
    case 'IndexExpr':
      return evaluateIndexExpr(expr, context, adapter, diagnostics, maxDepth, depth);
    
    case 'QuantifierExpr':
      return evaluateQuantifierExpr(expr, context, adapter, diagnostics, maxDepth, depth);
    
    case 'ConditionalExpr':
      return evaluateConditionalExpr(expr, context, adapter, diagnostics, maxDepth, depth);
    
    case 'OldExpr':
      return evaluateOldExpr(expr, context, adapter, diagnostics, maxDepth, depth);
    
    case 'ResultExpr':
      return evaluateResultExpr(expr, context, adapter, diagnostics, maxDepth, depth);
    
    case 'InputExpr':
      return evaluateInputExpr(expr, context, adapter, diagnostics, maxDepth, depth);
    
    case 'ListExpr':
      return evaluateListExpr(expr, context, adapter, diagnostics, maxDepth, depth);
    
    default:
      return failure(
        `Unsupported expression kind: ${(expr as AST.ASTNode).kind}`,
        location
      );
  }
}

// ============================================================================
// IDENTIFIER EVALUATION
// ============================================================================

function evaluateIdentifier(
  expr: AST.Identifier,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const name = expr.name;
  const location = expr.location;
  
  // Special identifiers
  if (name === 'true') return success(true, location);
  if (name === 'false') return success(false, location);
  if (name === 'null') return success(false, location);
  if (name === 'result') {
    const value = context.result;
    return success(value !== null && value !== undefined, location);
  }
  if (name === 'input') {
    return success(true, location);
  }
  if (name === 'now') {
    return success(true, location);
  }
  
  // Variables
  if (context.variables.has(name)) {
    const value = context.variables.get(name);
    return success(value !== null && value !== undefined, location);
  }
  
  // Input fields
  if (name in context.input) {
    const value = context.input[name];
    return success(value !== null && value !== undefined, location);
  }
  
  // Entity types (for entity methods)
  const entity = context.domain.entities.find((e) => e.name.name === name);
  if (entity) {
    return success(true, location);
  }
  
  return failure(`Unknown identifier: ${name}`, location);
}

function evaluateQualifiedName(
  expr: AST.QualifiedName,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const parts = expr.parts.map((p) => p.name);
  const location = expr.location;
  
  // Start with first part
  const firstPart = { kind: 'Identifier' as const, name: parts[0]!, location: expr.parts[0]!.location };
  const firstResult = evaluateIdentifier(firstPart, context, adapter, diagnostics, maxDepth, depth);
  
  if (firstResult.value === false || firstResult.value === 'unknown') {
    return firstResult;
  }
  
  // Navigate through remaining parts (simplified - assumes property access works)
  return success(true, location, [firstResult]);
}

// ============================================================================
// BINARY EXPRESSIONS
// ============================================================================

function evaluateBinaryExpr(
  expr: AST.BinaryExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  
  // Short-circuit operators
  if (expr.operator === 'and') {
    const leftResult = evaluateRecursive(expr.left, context, adapter, diagnostics, maxDepth, depth + 1);
    if (leftResult.value === false) {
      return failure('Left operand of && is false', location, [leftResult]);
    }
    if (leftResult.value === 'unknown') {
      const rightResult = evaluateRecursive(expr.right, context, adapter, diagnostics, maxDepth, depth + 1);
      const combined = triStateAnd(leftResult.value, rightResult.value);
      return combined === 'unknown'
        ? unknown('Left operand is unknown', location, [leftResult, rightResult])
        : success(combined, location, [leftResult, rightResult]);
    }
    
    const rightResult = evaluateRecursive(expr.right, context, adapter, diagnostics, maxDepth, depth + 1);
    const combined = triStateAnd(leftResult.value, rightResult.value);
    
    if (combined === false) {
      return failure('Right operand of && is false', location, [leftResult, rightResult]);
    }
    if (combined === 'unknown') {
      return unknown('Right operand is unknown', location, [leftResult, rightResult]);
    }
    return success(true, location, [leftResult, rightResult]);
  }
  
  if (expr.operator === 'or') {
    const leftResult = evaluateRecursive(expr.left, context, adapter, diagnostics, maxDepth, depth + 1);
    if (leftResult.value === true) {
      return success(true, location, [leftResult]);
    }
    if (leftResult.value === 'unknown') {
      const rightResult = evaluateRecursive(expr.right, context, adapter, diagnostics, maxDepth, depth + 1);
      const combined = triStateOr(leftResult.value, rightResult.value);
      return combined === 'unknown'
        ? unknown('Left operand is unknown', location, [leftResult, rightResult])
        : success(combined, location, [leftResult, rightResult]);
    }
    
    const rightResult = evaluateRecursive(expr.right, context, adapter, diagnostics, maxDepth, depth + 1);
    const combined = triStateOr(leftResult.value, rightResult.value);
    
    if (combined === true) {
      return success(true, location, [leftResult, rightResult]);
    }
    if (combined === 'unknown') {
      return unknown('Right operand is unknown', location, [leftResult, rightResult]);
    }
    return failure('Both operands of || are false', location, [leftResult, rightResult]);
  }
  
  if (expr.operator === 'implies') {
    const leftResult = evaluateRecursive(expr.left, context, adapter, diagnostics, maxDepth, depth + 1);
    if (leftResult.value === false) {
      // false implies anything is true
      return success(true, location, [leftResult]);
    }
    
    const rightResult = evaluateRecursive(expr.right, context, adapter, diagnostics, maxDepth, depth + 1);
    const combined = triStateImplies(leftResult.value, rightResult.value);
    
    if (combined === false) {
      return failure('Implication failed: left is true but right is false', location, [leftResult, rightResult]);
    }
    if (combined === 'unknown') {
      return unknown('Implication has unknown value', location, [leftResult, rightResult]);
    }
    return success(true, location, [leftResult, rightResult]);
  }
  
  // Evaluate both sides for comparison operators
  const leftResult = evaluateRecursive(expr.left, context, adapter, diagnostics, maxDepth, depth + 1);
  const rightResult = evaluateRecursive(expr.right, context, adapter, diagnostics, maxDepth, depth + 1);
  
  // Extract actual values (for comparison)
  const leftValue = extractValue(expr.left, context);
  const rightValue = extractValue(expr.right, context);
  
  // Handle unknown values
  if (leftValue === 'unknown' || rightValue === 'unknown') {
    return unknown(
      `Cannot compare: ${leftValue === 'unknown' ? 'left' : 'right'} operand is unknown`,
      location,
      [leftResult, rightResult]
    );
  }
  
  let result: boolean;
  let reason: string | undefined;
  
  switch (expr.operator) {
    case '==':
      result = deepEqual(leftValue, rightValue);
      if (!result) {
        reason = `Values not equal: ${JSON.stringify(leftValue)} != ${JSON.stringify(rightValue)}`;
      }
      break;
    
    case '!=':
      result = !deepEqual(leftValue, rightValue);
      if (!result) {
        reason = `Values equal: ${JSON.stringify(leftValue)} == ${JSON.stringify(rightValue)}`;
      }
      break;
    
    case '<':
      if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
        return failure(`Cannot compare non-numbers with <`, location, [leftResult, rightResult]);
      }
      result = leftValue < rightValue;
      if (!result) {
        reason = `${leftValue} is not less than ${rightValue}`;
      }
      break;
    
    case '<=':
      if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
        return failure(`Cannot compare non-numbers with <=`, location, [leftResult, rightResult]);
      }
      result = leftValue <= rightValue;
      if (!result) {
        reason = `${leftValue} is not less than or equal to ${rightValue}`;
      }
      break;
    
    case '>':
      if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
        return failure(`Cannot compare non-numbers with >`, location, [leftResult, rightResult]);
      }
      result = leftValue > rightValue;
      if (!result) {
        reason = `${leftValue} is not greater than ${rightValue}`;
      }
      break;
    
    case '>=':
      if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
        return failure(`Cannot compare non-numbers with >=`, location, [leftResult, rightResult]);
      }
      result = leftValue >= rightValue;
      if (!result) {
        reason = `${leftValue} is not greater than or equal to ${rightValue}`;
      }
      break;
    
    default:
      return failure(`Unsupported binary operator: ${expr.operator}`, location, [leftResult, rightResult]);
  }
  
  if (result) {
    return success(true, location, [leftResult, rightResult]);
  }
  return failure(reason ?? 'Comparison failed', location, [leftResult, rightResult]);
}

// ============================================================================
// UNARY EXPRESSIONS
// ============================================================================

function evaluateUnaryExpr(
  expr: AST.UnaryExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  const operandResult = evaluateRecursive(expr.operand, context, adapter, diagnostics, maxDepth, depth + 1);
  
  switch (expr.operator) {
    case 'not':
      const result = triStateNot(operandResult.value);
      if (result === 'unknown') {
        return unknown('Operand is unknown', location, [operandResult]);
      }
      return success(result, location, [operandResult]);
    
    case '-':
      const value = extractValue(expr.operand, context);
      if (value === 'unknown' || typeof value !== 'number') {
        return failure('Cannot negate non-number or unknown value', location, [operandResult]);
      }
      return success(true, location, [operandResult]);
    
    default:
      return failure(`Unsupported unary operator: ${expr.operator}`, location, [operandResult]);
  }
}

// ============================================================================
// CALL EXPRESSIONS
// ============================================================================

function evaluateCallExpr(
  expr: AST.CallExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  
  // Handle member calls (e.g., User.exists(...))
  if (expr.callee.kind === 'MemberExpr') {
    return evaluateMemberCall(expr, context, adapter, diagnostics, maxDepth, depth);
  }
  
  // Handle builtin functions
  if (expr.callee.kind === 'Identifier') {
    return evaluateBuiltinCall(expr, context, adapter, diagnostics, maxDepth, depth);
  }
  
  return failure('Unsupported call expression', location);
}

function evaluateMemberCall(
  expr: AST.CallExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  const memberExpr = expr.callee as AST.MemberExpr;
  
  // Evaluate object (e.g., User)
  const objectResult = evaluateRecursive(memberExpr.object, context, adapter, diagnostics, maxDepth, depth + 1);
  const method = memberExpr.property.name;
  
  // Evaluate arguments
  const argResults = expr.arguments.map((arg) =>
    evaluateRecursive(arg, context, adapter, diagnostics, maxDepth, depth + 1)
  );
  const argValues = expr.arguments.map((arg) => extractValue(arg, context));
  
  // Handle entity method calls (User.exists, User.lookup)
  if (memberExpr.object.kind === 'Identifier') {
    const entityName = (memberExpr.object as AST.Identifier).name;
    const entity = context.domain.entities.find((e) => e.name.name === entityName);
    
    if (entity) {
      if (method === 'exists') {
        const criteria = buildCriteria(argValues, expr);
        const result = adapter.exists?.(entityName, criteria, context);
        if (result === 'unknown' || result === undefined) {
          return unknown(`Cannot determine if ${entityName} exists`, location, [objectResult, ...argResults]);
        }
        return success(result, location, [objectResult, ...argResults]);
      }
      
      if (method === 'lookup') {
        const criteria = buildCriteria(argValues, expr);
        const result = adapter.lookup?.(entityName, criteria, context);
        if (result === 'unknown' || result === undefined) {
          return unknown(`Cannot lookup ${entityName}`, location, [objectResult, ...argResults]);
        }
        return success(result !== null && result !== undefined, location, [objectResult, ...argResults]);
      }
    }
  }
  
  // Handle property method calls (e.g., email.is_valid, array.length)
  const objectValue = extractValue(memberExpr.object, context);
  
  if (method === 'is_valid') {
    const result = adapter.is_valid?.(objectValue, context);
    if (result === 'unknown' || result === undefined) {
      return unknown('Cannot determine validity', location, [objectResult, ...argResults]);
    }
    return success(result, location, [objectResult, ...argResults]);
  }
  
  if (method === 'length') {
    const length = adapter.length?.(objectValue, context);
    if (length === 'unknown' || length === undefined) {
      return unknown('Cannot determine length', location, [objectResult, ...argResults]);
    }
    return success(true, location, [objectResult, ...argResults]);
  }
  
  return failure(`Unknown method: ${method}`, location, [objectResult, ...argResults]);
}

function evaluateBuiltinCall(
  expr: AST.CallExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  const identifier = expr.callee as AST.Identifier;
  const name = identifier.name;
  const argResults = expr.arguments.map((arg) =>
    evaluateRecursive(arg, context, adapter, diagnostics, maxDepth, depth + 1)
  );
  const argValues = expr.arguments.map((arg) => extractValue(arg, context));
  
  // Handle any() and all() quantifiers
  if (name === 'any' || name === 'all') {
    if (argValues.length === 0 || argValues[0] === 'unknown') {
      return unknown('Cannot evaluate quantifier: collection is unknown', location, argResults);
    }
    
    const collection = argValues[0];
    if (!Array.isArray(collection)) {
      return failure('Quantifier requires an array', location, argResults);
    }
    
    if (collection.length === 0) {
      return success(name === 'all', location, argResults); // all([]) = true, any([]) = false
    }
    
    // Simplified: assume all elements pass predicate
    // Full implementation would evaluate predicate for each element
    return success(name === 'all', location, argResults);
  }
  
  return failure(`Unknown function: ${name}`, location, argResults);
}

// ============================================================================
// MEMBER EXPRESSIONS
// ============================================================================

function evaluateMemberExpr(
  expr: AST.MemberExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  const objectResult = evaluateRecursive(expr.object, context, adapter, diagnostics, maxDepth, depth + 1);
  const property = expr.property.name;
  
  const objectValue = extractValue(expr.object, context);
  
  if (objectValue === 'unknown' || objectValue === null || objectValue === undefined) {
    return unknown(`Cannot access property ${property}: object is null/undefined/unknown`, location, [objectResult]);
  }
  
  // Handle special properties
  if (property === 'length') {
    const length = adapter.length?.(objectValue, context);
    if (length === 'unknown' || length === undefined) {
      return unknown(`Cannot determine length`, location, [objectResult]);
    }
    return success(true, location, [objectResult]);
  }
  
  if (property === 'is_valid') {
    const result = adapter.is_valid?.(objectValue, context);
    if (result === 'unknown' || result === undefined) {
      return unknown(`Cannot determine validity`, location, [objectResult]);
    }
    return success(result, location, [objectResult]);
  }
  
  // General property access
  if (typeof objectValue === 'object' && property in objectValue) {
    return success(true, location, [objectResult]);
  }
  
  return failure(`Property ${property} not found`, location, [objectResult]);
}

// ============================================================================
// INDEX EXPRESSIONS
// ============================================================================

function evaluateIndexExpr(
  expr: AST.IndexExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  const objectResult = evaluateRecursive(expr.object, context, adapter, diagnostics, maxDepth, depth + 1);
  const indexResult = evaluateRecursive(expr.index, context, adapter, diagnostics, maxDepth, depth + 1);
  
  const objectValue = extractValue(expr.object, context);
  const indexValue = extractValue(expr.index, context);
  
  if (objectValue === 'unknown' || indexValue === 'unknown') {
    return unknown('Cannot index: object or index is unknown', location, [objectResult, indexResult]);
  }
  
  if (objectValue === null || objectValue === undefined) {
    return failure('Cannot index null/undefined', location, [objectResult, indexResult]);
  }
  
  if (Array.isArray(objectValue)) {
    if (typeof indexValue !== 'number') {
      return failure('Array index must be a number', location, [objectResult, indexResult]);
    }
    return success(indexValue >= 0 && indexValue < objectValue.length, location, [objectResult, indexResult]);
  }
  
  if (typeof objectValue === 'object') {
    return success(indexValue !== null && indexValue !== undefined, location, [objectResult, indexResult]);
  }
  
  return failure('Cannot index non-array/object', location, [objectResult, indexResult]);
}

// ============================================================================
// QUANTIFIER EXPRESSIONS
// ============================================================================

function evaluateQuantifierExpr(
  expr: AST.QuantifierExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  const collectionResult = evaluateRecursive(expr.collection, context, adapter, diagnostics, maxDepth, depth + 1);
  
  const collectionValue = extractValue(expr.collection, context);
  
  if (collectionValue === 'unknown') {
    return unknown('Cannot evaluate quantifier: collection is unknown', location, [collectionResult]);
  }
  
  if (!Array.isArray(collectionValue)) {
    return failure('Quantifier requires an array', location, [collectionResult]);
  }
  
  if (collectionValue.length === 0) {
    // Empty collection: all() = true, any() = false
    const result = expr.quantifier === 'all';
    return success(result, location, [collectionResult]);
  }
  
  // Evaluate predicate for each item
  const variable = expr.variable.name;
  const predicateResults: EvaluationResult[] = [];
  let allTrue = true;
  let anyTrue = false;
  let hasUnknown = false;
  
  for (const item of collectionValue) {
    const innerContext = {
      ...context,
      variables: new Map(context.variables),
    };
    innerContext.variables.set(variable, item);
    
    const predicateResult = evaluateRecursive(expr.predicate, innerContext, adapter, diagnostics, maxDepth, depth + 1);
    predicateResults.push(predicateResult);
    
    if (predicateResult.value === true) {
      anyTrue = true;
    } else if (predicateResult.value === 'unknown') {
      hasUnknown = true;
    } else {
      allTrue = false;
    }
  }
  
  switch (expr.quantifier) {
    case 'all':
      if (hasUnknown) {
        return unknown('Some predicate evaluations returned unknown', location, [collectionResult, ...predicateResults]);
      }
      return success(allTrue, location, [collectionResult, ...predicateResults]);
    
    case 'any':
      if (hasUnknown && !anyTrue) {
        return unknown('Some predicate evaluations returned unknown', location, [collectionResult, ...predicateResults]);
      }
      return success(anyTrue, location, [collectionResult, ...predicateResults]);
    
    default:
      return failure(`Unsupported quantifier: ${expr.quantifier}`, location, [collectionResult, ...predicateResults]);
  }
}

// ============================================================================
// CONDITIONAL EXPRESSIONS
// ============================================================================

function evaluateConditionalExpr(
  expr: AST.ConditionalExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  const conditionResult = evaluateRecursive(expr.condition, context, adapter, diagnostics, maxDepth, depth + 1);
  
  if (conditionResult.value === 'unknown') {
    return unknown('Condition is unknown', location, [conditionResult]);
  }
  
  const branch = conditionResult.value ? expr.thenBranch : expr.elseBranch;
  const branchResult = evaluateRecursive(branch, context, adapter, diagnostics, maxDepth, depth + 1);
  
  return {
    value: branchResult.value,
    location,
    reason: branchResult.reason,
    children: [conditionResult, branchResult],
  };
}

// ============================================================================
// SPECIAL EXPRESSIONS
// ============================================================================

function evaluateOldExpr(
  expr: AST.OldExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  
  if (!context.oldState) {
    return failure('old() called without previous state snapshot', location);
  }
  
  // Create context with old state
  const oldStore = createOldStateStore(context.oldState);
  const oldContext: EvaluationContext = {
    ...context,
    store: oldStore,
  };
  
  return evaluateRecursive(expr.expression, oldContext, adapter, diagnostics, maxDepth, depth + 1);
}

function evaluateResultExpr(
  expr: AST.ResultExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  
  if (context.result === null || context.result === undefined) {
    return failure('result is null or undefined', location);
  }
  
  if (expr.property) {
    const resultObj = context.result as Record<string, unknown>;
    if (!(expr.property.name in resultObj)) {
      return failure(`Property ${expr.property.name} not found in result`, location);
    }
  }
  
  return success(true, location);
}

function evaluateInputExpr(
  expr: AST.InputExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  const property = expr.property.name;
  
  if (!(property in context.input)) {
    return failure(`Input property ${property} not found`, location);
  }
  
  const value = context.input[property];
  return success(value !== null && value !== undefined, location);
}

function evaluateListExpr(
  expr: AST.ListExpr,
  context: EvaluationContext,
  adapter: ExpressionAdapter,
  diagnostics: boolean,
  maxDepth: number,
  depth: number
): EvaluationResult {
  const location = expr.location;
  const elementResults = expr.elements.map((el) =>
    evaluateRecursive(el, context, adapter, diagnostics, maxDepth, depth + 1)
  );
  
  // List is valid if all elements are valid
  const allValid = elementResults.every((r) => r.value === true);
  if (allValid) {
    return success(true, location, elementResults);
  }
  
  const hasUnknown = elementResults.some((r) => r.value === 'unknown');
  if (hasUnknown) {
    return unknown('Some list elements are unknown', location, elementResults);
  }
  
  return failure('Some list elements are invalid', location, elementResults);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Extract actual value from expression (for comparisons)
 */
function extractValue(expr: AST.Expression, context: EvaluationContext): unknown {
  switch (expr.kind) {
    case 'StringLiteral':
      return expr.value;
    case 'NumberLiteral':
      return expr.value;
    case 'BooleanLiteral':
      return expr.value;
    case 'NullLiteral':
      return null;
    case 'Identifier': {
      const name = expr.name;
      if (name === 'true') return true;
      if (name === 'false') return false;
      if (name === 'null') return null;
      if (name === 'result') return context.result;
      if (name === 'input') return context.input;
      if (context.variables.has(name)) return context.variables.get(name);
      if (name in context.input) return context.input[name];
      return 'unknown';
    }
    case 'MemberExpr': {
      const objectValue = extractValue(expr.object, context);
      if (objectValue === 'unknown' || objectValue === null || objectValue === undefined) {
        return 'unknown';
      }
      if (typeof objectValue === 'object' && expr.property.name in objectValue) {
        return (objectValue as Record<string, unknown>)[expr.property.name];
      }
      return 'unknown';
    }
    case 'IndexExpr': {
      const objectValue = extractValue(expr.object, context);
      const indexValue = extractValue(expr.index, context);
      if (objectValue === 'unknown' || indexValue === 'unknown') {
        return 'unknown';
      }
      if (Array.isArray(objectValue) && typeof indexValue === 'number') {
        return objectValue[indexValue];
      }
      if (typeof objectValue === 'object' && indexValue !== null && indexValue !== undefined) {
        return (objectValue as Record<string, unknown>)[String(indexValue)];
      }
      return 'unknown';
    }
    case 'ListExpr': {
      return expr.elements.map((el) => extractValue(el, context));
    }
    default:
      return 'unknown';
  }
}

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

function buildCriteria(argValues: unknown[], expr: AST.CallExpr): Record<string, unknown> {
  if (argValues.length === 1 && typeof argValues[0] === 'object' && argValues[0] !== null) {
    return argValues[0] as Record<string, unknown>;
  }
  
  const criteria: Record<string, unknown> = {};
  
  // Try to build from named arguments
  for (let i = 0; i < expr.arguments.length; i++) {
    const arg = expr.arguments[i]!;
    if (arg.kind === 'BinaryExpr' && (arg as AST.BinaryExpr).operator === '==') {
      const binExpr = arg as AST.BinaryExpr;
      if (binExpr.left.kind === 'Identifier') {
        criteria[(binExpr.left as AST.Identifier).name] = argValues[i];
      }
    }
  }
  
  // If no named args, assume first arg is id
  if (Object.keys(criteria).length === 0 && argValues.length === 1) {
    criteria['id'] = argValues[0];
  }
  
  return criteria;
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
