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
  uses: UseStatement[];
  imports: ImportDeclaration[];
  entities: EntityDeclaration[];
  types: TypeDeclaration[];
  enums: EnumDeclaration[];
  behaviors: BehaviorDeclaration[];
  invariants: InvariantsBlock[];
  uiBlueprints?: UIBlueprintDeclaration[];
}

/**
 * Use statement for importing entire modules.
 *
 * Syntax variations:
 * - `use stdlib-auth`
 * - `use stdlib-auth as auth`
 * - `use stdlib-auth@1.0.0`
 * - `use stdlib-auth@1.0.0 as auth`
 * - `use "./local/module"`
 */
export interface UseStatement extends BaseNode {
  kind: 'UseStatement';
  /** Module specifier (e.g., "stdlib-auth", "./local") */
  module: Identifier | StringLiteral;
  /** Optional alias for the module */
  alias?: Identifier;
  /** Optional version constraint */
  version?: StringLiteral;
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
  chaos?: ChaosBlock;
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
// Chaos Engineering
// ============================================

export interface ChaosBlock extends BaseNode {
  kind: 'ChaosBlock';
  scenarios: ChaosScenario[];
}

export interface ChaosScenario extends BaseNode {
  kind: 'ChaosScenario';
  name: StringLiteral;
  injections: ChaosInjection[];
  expectations: ChaosExpectation[];
  retries?: NumberLiteral;
  withClauses?: ChaosWithClause[];
}

export interface ChaosInjection extends BaseNode {
  kind: 'ChaosInjection';
  type: Identifier;
  arguments: ChaosArgument[];
}

export interface ChaosExpectation extends BaseNode {
  kind: 'ChaosExpectation';
  expression: Expression;
}

export interface ChaosArgument extends BaseNode {
  kind: 'ChaosArgument';
  name: Identifier;
  value: Expression;
}

export interface ChaosWithClause extends BaseNode {
  kind: 'ChaosWithClause';
  name: Identifier;
  arguments: Expression[];
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
// UI Blueprint Declarations
// ============================================

export interface UIBlueprintDeclaration extends BaseNode {
  kind: 'UIBlueprintDeclaration';
  name: Identifier;
  sections: UISection[];
  tokens?: UITokenBlock;
  constraints?: UIConstraintBlock;
}

export interface UITokenBlock extends BaseNode {
  kind: 'UITokenBlock';
  tokens: UIToken[];
}

export interface UIToken extends BaseNode {
  kind: 'UIToken';
  name: Identifier;
  category: 'color' | 'spacing' | 'typography' | 'border' | 'shadow';
  value: Expression;
}

export interface UISection extends BaseNode {
  kind: 'UISection';
  name: Identifier;
  type: 'hero' | 'features' | 'testimonials' | 'cta' | 'footer' | 'header' | 'content';
  blocks: UIContentBlock[];
  layout?: UILayout;
}

export interface UILayout extends BaseNode {
  kind: 'UILayout';
  type: 'grid' | 'flex' | 'stack';
  columns?: NumberLiteral;
  gap?: Expression;
  responsive?: UIResponsive[];
}

export interface UIResponsive extends BaseNode {
  kind: 'UIResponsive';
  breakpoint: 'mobile' | 'tablet' | 'desktop';
  layout: UILayout;
}

export interface UIContentBlock extends BaseNode {
  kind: 'UIContentBlock';
  type: 'text' | 'heading' | 'image' | 'button' | 'form' | 'link' | 'container';
  props: UIBlockProperty[];
  children?: UIContentBlock[];
}

export interface UIBlockProperty extends BaseNode {
  kind: 'UIBlockProperty';
  name: Identifier;
  value: Expression;
}

export interface UIConstraintBlock extends BaseNode {
  kind: 'UIConstraintBlock';
  constraints: UIConstraint[];
}

export interface UIConstraint extends BaseNode {
  kind: 'UIConstraint';
  type: 'a11y' | 'seo' | 'perf' | 'security';
  rule: Identifier;
  value?: Expression;
}

// ============================================
// AST Node Union
// ============================================

export type ASTNode =
  | DomainDeclaration
  | UseStatement
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
  | ChaosBlock
  | ChaosScenario
  | ChaosInjection
  | ChaosExpectation
  | ChaosArgument
  | ChaosWithClause
  | LifecycleBlock
  | LifecycleTransition
  | UIBlueprintDeclaration
  | UITokenBlock
  | UIToken
  | UISection
  | UILayout
  | UIResponsive
  | UIContentBlock
  | UIBlockProperty
  | UIConstraintBlock
  | UIConstraint
  | TypeExpression
  | TypeConstraint
  | Annotation
  | Expression;
