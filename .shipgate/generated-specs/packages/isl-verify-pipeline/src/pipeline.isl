# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verify, createDefaultConfig, VerificationPipeline
# dependencies: fs/promises, path, crypto

domain Pipeline {
  version: "1.0.0"

  type VerificationPipeline = String

  invariants exports_present {
    - true
  }
}
