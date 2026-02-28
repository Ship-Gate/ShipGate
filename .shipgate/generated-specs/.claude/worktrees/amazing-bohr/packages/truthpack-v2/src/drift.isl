# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: detectDrift, loadTruthpackFromDir, DriftChange, DriftReport
# dependencies: fs/promises, path

domain Drift {
  version: "1.0.0"

  type DriftChange = String
  type DriftReport = String

  invariants exports_present {
    - true
  }
}
