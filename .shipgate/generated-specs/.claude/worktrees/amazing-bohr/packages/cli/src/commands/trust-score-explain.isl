# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: trustScoreExplain, printTrustScoreExplain, TrustScoreExplainOptions, TrustScoreExplainResult
# dependencies: fs/promises, fs, chalk, @isl-lang/gate/trust-score, path

domain TrustScoreExplain {
  version: "1.0.0"

  type TrustScoreExplainOptions = String
  type TrustScoreExplainResult = String

  invariants exports_present {
    - true
  }
}
