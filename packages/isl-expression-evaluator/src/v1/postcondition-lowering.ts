// ============================================================================
// ISL Expression Evaluator v1 - Postcondition Lowering Pass
// ============================================================================
//
// Normalizes ISL postcondition syntax into evaluable predicates.
//
// Input patterns:
// - "User.failed_attempts increased by 1"
// - "no Session created"
// - "User.lookup_by_email(input.email).failed_attempts increased by 1"
// - "actor.user.failed_attempts incremented"
//
// Output: Normalized predicates that can be evaluated with before/after state
//
// ============================================================================

import type { Expression } from '@isl-lang/parser';
import type {
  IncreasedByPredicate,
  NoneCreatedPredicate,
  IncrementedPredicate,
  FieldReference,
  DeltaValue,
  SimpleFieldPath,
  MethodCallField,
} from './postcondition-types.js';
import {
  increasedBy,
  noneCreated,
  incremented,
  simplePath,
  methodCallField,
  literalDelta,
  variableDelta,
} from './postcondition-types.js';

// ============================================================================
// LOWERING RESULT
// ============================================================================

/**
 * Result of lowering a postcondition expression
 */
export interface LoweringResult {
  /** Whether lowering was successful */
  success: boolean;
  /** The lowered predicate (if successful) */
  predicate?: IncreasedByPredicate | NoneCreatedPredicate | IncrementedPredicate;
  /** Error message (if unsuccessful) */
  error?: string;
  /** Original expression (for debugging) */
  original?: unknown;
}

// ============================================================================
// PATTERN MATCHERS
// ============================================================================

/**
 * Pattern for "increased by" expressions
 * Matches: X increased by Y
 */
const INCREASED_BY_PATTERN = /^(.+)\s+increased\s+by\s+(.+)$/i;

/**
 * Pattern for "decreased by" expressions
 * Matches: X decreased by Y
 */
const DECREASED_BY_PATTERN = /^(.+)\s+decreased\s+by\s+(.+)$/i;

/**
 * Pattern for "no X created" expressions
 * Matches: no Session created, no token generated
 */
const NO_CREATED_PATTERN = /^no\s+(\w+)\s+(created|generated)$/i;

/**
 * Pattern for "incremented" expressions
 * Matches: X incremented
 */
const INCREMENTED_PATTERN = /^(.+)\s+incremented$/i;

/**
 * Pattern for Entity.created == false
 * Matches: Session.created == false
 */
const CREATED_FALSE_PATTERN = /^(\w+)\.created\s*==\s*false$/i;

// ============================================================================
// STRING-BASED LOWERING
// ============================================================================

/**
 * Lower a string-based postcondition expression
 * 
 * @param text - The postcondition text to lower
 * @returns Lowering result with normalized predicate
 * 
 * @example
 * lowerFromString("User.failed_attempts increased by 1")
 * // Returns: IncreasedByPredicate
 * 
 * lowerFromString("no Session created")
 * // Returns: NoneCreatedPredicate
 */
export function lowerFromString(text: string): LoweringResult {
  const trimmed = text.trim();

  // Try "no X created" pattern first
  const noCreatedMatch = trimmed.match(NO_CREATED_PATTERN);
  if (noCreatedMatch) {
    const entityType = noCreatedMatch[1];
    const action = noCreatedMatch[2].toLowerCase();
    return {
      success: true,
      predicate: noneCreated(entityType, action === 'generated' ? 'token' : undefined),
      original: text,
    };
  }

  // Try "increased by" pattern
  const increasedMatch = trimmed.match(INCREASED_BY_PATTERN);
  if (increasedMatch) {
    const fieldText = increasedMatch[1].trim();
    const deltaText = increasedMatch[2].trim();
    
    const field = parseFieldReference(fieldText);
    const delta = parseDeltaValue(deltaText);
    
    return {
      success: true,
      predicate: increasedBy(field, delta, 'increased'),
      original: text,
    };
  }

  // Try "decreased by" pattern
  const decreasedMatch = trimmed.match(DECREASED_BY_PATTERN);
  if (decreasedMatch) {
    const fieldText = decreasedMatch[1].trim();
    const deltaText = decreasedMatch[2].trim();
    
    const field = parseFieldReference(fieldText);
    const delta = parseDeltaValue(deltaText);
    
    return {
      success: true,
      predicate: increasedBy(field, delta, 'decreased'),
      original: text,
    };
  }

  // Try "incremented" pattern
  const incrementedMatch = trimmed.match(INCREMENTED_PATTERN);
  if (incrementedMatch) {
    const fieldText = incrementedMatch[1].trim();
    const field = parseFieldReference(fieldText);
    
    return {
      success: true,
      predicate: incremented(field),
      original: text,
    };
  }

  // Try "Entity.created == false" pattern
  const createdFalseMatch = trimmed.match(CREATED_FALSE_PATTERN);
  if (createdFalseMatch) {
    const entityType = createdFalseMatch[1];
    return {
      success: true,
      predicate: noneCreated(entityType),
      original: text,
    };
  }

  return {
    success: false,
    error: `Unable to parse postcondition: "${text}"`,
    original: text,
  };
}

