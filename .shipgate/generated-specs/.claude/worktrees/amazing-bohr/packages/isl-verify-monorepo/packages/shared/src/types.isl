# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Tier, LicenseKey, LicenseValidation, StoredLicense
# dependencies: 

domain Types {
  version: "1.0.0"

  type Tier = String
  type LicenseKey = String
  type LicenseValidation = String
  type StoredLicense = String

  invariants exports_present {
    - true
  }
}
