# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: FindingSeverity, Finding, ScanReport, IslVerifyConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type FindingSeverity = String
  type Finding = String
  type ScanReport = String
  type IslVerifyConfig = String

  invariants exports_present {
    - true
  }
}
