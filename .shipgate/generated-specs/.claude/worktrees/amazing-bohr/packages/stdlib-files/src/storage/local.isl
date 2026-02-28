# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: LocalStorageConfig, LocalStorageAdapter
# dependencies: fs, path, stream/promises, crypto, stream

domain Local {
  version: "1.0.0"

  type LocalStorageConfig = String
  type LocalStorageAdapter = String

  invariants exports_present {
    - true
  }
}
