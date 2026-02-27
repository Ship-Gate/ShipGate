# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runHostScanCommand, runRealityGapScanCommand, formatScanResultForConsole, formatScanResultAsSarif, getScanExitCode, ScanType, ScanCommandOptions, ScanCommandResult
# dependencies: path

domain Scan {
  version: "1.0.0"

  type ScanType = String
  type ScanCommandOptions = String
  type ScanCommandResult = String

  invariants exports_present {
    - true
  }
}
