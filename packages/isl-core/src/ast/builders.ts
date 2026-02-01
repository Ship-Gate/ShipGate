/**
 * AST Builder Functions
 * 
 * Helper functions for constructing AST nodes.
 */

import type { SourceSpan, SourceLocation } from '../lexer/tokens.js';
import type * as AST from './types.js';

/**
 * Create a source span from start and end locations
 */
export function span(start: SourceLocation, end: SourceLocation, file?: string): SourceSpan {
  return { start, end, file };
}

/**
 * Create an empty span (for synthetic nodes)
 */
export function emptySpan(): SourceSpan {
  const loc: SourceLocation = { line: 0, column: 0, offset: 0 };
  return { start: loc, end: loc };
}

// ============================================
// Identifier & Literals
// ============================================

export function identifier(name: string, s: SourceSpan): AST.Identifier {
  return { kind: 'Identifier', name, span: s };
}

export function stringLiteral(value: string, s: SourceSpan): AST.StringLiteral {
  return { kind: 'StringLiteral', value, span: s };
}

export function numberLiteral(value: number, s: SourceSpan, unit?: string): AST.NumberLiteral {
  return { kind: 'NumberLiteral', value, unit, span: s };
}

export function booleanLiteral(value: boolean, s: SourceSpan): AST.BooleanLiteral {
  return { kind: 'BooleanLiteral', value, span: s };
}

export function nullLiteral(s: SourceSpan): AST.NullLiteral {
  return { kind: 'NullLiteral', span: s };
}

export function durationLiteral(
  value: number, 
  unit: 'ms' | 's' | 'm' | 'h' | 'd', 
  s: SourceSpan
): AST.DurationLiteral {
  return { kind: 'DurationLiteral', value, unit, span: s };
}

// ============================================
// Expressions
// ============================================

export function binaryExpression(
  operator: string,
  left: AST.Expression,
  right: AST.Expression,
  s: SourceSpan
): AST.BinaryExpression {
  return { kind: 'BinaryExpression', operator, left, right, span: s };
}

export function unaryExpression(
  operator: 'not' | '-',
  operand: AST.Expression,
  s: SourceSpan
): AST.UnaryExpression {
  return { kind: 'UnaryExpression', operator, operand, span: s };
}

export function memberExpression(
  object: AST.Expression,
  property: AST.Identifier,
  s: SourceSpan
): AST.MemberExpression {
  return { kind: 'MemberExpression', object, property, span: s };
}

export function callExpression(
  callee: AST.Expression,
  args: AST.Expression[],
  s: SourceSpan
): AST.CallExpression {
  return { kind: 'CallExpression', callee, arguments: args, span: s };
}

export function comparisonExpression(
  operator: '==' | '!=' | '<' | '>' | '<=' | '>=',
  left: AST.Expression,
  right: AST.Expression,
  s: SourceSpan
): AST.ComparisonExpression {
  return { kind: 'ComparisonExpression', operator, left, right, span: s };
}

export function logicalExpression(
  operator: 'and' | 'or',
  left: AST.Expression,
  right: AST.Expression,
  s: SourceSpan
): AST.LogicalExpression {
  return { kind: 'LogicalExpression', operator, left, right, span: s };
}

export function oldExpression(expression: AST.Expression, s: SourceSpan): AST.OldExpression {
  return { kind: 'OldExpression', expression, span: s };
}

// ============================================
// Types
// ============================================

export function simpleType(name: AST.Identifier, s: SourceSpan): AST.SimpleType {
  return { kind: 'SimpleType', name, span: s };
}

export function genericType(
  name: AST.Identifier,
  typeArguments: AST.TypeExpression[],
  s: SourceSpan
): AST.GenericType {
  return { kind: 'GenericType', name, typeArguments, span: s };
}

export function unionType(variants: AST.TypeVariant[], s: SourceSpan): AST.UnionType {
  return { kind: 'UnionType', variants, span: s };
}

export function objectType(fields: AST.FieldDeclaration[], s: SourceSpan): AST.ObjectType {
  return { kind: 'ObjectType', fields, span: s };
}

export function arrayType(elementType: AST.TypeExpression, s: SourceSpan): AST.ArrayType {
  return { kind: 'ArrayType', elementType, span: s };
}

// ============================================
// Declarations
// ============================================

export function domainDeclaration(
  name: AST.Identifier,
  s: SourceSpan,
  options?: Partial<Omit<AST.DomainDeclaration, 'kind' | 'name' | 'span'>>
): AST.DomainDeclaration {
  return {
    kind: 'DomainDeclaration',
    name,
    span: s,
    imports: options?.imports ?? [],
    entities: options?.entities ?? [],
    types: options?.types ?? [],
    enums: options?.enums ?? [],
    behaviors: options?.behaviors ?? [],
    invariants: options?.invariants ?? [],
    version: options?.version,
  };
}

