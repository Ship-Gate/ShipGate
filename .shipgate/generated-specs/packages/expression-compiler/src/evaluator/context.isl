# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createEvaluationContext, EMPTY_ENTITY_STORE, EvaluationContext, StateSnapshot, EntityInstance, EntityStore, InMemoryEntityStore, ContextOptions
# dependencies: 

domain Context {
  version: "1.0.0"

  type EvaluationContext = String
  type StateSnapshot = String
  type EntityInstance = String
  type EntityStore = String
  type InMemoryEntityStore = String
  type ContextOptions = String

  invariants exports_present {
    - true
  }
}
