# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: scan, scanWithRules, quickScan, fullScan, scanSource, runCI, assertSecure, ScannerOptions, SecurityScanner, CIResult
# dependencies: 

domain Scanner {
  version: "1.0.0"

  type ScannerOptions = String
  type SecurityScanner = String
  type CIResult = String

  invariants exports_present {
    - true
  }
}
