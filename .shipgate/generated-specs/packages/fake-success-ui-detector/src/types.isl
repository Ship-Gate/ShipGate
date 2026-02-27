# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: FrameworkType, PatternType, CallChainEvidence, FakeSuccessClaim, DetectionResult, DetectionOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type FrameworkType = String
  type PatternType = String
  type CallChainEvidence = String
  type FakeSuccessClaim = String
  type DetectionResult = String
  type DetectionOptions = String

  invariants exports_present {
    - true
  }
}
