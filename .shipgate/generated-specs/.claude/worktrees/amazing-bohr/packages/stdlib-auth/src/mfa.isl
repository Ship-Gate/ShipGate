# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createMFAService, MFAStore, MFAService
# dependencies: otplib, uuid

domain Mfa {
  version: "1.0.0"

  type MFAStore = String
  type MFAService = String

  invariants exports_present {
    - true
  }
}
