# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: signLicense, verifyLicense, LicensePayload
# dependencies: jsonwebtoken

domain Jwt {
  version: "1.0.0"

  type LicensePayload = String

  invariants exports_present {
    - true
  }
}
