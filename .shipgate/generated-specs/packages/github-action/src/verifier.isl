# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getVerdictEmoji, getVerdictDescription, Verdict, VerificationResult, CoverageMetrics, ISLVerifier
# dependencies: @actions/core, @actions/exec, @actions/artifact, path, fs/promises

domain Verifier {
  version: "1.0.0"

  type Verdict = String
  type VerificationResult = String
  type CoverageMetrics = String
  type ISLVerifier = String

  invariants exports_present {
    - true
  }
}
