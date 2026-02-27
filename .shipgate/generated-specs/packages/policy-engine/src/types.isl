# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Policy, PolicyRule, PolicyCondition, ConditionType, ConditionOperator, PolicyEffect, PolicyObligation, PolicyScope, EnforcementMode, PolicyContext, PrincipalContext, ResourceContext, ActionContext, EnvironmentContext, PolicyDecision, PolicyEvaluationResult, PolicySet, CombiningAlgorithm, PolicyAuditLog, PolicyStats
# dependencies: 

domain Types {
  version: "1.0.0"

  type Policy = String
  type PolicyRule = String
  type PolicyCondition = String
  type ConditionType = String
  type ConditionOperator = String
  type PolicyEffect = String
  type PolicyObligation = String
  type PolicyScope = String
  type EnforcementMode = String
  type PolicyContext = String
  type PrincipalContext = String
  type ResourceContext = String
  type ActionContext = String
  type EnvironmentContext = String
  type PolicyDecision = String
  type PolicyEvaluationResult = String
  type PolicySet = String
  type CombiningAlgorithm = String
  type PolicyAuditLog = String
  type PolicyStats = String

  invariants exports_present {
    - true
  }
}
