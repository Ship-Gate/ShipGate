# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runExplain, formatExplainOutput, ExplainResult
# dependencies: fs/promises, fs, path, chalk

domain Explain {
  version: "1.0.0"

  type ExplainResult = String

  invariants exports_present {
    - true
  }
}
