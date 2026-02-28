# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runHostScanCommand, runRealityGapScanCommand, formatScanResultForConsole, formatScanResultAsSarif, getScanExitCode, runProjectScan, formatProjectScanResult, ScanType, ScanCommandOptions, ScanCommandResult, ProjectScanOptions, ProjectScanResult
# dependencies: path, fs/promises

domain Scan {
  version: "1.0.0"

  type ScanType = String
  type ScanCommandOptions = String
  type ScanCommandResult = String
  type ProjectScanOptions = String
  type ProjectScanResult = String

  invariants exports_present {
    - true
  }
}
