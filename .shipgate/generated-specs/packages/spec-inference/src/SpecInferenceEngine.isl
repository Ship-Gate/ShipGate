# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SpecInferenceOptions, SpecInferenceResult, SpecInferenceEngine
# dependencies: fs, path

domain SpecInferenceEngine {
  version: "1.0.0"

  type SpecInferenceOptions = String
  type SpecInferenceResult = String
  type SpecInferenceEngine = String

  invariants exports_present {
    - true
  }
}
