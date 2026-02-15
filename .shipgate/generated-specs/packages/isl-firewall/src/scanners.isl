# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runHostScan, runRealityGapScan, ScannerViolation, HostScanResult, RealityGapScanResult, ScanResult, ScannerOptions
# dependencies: fs, path

domain Scanners {
  version: "1.0.0"

  type ScannerViolation = String
  type HostScanResult = String
  type RealityGapScanResult = String
  type ScanResult = String
  type ScannerOptions = String

  invariants exports_present {
    - true
  }
}
