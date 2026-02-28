# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getLicenseStatus, incrementScanUsage, syncStripeStatus, LicenseStatus, ScanLimitError
# dependencies: 

domain License {
  version: "1.0.0"

  type LicenseStatus = String
  type ScanLimitError = String

  invariants exports_present {
    - true
  }
}
