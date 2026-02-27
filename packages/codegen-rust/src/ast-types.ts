// ============================================================================
// AST Type Definitions (minimal interfaces for codegen)
// ============================================================================

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface ASTNode {
  kind: string;
  location: SourceLocation;
}

export interface Identifier extends ASTNode {
  kind: 'Identifier';
  name: string;
}

export interface StringLiteral extends ASTNode {
  kind: 'StringLiteral';
  value: string;
}

export interface QualifiedName extends ASTNode {
  kind: 'QualifiedName';
  parts: Identifier[];
}

// Type definitions
export type TypeDefinition =
  | PrimitiveType
  | ConstrainedType
  | EnumType
  | StructType
  | UnionType
  | ListType
  | MapType
  | OptionalType
  | ReferenceType;

export interface PrimitiveType extends ASTNode {
  kind: 'PrimitiveType';
  name: string;
}

export interface ConstrainedType extends ASTNode {
  kind: 'ConstrainedType';
  base: TypeDefinition;
  constraints: Constraint[];
}

export interface Constraint extends ASTNode {
  kind: 'Constraint';
  name: string;
  value: Expression;
}

export interface EnumType extends ASTNode {
  kind: 'EnumType';
  variants: EnumVariant[];
}

export interface EnumVariant extends ASTNode {
  kind: 'EnumVariant';
  name: Identifier;
  value?: Literal;
}

export interface StructType extends ASTNode {
  kind: 'StructType';
  fields: Field[];
}

export interface UnionType extends ASTNode {
  kind: 'UnionType';
  variants: UnionVariant[];
}

export interface UnionVariant extends ASTNode {
  kind: 'UnionVariant';
  name: Identifier;
  fields: Field[];
}

export interface ListType extends ASTNode {
  kind: 'ListType';
  element: TypeDefinition;
}

export interface MapType extends ASTNode {
  kind: 'MapType';
  key: TypeDefinition;
  value: TypeDefinition;
}

export interface OptionalType extends ASTNode {
  kind: 'OptionalType';
  inner: TypeDefinition;
}

export interface ReferenceType extends ASTNode {
  kind: 'ReferenceType';
  name: QualifiedName;
}

export interface Field extends ASTNode {
  kind: 'Field';
  name: Identifier;
  type: TypeDefinition;
  optional: boolean;
  annotations: Annotation[];
}

export interface Annotation extends ASTNode {
  kind: 'Annotation';
  name: Identifier;
  value?: Expression;
}

export interface Literal extends ASTNode {
  kind: 'Literal';
  litKind: string;
}

export type Expression = ASTNode;

// Domain types
export interface Domain extends ASTNode {
  kind: 'Domain';
  name: Identifier;
  version: StringLiteral;
  types: TypeDeclaration[];
  entities: Entity[];
  behaviors: Behavior[];
  invariants: InvariantBlock[];
  policies: Policy[];
  views: View[];
}

export interface TypeDeclaration extends ASTNode {
  kind: 'TypeDeclaration';
  name: Identifier;
  definition: TypeDefinition;
  annotations: Annotation[];
}

export interface Entity extends ASTNode {
  kind: 'Entity';
  name: Identifier;
  fields: Field[];
  invariants: Expression[];
  lifecycle?: LifecycleSpec;
}

export interface LifecycleSpec extends ASTNode {
  kind: 'LifecycleSpec';
  transitions: LifecycleTransition[];
}

export interface LifecycleTransition extends ASTNode {
  kind: 'LifecycleTransition';
  from: Identifier;
  to: Identifier;
}

export interface Behavior extends ASTNode {
  kind: 'Behavior';
  name: Identifier;
  description?: StringLiteral;
  input: InputSpec;
  output: OutputSpec;
  preconditions: Expression[];
  postconditions: PostconditionBlock[];
}

export interface InputSpec extends ASTNode {
  kind: 'InputSpec';
  fields: Field[];
}

export interface OutputSpec extends ASTNode {
  kind: 'OutputSpec';
  success: TypeDefinition;
  errors: ErrorSpec[];
}

export interface ErrorSpec extends ASTNode {
  kind: 'ErrorSpec';
  name: Identifier;
  when?: StringLiteral;
  retriable: boolean;
}

export interface PostconditionBlock extends ASTNode {
  kind: 'PostconditionBlock';
  condition: Identifier | 'success' | 'any_error';
  predicates: Expression[];
}

export interface InvariantBlock extends ASTNode {
  kind: 'InvariantBlock';
  name: Identifier;
  predicates: Expression[];
}

export interface Policy extends ASTNode {
  kind: 'Policy';
  name: Identifier;
}

export interface View extends ASTNode {
  kind: 'View';
  name: Identifier;
  forEntity: ReferenceType;
  fields: ViewField[];
}

export interface ViewField extends ASTNode {
  kind: 'ViewField';
  name: Identifier;
  type: TypeDefinition;
}
