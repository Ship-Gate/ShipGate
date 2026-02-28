# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createIdentifier, createStringLiteral, createNumberLiteral, createBooleanLiteral, createPrimitiveType, createReferenceType, createField, createEntity, createInputSpec, createOutputSpec, createBehavior, createDomain, normalizeAST, printAST, printASTCompact, fingerprintAST, shortFingerprint, validateShape, mockExtractor, corpusRunner, SourceLocation, ASTNode, Domain, Identifier, StringLiteral, NumberLiteral, BooleanLiteral, Import, ImportItem, TypeDeclaration, TypeDefinition, PrimitiveType, ConstrainedType, Constraint, EnumType, EnumVariant, StructType, UnionType, UnionVariant, ListType, MapType, OptionalType, ReferenceType, QualifiedName, Annotation, Field, Entity, LifecycleSpec, LifecycleTransition, Behavior, ActorSpec, InputSpec, OutputSpec, ErrorSpec, PostconditionBlock, TemporalSpec, SecuritySpec, ComplianceSpec, ObservabilitySpec, MetricSpec, TraceSpec, LogSpec, InvariantBlock, Policy, PolicyTarget, PolicyRule, View, ViewField, ConsistencySpec, CacheSpec, ScenarioBlock, Scenario, ChaosBlock, ChaosScenario, Injection, InjectionParam, DurationLiteral, Expression, BinaryExpr, UnaryExpr, CallExpr, MemberExpr, ListExpr, MapExpr, MapEntry, Statement, AssignmentStmt, CallStmt, ShapeRule, CorpusEntry, MockExtractor, ValidationResult, CorpusRunResult, CorpusRunner, CorpusSummary
# dependencies: crypto

domain CorpusRunner {
  version: "1.0.0"

  type SourceLocation = String
  type ASTNode = String
  type Domain = String
  type Identifier = String
  type StringLiteral = String
  type NumberLiteral = String
  type BooleanLiteral = String
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
  type UnionType = String
  type UnionVariant = String
  type ListType = String
  type MapType = String
  type OptionalType = String
  type ReferenceType = String
  type QualifiedName = String
  type Annotation = String
  type Field = String
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
  type InjectionParam = String
  type DurationLiteral = String
  type Expression = String
  type BinaryExpr = String
  type UnaryExpr = String
  type CallExpr = String
  type MemberExpr = String
  type ListExpr = String
  type MapExpr = String
  type MapEntry = String
  type Statement = String
  type AssignmentStmt = String
  type CallStmt = String
  type ShapeRule = String
  type CorpusEntry = String
  type MockExtractor = String
  type ValidationResult = String
  type CorpusRunResult = String
  type CorpusRunner = String
  type CorpusSummary = String

  invariants exports_present {
    - true
  }
}
