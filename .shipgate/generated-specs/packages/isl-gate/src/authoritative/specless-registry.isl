# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: registerSpeclessCheck, unregisterSpeclessCheck, getSpeclessChecks, clearSpeclessChecks, runSpeclessChecks, GateContext, SpeclessCheck
# dependencies: 

domain SpeclessRegistry {
  version: "1.0.0"

  type GateContext = String
  type SpeclessCheck = String

  invariants exports_present {
    - true
  }
}
