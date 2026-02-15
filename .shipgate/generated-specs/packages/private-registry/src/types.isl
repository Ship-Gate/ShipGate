# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Ecosystem, DependencyVerdict, PrivateRegistryConfig, DetectOptions, ClassifyInput, ClassifyResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type Ecosystem = String
  type DependencyVerdict = String
  type PrivateRegistryConfig = String
  type DetectOptions = String
  type ClassifyInput = String
  type ClassifyResult = String

  invariants exports_present {
    - true
  }
}
