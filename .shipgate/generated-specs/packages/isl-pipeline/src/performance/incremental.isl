# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseIncremental, gateIncremental, FileHash, IncrementalState, IncrementalResult, IncrementalProcessor
# dependencies: fs/promises, path, crypto, @isl-lang/isl-core

domain Incremental {
  version: "1.0.0"

  type FileHash = String
  type IncrementalState = String
  type IncrementalResult = String
  type IncrementalProcessor = String

  invariants exports_present {
    - true
  }
}
