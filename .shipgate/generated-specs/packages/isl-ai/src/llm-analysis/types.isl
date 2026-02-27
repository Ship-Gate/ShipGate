# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: LLMAnalysisContext, CodeEvidence, TriggerResult, LLMAnalysisConfig, CitedClaim, LLMAnalysisOutput, RawLLMResponse
# dependencies: 

domain Types {
  version: "1.0.0"

  type LLMAnalysisContext = String
  type CodeEvidence = String
  type TriggerResult = String
  type LLMAnalysisConfig = String
  type CitedClaim = String
  type LLMAnalysisOutput = String
  type RawLLMResponse = String

  invariants exports_present {
    - true
  }
}
