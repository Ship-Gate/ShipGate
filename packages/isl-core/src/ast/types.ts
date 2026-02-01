/**
 * ISL Abstract Syntax Tree Types
 * 
 * Defines the structure of parsed ISL programs.
 */

import type { SourceSpan } from '../lexer/tokens.js';

// Base node interface
export interface BaseNode {
  kind: string;
  span: SourceSpan;
}

// ============================================
// Top-Level Declarations
// ============================================

export interface DomainDeclaration extends BaseNode {
  kind: 'DomainDeclaration';
  name: Identifier;
  version?: StringLiteral;
  imports: ImportDeclaration[];
  entities: EntityDeclaration[];
  types: TypeDeclaration[];
  enums: EnumDeclaration[];
  behaviors: BehaviorDeclaration[];
  invariants: InvariantsBlock[];
}

export interface ImportDeclaration extends BaseNode {
  kind: 'ImportDeclaration';
  names: Identifier[];
  from: StringLiteral;
}

// ============================================
// Type Declarations
// ============================================

export interface EntityDeclaration extends BaseNode {
  kind: 'EntityDeclaration';
  name: Identifier;
  fields: FieldDeclaration[];
  invariants?: InvariantStatement[];
  lifecycle?: LifecycleBlock;
}

export interface TypeDeclaration extends BaseNode {
  kind: 'TypeDeclaration';
  name: Identifier;
  baseType: TypeExpression;
  constraints: TypeConstraint[];
}

export interface EnumDeclaration extends BaseNode {
  kind: 'EnumDeclaration';
  name: Identifier;
  variants: Identifier[];
}

export interface FieldDeclaration extends BaseNode {
  kind: 'FieldDeclaration';
  name: Identifier;
  type: TypeExpression;
  optional: boolean;
  annotations: Annotation[];
  constraints: TypeConstraint[];
  defaultValue?: Expression;
  computed?: Expression;
}

// ============================================
// Behavior Declarations
// ============================================

export interface BehaviorDeclaration extends BaseNode {
  kind: 'BehaviorDeclaration';
  name: Identifier;
  description?: StringLiteral;
  actors?: ActorsBlock;
  input?: InputBlock;
  output?: OutputBlock;
  preconditions?: ConditionBlock;
  postconditions?: ConditionBlock;
  invariants?: InvariantStatement[];
  temporal?: TemporalBlock;
  security?: SecurityBlock;
  compliance?: ComplianceBlock;
}

export interface ActorsBlock extends BaseNode {
  kind: 'ActorsBlock';
  actors: ActorDeclaration[];
}

export interface ActorDeclaration extends BaseNode {
  kind: 'ActorDeclaration';
  name: Identifier;
  constraints: ActorConstraint[];
}

export interface ActorConstraint extends BaseNode {
  kind: 'ActorConstraint';
  type: 'must' | 'owns' | 'with_permission' | 'for';
  value: Expression;
}

export interface InputBlock extends BaseNode {
  kind: 'InputBlock';
  fields: FieldDeclaration[];
}

export interface OutputBlock extends BaseNode {
  kind: 'OutputBlock';
  success: TypeExpression;
  errors: ErrorDeclaration[];
}

export interface ErrorDeclaration extends BaseNode {
  kind: 'ErrorDeclaration';
  name: Identifier;
  when?: StringLiteral;
  retriable?: boolean;
  retryAfter?: Expression;
  returns?: Identifier;
  includes?: Identifier;
}

// ============================================
// Condition Blocks
// ============================================

export interface ConditionBlock extends BaseNode {
  kind: 'ConditionBlock';
  conditions: Condition[];
}

export interface Condition extends BaseNode {
  kind: 'Condition';
  guard?: 'success' | 'failure' | Identifier;
  implies: boolean;
  statements: ConditionStatement[];
}

export interface ConditionStatement extends BaseNode {
  kind: 'ConditionStatement';
  expression: Expression;
  description?: StringLiteral;
}

// ============================================
// Invariants
// ============================================

export interface InvariantsBlock extends BaseNode {
  kind: 'InvariantsBlock';
  name: Identifier;
  description?: StringLiteral;
  scope?: 'global' | 'entity' | 'behavior';
  invariants: InvariantStatement[];
}

export interface InvariantStatement extends BaseNode {
  kind: 'InvariantStatement';
  expression: Expression;
  description?: StringLiteral;
}

// ============================================
// Temporal Requirements
// ============================================

export interface TemporalBlock extends BaseNode {
  kind: 'TemporalBlock';
  requirements: TemporalRequirement[];
}

export interface TemporalRequirement extends BaseNode {
  kind: 'TemporalRequirement';
  type: 'eventually' | 'within' | 'immediately' | 'never' | 'always';
  duration?: DurationLiteral;
  percentile?: string;
  condition: Expression;
}

// ============================================
// Security Requirements
// ============================================

export interface SecurityBlock extends BaseNode {
  kind: 'SecurityBlock';
  requirements: SecurityRequirement[];
}

