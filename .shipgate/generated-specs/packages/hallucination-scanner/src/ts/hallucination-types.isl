# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: HallucinationSeverity, HallucinationCategory, HallucinationFinding, HallucinationScanResult, Finding
# dependencies: 

domain HallucinationTypes {
  version: "1.0.0"

  type HallucinationSeverity = String
  type HallucinationCategory = String
  type HallucinationFinding = String
  type HallucinationScanResult = String
  type Finding = String

  invariants exports_present {
    - true
  }
}
