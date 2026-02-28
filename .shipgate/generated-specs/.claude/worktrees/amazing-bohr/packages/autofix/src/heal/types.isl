# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RootCauseCategory, HealPhase, VerificationFailureInput, AnalyzedFailure, HealPlanGroup, SurgicalDiff, ApplyDiffResult, HealIterationResult, HealReport
# dependencies: 

domain Types {
  version: "1.0.0"

  type RootCauseCategory = String
  type HealPhase = String
  type VerificationFailureInput = String
  type AnalyzedFailure = String
  type HealPlanGroup = String
  type SurgicalDiff = String
  type ApplyDiffResult = String
  type HealIterationResult = String
  type HealReport = String

  invariants exports_present {
    - true
  }
}
