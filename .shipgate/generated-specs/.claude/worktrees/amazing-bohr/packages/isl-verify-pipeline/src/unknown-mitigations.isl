# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: attemptRuntimeSampling, attemptFallbackCheck, attemptConstraintSlicing, attemptSMTRetry, attemptMitigations, applyMitigationResults, MitigationContext, MitigationResult
# dependencies: 

domain UnknownMitigations {
  version: "1.0.0"

  type MitigationContext = String
  type MitigationResult = String

  invariants exports_present {
    - true
  }
}
