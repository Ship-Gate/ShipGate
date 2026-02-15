# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: HealPlanOptions, HealPlanExecutor
# dependencies: 

domain HealPlan {
  version: "1.0.0"

  type HealPlanOptions = String
  type HealPlanExecutor = String

  invariants exports_present {
    - true
  }
}