/**
 * Parse a field reference from text
 * 
 * Handles:
 * - Simple paths: "User.failed_attempts"
 * - Method calls: "User.lookup_by_email(input.email).failed_attempts"
 */
function parseFieldReference(text: string): FieldReference {
  // Check for method call pattern
  const methodCallMatch = text.match(/^(\w+)\.(\w+)\(([^)]*)\)(?:\.(.+))?$/);
  if (methodCallMatch) {
    const entity = methodCallMatch[1];
    const method = methodCallMatch[2];
    const argsText = methodCallMatch[3];
    const propertyPathText = methodCallMatch[4];
    
    const args = parseMethodArgs(argsText);
    const propertyPath = propertyPathText ? propertyPathText.split('.') : [];
    
    return methodCallField(entity, method, args, ...propertyPath);
  }

  // Simple path
  const segments = text.split('.');
  return simplePath(...segments);
}

/**
 * Parse method arguments from text
 */
function parseMethodArgs(text: string): unknown[] {
  if (!text.trim()) {
    return [];
  }

  // Handle simple variable references like "input.email"
  const args = text.split(',').map(arg => {
    const trimmed = arg.trim();
    
    // Check if it's a string literal
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    
    // Check if it's a number
    const num = Number(trimmed);
    if (!isNaN(num)) {
      return num;
    }
    
    // Return as variable reference
    return { kind: 'variable', path: trimmed.split('.') };
  });

  return args;
}

/**
 * Parse a delta value from text
 */
function parseDeltaValue(text: string): DeltaValue {
  // Check if it's a number literal
  const num = Number(text);
  if (!isNaN(num)) {
    return literalDelta(num);
  }

  // Check if it's a negative number
  if (text.startsWith('-')) {
    const negNum = Number(text);
    if (!isNaN(negNum)) {
      return literalDelta(negNum);
    }
  }

  // Treat as variable reference
  return variableDelta(text);
}

// ============================================================================
// AST-BASED LOWERING
// ============================================================================

/**
 * Lower an AST expression to a postcondition predicate
 * 
 * Handles AST patterns like:
 * - BinaryExpr with "increased_by" operator (if parser supports it)
 * - Special PostconditionExpr nodes
 * - Lowered old() comparisons
 */
export function lowerFromAST(expr: Expression): LoweringResult {
  // Handle special postcondition expression types (if present in AST)
  if ('postconditionKind' in expr) {
    return lowerSpecialPostcondition(expr);
  }

  // Handle BinaryExpr patterns
  if (expr.kind === 'BinaryExpr') {
    return lowerBinaryExpr(expr);
  }

  // Handle UnaryExpr for negation patterns like "not Session.created"
  if (expr.kind === 'UnaryExpr') {
    return lowerUnaryExpr(expr);
  }

  return {
    success: false,
    error: `Cannot lower expression kind: ${expr.kind}`,
    original: expr,
  };
}

/**
 * Lower a special postcondition expression
 */
