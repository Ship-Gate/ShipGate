# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runScan, ScanOptions
# dependencies: fs/promises, fs, path, @isl-lang/spec-inference, @isl-lang/spec-implementation-verifier, @isl-lang/firewall, glob

domain Scan {
  version: "1.0.0"

  type ScanOptions = String

  invariants exports_present {
    - true
  }
}
