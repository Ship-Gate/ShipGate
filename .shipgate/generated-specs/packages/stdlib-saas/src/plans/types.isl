# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PlanDefinition, PlanLimits, PlanMetadata, FeatureDescription, TenantPlanAssignment, PlanUpgradeRequest, PlanUsage
# dependencies: 

domain Types {
  version: "1.0.0"

  type PlanDefinition = String
  type PlanLimits = String
  type PlanMetadata = String
  type FeatureDescription = String
  type TenantPlanAssignment = String
  type PlanUpgradeRequest = String
  type PlanUsage = String

  invariants exports_present {
    - true
  }
}
