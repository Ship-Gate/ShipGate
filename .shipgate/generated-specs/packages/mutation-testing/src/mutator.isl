# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: mutate, createMutants, applyMutant, revertMutant, MutationEngine
# dependencies: 

domain Mutator {
  version: "1.0.0"

  type MutationEngine = String

  invariants exports_present {
    - true
  }
}
