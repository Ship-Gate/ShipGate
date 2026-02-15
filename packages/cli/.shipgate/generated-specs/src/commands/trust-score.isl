# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: trustScore, printTrustScoreResult, printTrustScoreHistory, getTrustScoreExitCode, TrustScoreOptions, TrustScoreCommandResult
# dependencies: fs/promises, fs, path, chalk

domain TrustScore {
  version: "1.0.0"

  type TrustScoreOptions = String
  type TrustScoreCommandResult = String

  invariants exports_present {
    - true
  }
}
