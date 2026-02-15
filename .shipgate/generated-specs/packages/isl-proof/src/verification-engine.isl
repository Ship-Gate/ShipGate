# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyDomain, TraceEvent, TraceSlice, SourceSpanInfo, EvaluationResult, ClauseEvidence, VerificationVerdict, VerificationResult, VerificationEngine
# dependencies: @isl-lang/evaluator

domain VerificationEngine {
  version: "1.0.0"

  type TraceEvent = String
  type TraceSlice = String
  type SourceSpanInfo = String
  type EvaluationResult = String
  type ClauseEvidence = String
  type VerificationVerdict = String
  type VerificationResult = String
  type VerificationEngine = String

  invariants exports_present {
    - true
  }
}
