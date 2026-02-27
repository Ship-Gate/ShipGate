# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PlanStore, InMemoryPlanStore
# dependencies: 

domain Store {
  version: "1.0.0"

  type PlanStore = String
  type InMemoryPlanStore = String

  invariants exports_present {
    - true
  }
}