function lowerSpecialPostcondition(expr: unknown): LoweringResult {
  const typedExpr = expr as { postconditionKind?: string; [key: string]: unknown };
  
  if (typedExpr.postconditionKind === 'increased_by') {
    const field = extractFieldFromAST(typedExpr.field);
    const delta = extractDeltaFromAST(typedExpr.delta);
    const direction = (typedExpr.direction as 'increased' | 'decreased') || 'increased';
    
    return {
      success: true,
      predicate: increasedBy(field, delta, direction),
      original: expr,
    };
  }

  if (typedExpr.postconditionKind === 'none_created') {
    const entityType = typedExpr.entityType as string;
    const alias = typedExpr.alias as string | undefined;
    
    return {
      success: true,
      predicate: noneCreated(entityType, alias),
      original: expr,
    };
  }

  return {
    success: false,
    error: `Unknown postcondition kind: ${typedExpr.postconditionKind}`,
    original: expr,
  };
}

/**
 * Lower a binary expression that might be a postcondition pattern
 * 
 * Patterns:
 * - old(field) + delta == field (increased by)
 * - field == old(field) + delta (increased by)
 */
function lowerBinaryExpr(expr: Expression): LoweringResult {
  const binExpr = expr as {
    operator: string;
    left: Expression;
    right: Expression;
  };

  // Check for equality comparison that might be an increased_by pattern
  if (binExpr.operator === '==') {
    return lowerEqualityForIncreased(binExpr.left, binExpr.right, expr);
  }

  return {
    success: false,
    error: `Binary expression with operator '${binExpr.operator}' is not a recognized postcondition pattern`,
    original: expr,
  };
}

/**
 * Lower an equality expression to check for increased_by pattern
 */
function lowerEqualityForIncreased(
  left: Expression,
  right: Expression,
  original: Expression
): LoweringResult {
  // Pattern: field == old(field) + delta
  const patternA = tryExtractIncreasedPattern(left, right);
  if (patternA.success) {
    return patternA;
  }

  // Pattern: old(field) + delta == field
  const patternB = tryExtractIncreasedPattern(right, left);
  if (patternB.success) {
    return patternB;
  }

  return {
    success: false,
    error: 'Equality expression does not match increased_by pattern',
    original,
  };
}

/**
 * Try to extract increased_by pattern from expressions
 * 
 * Looking for: field == old(field) + delta
 */
function tryExtractIncreasedPattern(
  fieldExpr: Expression,
  sumExpr: Expression
): LoweringResult {
  // Check if sumExpr is a binary + with old() on one side
  if (sumExpr.kind !== 'BinaryExpr') {
    return { success: false, error: 'Not a binary expression' };
  }

  const sum = sumExpr as { operator: string; left: Expression; right: Expression };
  if (sum.operator !== '+') {
    return { success: false, error: 'Not an addition' };
  }

  // Check if left is old() expression
  if (sum.left.kind === 'OldExpr') {
    const oldExpr = sum.left as { expression: Expression };
    const field = extractFieldFromAST(fieldExpr);
    const delta = extractDeltaFromAST(sum.right);
    
    return {
      success: true,
      predicate: increasedBy(field, delta, 'increased'),
      original: sumExpr,
    };
  }

  // Check if right is old() expression
  if (sum.right.kind === 'OldExpr') {
    const field = extractFieldFromAST(fieldExpr);
    const delta = extractDeltaFromAST(sum.left);
    
    return {
      success: true,
      predicate: increasedBy(field, delta, 'increased'),
      original: sumExpr,
    };
  }

  return { success: false, error: 'No old() expression found in addition' };
}

/**
 * Lower a unary expression that might be a postcondition pattern
 * Pattern: not Entity.created (equivalent to no Entity created)
 */
function lowerUnaryExpr(expr: Expression): LoweringResult {
  const unaryExpr = expr as { operator: string; operand: Expression };
  
  if (unaryExpr.operator === 'not' || unaryExpr.operator === '!') {
    // Check if operand is Entity.created
    if (unaryExpr.operand.kind === 'MemberExpr') {
      const memberExpr = unaryExpr.operand as {
        object: Expression;
        property: { name: string };
      };
      
      if (memberExpr.property.name === 'created') {
        // Extract entity type
        if (memberExpr.object.kind === 'Identifier') {
          const entityType = (memberExpr.object as { name: string }).name;
          return {
            success: true,
            predicate: noneCreated(entityType),
            original: expr,
          };
        }
      }
    }
  }

  return {
    success: false,
    error: 'Unary expression does not match none_created pattern',
    original: expr,
  };
}

