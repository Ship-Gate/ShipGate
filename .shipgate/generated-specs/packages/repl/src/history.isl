# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: History, MemoryHistory
# dependencies: fs, path, os

domain History {
  version: "1.0.0"

  type History = String
  type MemoryHistory = String

  invariants exports_present {
    - true
  }
}
