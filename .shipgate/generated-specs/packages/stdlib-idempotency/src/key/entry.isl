# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: KeyEntry
# dependencies: crypto

domain Entry {
  version: "1.0.0"

  type KeyEntry = String

  invariants exports_present {
    - true
  }
}
