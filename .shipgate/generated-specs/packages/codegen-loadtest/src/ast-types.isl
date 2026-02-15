# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SourceLocation, ASTNode, Identifier, StringLiteral, NumberLiteral, DurationLiteral, Domain, TypeDeclaration, TypeDefinition, Entity, Field, Annotation, Behavior, InputSpec, OutputSpec, ErrorSpec, TemporalSpec, SecuritySpec, Expression, SLAThreshold, RateLimit, BehaviorSLA, InputFieldSpec
# dependencies: 

domain AstTypes {
  version: "1.0.0"

  type SourceLocation = String
  type ASTNode = String
  type Identifier = String
  type StringLiteral = String
  type NumberLiteral = String
  type DurationLiteral = String
  type Domain = String
  type TypeDeclaration = String
  type TypeDefinition = String
  type Entity = String
  type Field = String
  type Annotation = String
  type Behavior = String
  type InputSpec = String
  type OutputSpec = String
  type ErrorSpec = String
  type TemporalSpec = String
  type SecuritySpec = String
  type Expression = String
  type SLAThreshold = String
  type RateLimit = String
  type BehaviorSLA = String
  type InputFieldSpec = String

  invariants exports_present {
    - true
  }
}
