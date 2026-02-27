# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createEffectAnalyzer, createEffectInference, EffectAnalyzer, CompositionAnalysis, EffectConflict, EffectInference
# dependencies: 

domain Analysis {
  version: "1.0.0"

  type EffectAnalyzer = String
  type CompositionAnalysis = String
  type EffectConflict = String
  type EffectInference = String

  invariants exports_present {
    - true
  }
}
