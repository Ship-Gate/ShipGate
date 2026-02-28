# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyBundle, VerifyBundleOptions
# dependencies: node:fs

domain VerifyBundle {
  version: "1.0.0"

  type VerifyBundleOptions = String

  invariants exports_present {
    - true
  }
}