/**
 * Extract a field reference from an AST expression
 */
function extractFieldFromAST(expr: unknown): FieldReference {
  if (!expr || typeof expr !== 'object') {
    return simplePath('unknown');
  }

  const typedExpr = expr as { kind?: string; [key: string]: unknown };

  // Handle Identifier
  if (typedExpr.kind === 'Identifier') {
    return simplePath((typedExpr as { name: string }).name);
  }

  // Handle MemberExpr - build path
  if (typedExpr.kind === 'MemberExpr') {
    const path = extractMemberPath(typedExpr);
    return simplePath(...path);
  }

  // Handle CallExpr - method call field
  if (typedExpr.kind === 'CallExpr') {
    return extractCallFieldFromAST(typedExpr);
  }

  // Handle already parsed FieldReference
  if ('kind' in typedExpr && typedExpr.kind === 'simple_path') {
    return typedExpr as SimpleFieldPath;
  }
  if ('kind' in typedExpr && typedExpr.kind === 'method_call') {
    return typedExpr as MethodCallField;
  }

  return simplePath('unknown');
}

/**
 * Extract member access path from MemberExpr
 */
function extractMemberPath(expr: unknown): string[] {
  const typedExpr = expr as {
    kind: string;
    object: unknown;
    property: { name: string };
  };

  if (typedExpr.kind !== 'MemberExpr') {
    if (typedExpr.kind === 'Identifier') {
      return [(typedExpr as unknown as { name: string }).name];
    }
    return [];
  }

  const path = extractMemberPath(typedExpr.object);
  path.push(typedExpr.property.name);
  return path;
}

/**
 * Extract CallExpr as MethodCallField
 */
function extractCallFieldFromAST(expr: unknown): FieldReference {
  const callExpr = expr as {
    callee: unknown;
    arguments: unknown[];
  };

  // Check if callee is a member expression (Entity.method)
  const callee = callExpr.callee as { kind?: string; object?: unknown; property?: { name: string } };
  
  if (callee.kind === 'MemberExpr') {
    const objectPath = extractMemberPath(callee.object);
    const entity = objectPath[0] || 'Unknown';
    const method = callee.property?.name || 'unknown';
    
    return methodCallField(entity, method, callExpr.arguments);
  }

  return simplePath('unknown');
}

/**
 * Extract a delta value from an AST expression
 */
function extractDeltaFromAST(expr: unknown): DeltaValue {
  if (!expr || typeof expr !== 'object') {
    return literalDelta(1);
  }

  const typedExpr = expr as { kind?: string; value?: unknown; name?: string };

  // Handle NumberLiteral
  if (typedExpr.kind === 'NumberLiteral') {
    return literalDelta(typedExpr.value as number);
  }

  // Handle Identifier (variable reference)
  if (typedExpr.kind === 'Identifier') {
    return variableDelta(typedExpr.name as string);
  }

  // Handle MemberExpr (variable path like input.amount)
  if (typedExpr.kind === 'MemberExpr') {
    const path = extractMemberPath(typedExpr);
    return variableDelta(path.join('.'));
  }

  // Default to 1
  return literalDelta(1);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Lower a postcondition from either string or AST
 */
export function lower(input: string | Expression): LoweringResult {
  if (typeof input === 'string') {
    return lowerFromString(input);
  }
  return lowerFromAST(input);
}

/**
 * Batch lower multiple postconditions
 */
export function lowerAll(inputs: (string | Expression)[]): LoweringResult[] {
  return inputs.map(lower);
}

/**
 * Check if a string looks like an increased_by pattern
 */
export function isIncreasedByPattern(text: string): boolean {
  return INCREASED_BY_PATTERN.test(text.trim()) || DECREASED_BY_PATTERN.test(text.trim());
}

/**
 * Check if a string looks like a none_created pattern
 */
export function isNoneCreatedPattern(text: string): boolean {
  return NO_CREATED_PATTERN.test(text.trim()) || CREATED_FALSE_PATTERN.test(text.trim());
}

/**
 * Check if a string looks like an incremented pattern
 */
export function isIncrementedPattern(text: string): boolean {
  return INCREMENTED_PATTERN.test(text.trim());
}
