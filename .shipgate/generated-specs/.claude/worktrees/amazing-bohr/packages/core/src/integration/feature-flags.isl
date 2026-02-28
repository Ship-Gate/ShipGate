# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: checkModule, tryImport, tryRequire, detectFeatures, withFeature, createFeatureGate, features, FeatureGates, VERSION, FeatureCheckResult, ISLFeatures
# dependencies: @isl-lang/core

domain FeatureFlags {
  version: "1.0.0"

  type FeatureCheckResult = String
  type ISLFeatures = String

  invariants exports_present {
    - true
  }
}
