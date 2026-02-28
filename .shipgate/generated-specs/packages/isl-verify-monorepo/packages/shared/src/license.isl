# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: LicenseValidator
# dependencies: jsonwebtoken

domain License {
  version: "1.0.0"

  type LicenseValidator = String

  invariants exports_present {
    - true
  }
}
