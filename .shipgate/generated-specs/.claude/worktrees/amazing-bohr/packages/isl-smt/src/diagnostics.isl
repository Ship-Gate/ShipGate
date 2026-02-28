# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: minimizeCounterexample, extractCounterexample, analyzeUnsat, classifyUnknown, buildDiagnosticReport, MinimalCounterexample, UnsatAnalysis, UnknownReason, DiagnosticReport
# dependencies: @isl-lang/prover

domain Diagnostics {
  version: "1.0.0"

  type MinimalCounterexample = String
  type UnsatAnalysis = String
  type UnknownReason = String
  type DiagnosticReport = String

  invariants exports_present {
    - true
  }
}