export interface SecurityRequirement extends BaseNode {
  kind: 'SecurityRequirement';
  type: string; // 'requires', 'rate_limit', 'must', etc.
  expression: Expression;
}

// ============================================
// Compliance Requirements
// ============================================

export interface ComplianceBlock extends BaseNode {
  kind: 'ComplianceBlock';
  standards: ComplianceStandard[];
}

export interface ComplianceStandard extends BaseNode {
  kind: 'ComplianceStandard';
  name: Identifier;
  requirements: ComplianceRequirement[];
}

export interface ComplianceRequirement extends BaseNode {
  kind: 'ComplianceRequirement';
  expression: Expression;
}

// ============================================
// Lifecycle
// ============================================

export interface LifecycleBlock extends BaseNode {
  kind: 'LifecycleBlock';
  transitions: LifecycleTransition[];
}

export interface LifecycleTransition extends BaseNode {
  kind: 'LifecycleTransition';
  states: Identifier[];
}

// ============================================
// Type Expressions
// ============================================

export type TypeExpression =
  | SimpleType
  | GenericType
  | UnionType
  | ObjectType
  | ArrayType;

export interface SimpleType extends BaseNode {
  kind: 'SimpleType';
  name: Identifier;
}

export interface GenericType extends BaseNode {
  kind: 'GenericType';
  name: Identifier;
  typeArguments: TypeExpression[];
}

export interface UnionType extends BaseNode {
  kind: 'UnionType';
  variants: TypeVariant[];
}

export interface TypeVariant extends BaseNode {
  kind: 'TypeVariant';
  name: Identifier;
  fields?: FieldDeclaration[];
}

export interface ObjectType extends BaseNode {
  kind: 'ObjectType';
  fields: FieldDeclaration[];
}

export interface ArrayType extends BaseNode {
  kind: 'ArrayType';
  elementType: TypeExpression;
}

// ============================================
// Type Constraints & Annotations
// ============================================

export interface TypeConstraint extends BaseNode {
  kind: 'TypeConstraint';
  name: Identifier;
  value?: Expression;
}

export interface Annotation extends BaseNode {
  kind: 'Annotation';
  name: Identifier;
  value?: Expression;
}

// ============================================
// Expressions
// ============================================

export type Expression =
  | Identifier
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | NullLiteral
  | DurationLiteral
  | BinaryExpression
  | UnaryExpression
  | MemberExpression
  | CallExpression
  | ComparisonExpression
  | LogicalExpression
  | QuantifiedExpression
  | OldExpression;

export interface Identifier extends BaseNode {
  kind: 'Identifier';
  name: string;
}

export interface StringLiteral extends BaseNode {
  kind: 'StringLiteral';
  value: string;
}

export interface NumberLiteral extends BaseNode {
  kind: 'NumberLiteral';
  value: number;
  unit?: string;
}

export interface BooleanLiteral extends BaseNode {
  kind: 'BooleanLiteral';
  value: boolean;
}

export interface NullLiteral extends BaseNode {
  kind: 'NullLiteral';
}

export interface DurationLiteral extends BaseNode {
  kind: 'DurationLiteral';
  value: number;
  unit: 'ms' | 's' | 'm' | 'h' | 'd';
}

export interface BinaryExpression extends BaseNode {
  kind: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends BaseNode {
  kind: 'UnaryExpression';
  operator: 'not' | '-';
  operand: Expression;
}

export interface MemberExpression extends BaseNode {
  kind: 'MemberExpression';
  object: Expression;
  property: Identifier;
}

export interface CallExpression extends BaseNode {
  kind: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
}

export interface ComparisonExpression extends BaseNode {
  kind: 'ComparisonExpression';
  operator: '==' | '!=' | '<' | '>' | '<=' | '>=';
  left: Expression;
  right: Expression;
}

export interface LogicalExpression extends BaseNode {
  kind: 'LogicalExpression';
  operator: 'and' | 'or';
  left: Expression;
  right: Expression;
}

export interface QuantifiedExpression extends BaseNode {
  kind: 'QuantifiedExpression';
  quantifier: 'all' | 'some' | 'none';
  variable: Identifier;
  collection: Expression;
  predicate: Expression;
}

export interface OldExpression extends BaseNode {
  kind: 'OldExpression';
  expression: Expression;
}

// ============================================
// AST Node Union
// ============================================

export type ASTNode =
  | DomainDeclaration
  | ImportDeclaration
  | EntityDeclaration
  | TypeDeclaration
  | EnumDeclaration
  | FieldDeclaration
  | BehaviorDeclaration
  | ActorsBlock
  | ActorDeclaration
  | InputBlock
  | OutputBlock
  | ErrorDeclaration
  | ConditionBlock
  | Condition
  | ConditionStatement
  | InvariantsBlock
  | InvariantStatement
  | TemporalBlock
  | TemporalRequirement
  | SecurityBlock
  | SecurityRequirement
  | ComplianceBlock
  | ComplianceStandard
  | ComplianceRequirement
  | LifecycleBlock
  | LifecycleTransition
  | TypeExpression
  | TypeConstraint
  | Annotation
  | Expression;
