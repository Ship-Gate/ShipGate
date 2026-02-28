# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateViolationFingerprint, loadBaseline, saveBaseline, isInBaseline, filterNewViolations, BaselineEntry, Baseline
# dependencies: fs/promises, path, crypto

domain Baseline {
  version: "1.0.0"

  type BaselineEntry = String
  type Baseline = String

  invariants exports_present {
    - true
  }
}
