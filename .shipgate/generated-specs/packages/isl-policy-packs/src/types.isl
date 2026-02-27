# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PolicySeverity, PolicyRule, RuleContext, RuleViolation, PolicyPack, PolicyPackConfig, TruthpackData, TraceEntry, RouteDefinition, EnvDefinition, AuthDefinition, ContractDefinition, PolicyPackRegistry
# dependencies: 

domain Types {
  version: "1.0.0"

  type PolicySeverity = String
  type PolicyRule = String
  type RuleContext = String
  type RuleViolation = String
  type PolicyPack = String
  type PolicyPackConfig = String
  type TruthpackData = String
  type TraceEntry = String
  type RouteDefinition = String
  type EnvDefinition = String
  type AuthDefinition = String
  type ContractDefinition = String
  type PolicyPackRegistry = String

  invariants exports_present {
    - true
  }
}
