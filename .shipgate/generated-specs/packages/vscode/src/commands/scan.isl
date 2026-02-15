# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: registerScanCommands, ScanState, ScanStatusBarCallbacks
# dependencies: vscode

domain Scan {
  version: "1.0.0"

  type ScanState = String
  type ScanStatusBarCallbacks = String

  invariants exports_present {
    - true
  }
}
