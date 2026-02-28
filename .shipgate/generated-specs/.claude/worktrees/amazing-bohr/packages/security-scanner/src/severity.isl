# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: compareSeverity, getSeverityFromScore, createEmptyScanResult, calculateSummary, SEVERITY_INFO, CATEGORY_INFO, Severity, SeverityInfo, SecurityCategory, SourceLocation, Finding, ScanSummary, ScanResult, ScanOptions, SecurityRule, RuleChecker, RuleContext, Domain, TypeDeclaration, TypeDefinition, Annotation, Entity, Field, Behavior, ActorSpec, InputSpec, OutputSpec, ErrorSpec, PostconditionBlock, TemporalSpec, SecuritySpec, ObservabilitySpec, LogSpec, InvariantBlock, Policy, View, ScenarioBlock
# dependencies: 

domain Severity {
  version: "1.0.0"

  type Severity = String
  type SeverityInfo = String
  type SecurityCategory = String
  type SourceLocation = String
  type Finding = String
  type ScanSummary = String
  type ScanResult = String
  type ScanOptions = String
  type SecurityRule = String
  type RuleChecker = String
  type RuleContext = String
  type Domain = String
  type TypeDeclaration = String
  type TypeDefinition = String
  type Annotation = String
  type Entity = String
  type Field = String
  type Behavior = String
  type ActorSpec = String
  type InputSpec = String
  type OutputSpec = String
  type ErrorSpec = String
  type PostconditionBlock = String
  type TemporalSpec = String
  type SecuritySpec = String
  type ObservabilitySpec = String
  type LogSpec = String
  type InvariantBlock = String
  type Policy = String
  type View = String
  type ScenarioBlock = String

  invariants exports_present {
    - true
  }
}
