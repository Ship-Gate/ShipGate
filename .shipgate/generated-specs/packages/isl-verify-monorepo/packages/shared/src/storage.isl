# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: LicenseStorage
# dependencies: fs, path, os

domain Storage {
  version: "1.0.0"

  type LicenseStorage = String

  invariants exports_present {
    - true
  }
}
