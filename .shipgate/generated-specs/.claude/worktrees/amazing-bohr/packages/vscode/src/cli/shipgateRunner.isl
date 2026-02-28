# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: resolveShipgateExecutable, runShipgateScan, RunScanOptions, RunScanOutput
# dependencies: child_process, fs, path

domain ShipgateRunner {
  version: "1.0.0"

  type RunScanOptions = String
  type RunScanOutput = String

  invariants exports_present {
    - true
  }
}
