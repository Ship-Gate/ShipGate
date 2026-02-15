# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runDiff, formatDiffOutput, DiffResult
# dependencies: fs/promises, fs, path, chalk

domain Diff {
  version: "1.0.0"

  type DiffResult = String

  invariants exports_present {
    - true
  }
}
