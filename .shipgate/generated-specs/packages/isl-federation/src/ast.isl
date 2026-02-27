# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SourceLocation, ASTNode, Identifier, QualifiedName, StringLiteral, Domain, Import, ImportItem, TypeDeclaration, TypeDefinition, PrimitiveType, ConstrainedType, Constraint, EnumType, EnumVariant, StructType, Field, UnionType, UnionVariant, ListType, MapType, OptionalType, ReferenceType, Annotation, Entity, LifecycleSpec, LifecycleTransition, Behavior, ActorSpec, InputSpec, OutputSpec, ErrorSpec, PostconditionBlock, TemporalSpec, SecuritySpec, ComplianceSpec, ObservabilitySpec, MetricSpec, TraceSpec, LogSpec, InvariantBlock, Policy, PolicyTarget, PolicyRule, View, ViewField, ConsistencySpec, CacheSpec, ScenarioBlock, Scenario, ChaosBlock, ChaosScenario, Injection, InjectionType, InjectionParam, Expression, Literal, NumberLiteral, BooleanLiteral, NullLiteral, DurationLiteral, RegexLiteral, BinaryExpr, BinaryOperator, UnaryExpr, UnaryOperator, CallExpr, MemberExpr, IndexExpr, QuantifierExpr, ConditionalExpr, OldExpr, ResultExpr, InputExpr, LambdaExpr, ListExpr, MapExpr, MapEntry, Statement, AssignmentStmt, CallStmt, LoopStmt
# dependencies: 

domain Ast {
  version: "1.0.0"

  type SourceLocation = String
  type ASTNode = String
  type Identifier = String
  type QualifiedName = String
  type StringLiteral = String
  type Domain = String
  type Import = String
  type ImportItem = String
  type TypeDeclaration = String
  type TypeDefinition = String
  type PrimitiveType = String
  type ConstrainedType = String
  type Constraint = String
  type EnumType = String
  type EnumVariant = String
  type StructType = String
  type Field = String
  type UnionType = String
  type UnionVariant = String
  type ListType = String
  type MapType = String
  type OptionalType = String
  type ReferenceType = String
  type Annotation = String
  type Entity = String
  type LifecycleSpec = String
  type LifecycleTransition = String
  type Behavior = String
  type ActorSpec = String
  type InputSpec = String
  type OutputSpec = String
  type ErrorSpec = String
  type PostconditionBlock = String
  type TemporalSpec = String
  type SecuritySpec = String
  type ComplianceSpec = String
  type ObservabilitySpec = String
  type MetricSpec = String
  type TraceSpec = String
  type LogSpec = String
  type InvariantBlock = String
  type Policy = String
  type PolicyTarget = String
  type PolicyRule = String
  type View = String
  type ViewField = String
  type ConsistencySpec = String
  type CacheSpec = String
  type ScenarioBlock = String
  type Scenario = String
  type ChaosBlock = String
  type ChaosScenario = String
  type Injection = String
  type InjectionType = String
  type InjectionParam = String
  type Expression = String
  type Literal = String
  type NumberLiteral = String
  type BooleanLiteral = String
  type NullLiteral = String
  type DurationLiteral = String
  type RegexLiteral = String
  type BinaryExpr = String
  type BinaryOperator = String
  type UnaryExpr = String
  type UnaryOperator = String
  type CallExpr = String
  type MemberExpr = String
  type IndexExpr = String
  type QuantifierExpr = String
  type ConditionalExpr = String
  type OldExpr = String
  type ResultExpr = String
  type InputExpr = String
  type LambdaExpr = String
  type ListExpr = String
  type MapExpr = String
  type MapEntry = String
  type Statement = String
  type AssignmentStmt = String
  type CallStmt = String
  type LoopStmt = String

  invariants exports_present {
    - true
  }
}