export function entityDeclaration(
  name: AST.Identifier,
  fields: AST.FieldDeclaration[],
  s: SourceSpan,
  options?: { invariants?: AST.InvariantStatement[]; lifecycle?: AST.LifecycleBlock }
): AST.EntityDeclaration {
  return {
    kind: 'EntityDeclaration',
    name,
    fields,
    span: s,
    invariants: options?.invariants,
    lifecycle: options?.lifecycle,
  };
}

export function fieldDeclaration(
  name: AST.Identifier,
  type: AST.TypeExpression,
  s: SourceSpan,
  options?: {
    optional?: boolean;
    annotations?: AST.Annotation[];
    constraints?: AST.TypeConstraint[];
    defaultValue?: AST.Expression;
    computed?: AST.Expression;
  }
): AST.FieldDeclaration {
  return {
    kind: 'FieldDeclaration',
    name,
    type,
    optional: options?.optional ?? false,
    annotations: options?.annotations ?? [],
    constraints: options?.constraints ?? [],
    defaultValue: options?.defaultValue,
    computed: options?.computed,
    span: s,
  };
}

export function behaviorDeclaration(
  name: AST.Identifier,
  s: SourceSpan,
  options?: Partial<Omit<AST.BehaviorDeclaration, 'kind' | 'name' | 'span'>>
): AST.BehaviorDeclaration {
  return {
    kind: 'BehaviorDeclaration',
    name,
    span: s,
    ...options,
  };
}

export function annotation(
  name: AST.Identifier,
  s: SourceSpan,
  value?: AST.Expression
): AST.Annotation {
  return { kind: 'Annotation', name, value, span: s };
}

export function typeConstraint(
  name: AST.Identifier,
  s: SourceSpan,
  value?: AST.Expression
): AST.TypeConstraint {
  return { kind: 'TypeConstraint', name, value, span: s };
}

// ============================================
// Blocks
// ============================================

export function inputBlock(fields: AST.FieldDeclaration[], s: SourceSpan): AST.InputBlock {
  return { kind: 'InputBlock', fields, span: s };
}

export function outputBlock(
  success: AST.TypeExpression,
  errors: AST.ErrorDeclaration[],
  s: SourceSpan
): AST.OutputBlock {
  return { kind: 'OutputBlock', success, errors, span: s };
}

export function errorDeclaration(
  name: AST.Identifier,
  s: SourceSpan,
  options?: {
    when?: AST.StringLiteral;
    retriable?: boolean;
    retryAfter?: AST.Expression;
    returns?: AST.Identifier;
    includes?: AST.Identifier;
  }
): AST.ErrorDeclaration {
  return {
    kind: 'ErrorDeclaration',
    name,
    span: s,
    ...options,
  };
}

export function conditionBlock(conditions: AST.Condition[], s: SourceSpan): AST.ConditionBlock {
  return { kind: 'ConditionBlock', conditions, span: s };
}

export function condition(
  statements: AST.ConditionStatement[],
  s: SourceSpan,
  options?: { guard?: 'success' | 'failure' | AST.Identifier; implies?: boolean }
): AST.Condition {
  return {
    kind: 'Condition',
    statements,
    span: s,
    guard: options?.guard,
    implies: options?.implies ?? false,
  };
}

export function conditionStatement(
  expression: AST.Expression,
  s: SourceSpan,
  description?: AST.StringLiteral
): AST.ConditionStatement {
  return { kind: 'ConditionStatement', expression, description, span: s };
}

export function invariantStatement(
  expression: AST.Expression,
  s: SourceSpan,
  description?: AST.StringLiteral
): AST.InvariantStatement {
  return { kind: 'InvariantStatement', expression, description, span: s };
}

export function temporalBlock(
  requirements: AST.TemporalRequirement[],
  s: SourceSpan
): AST.TemporalBlock {
  return { kind: 'TemporalBlock', requirements, span: s };
}

export function temporalRequirement(
  type: 'eventually' | 'within' | 'immediately' | 'never' | 'always',
  condition: AST.Expression,
  s: SourceSpan,
  options?: { duration?: AST.DurationLiteral; percentile?: string }
): AST.TemporalRequirement {
  return {
    kind: 'TemporalRequirement',
    type,
    condition,
    span: s,
    duration: options?.duration,
    percentile: options?.percentile,
  };
}
