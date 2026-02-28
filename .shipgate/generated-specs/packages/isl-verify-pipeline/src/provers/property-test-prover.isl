# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PropertyTestThoroughness, PropertyTestConfig, PropertyTestEvidence, PropertyProof, PropertyTestResult, PropertyTestProver
# dependencies: @isl-lang/pbt

domain PropertyTestProver {
  version: "1.0.0"

  type PropertyTestThoroughness = String
  type PropertyTestConfig = String
  type PropertyTestEvidence = String
  type PropertyProof = String
  type PropertyTestResult = String
  type PropertyTestProver = String

  invariants exports_present {
    - true
  }
}
