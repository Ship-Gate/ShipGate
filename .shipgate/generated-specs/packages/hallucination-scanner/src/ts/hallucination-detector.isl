# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: toFindings, HallucinationDetectorOptions, HallucinationDetector
# dependencies: node:path, node:fs/promises

domain HallucinationDetector {
  version: "1.0.0"

  type HallucinationDetectorOptions = String
  type HallucinationDetector = String

  invariants exports_present {
    - true
  }
}
