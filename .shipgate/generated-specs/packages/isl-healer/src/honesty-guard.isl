# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: assertCleanPatch, assertCleanDiff, createPreCommitValidator, createHealerPatchValidator, DEFAULT_HONESTY_CONFIG, HonestyGuard, inspectPatchSet, parseDiff, quickScan, isISLSpecFile, isConfigFile
# dependencies: 

domain HonestyGuard {
  version: "1.0.0"

  type HonestyGuard = String

  invariants exports_present {
    - true
  }
}
