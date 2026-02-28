# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PolicySeverity, PolicyCategory, TechStack, BusinessDomain, PolicyConstraint, PolicyRemediation, Policy, PolicyPack, PolicyFilterOptions, PolicyEvaluationResult, PolicyViolation
# dependencies: 

domain PolicyTypes {
  version: "1.0.0"

  type PolicySeverity = String
  type PolicyCategory = String
  type TechStack = String
  type BusinessDomain = String
  type PolicyConstraint = String
  type PolicyRemediation = String
  type Policy = String
  type PolicyPack = String
  type PolicyFilterOptions = String
  type PolicyEvaluationResult = String
  type PolicyViolation = String

  invariants exports_present {
    - true
  }
}
