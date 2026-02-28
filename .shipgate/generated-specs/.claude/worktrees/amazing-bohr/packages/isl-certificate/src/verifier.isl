# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyCertificate, VerificationResult
# dependencies: node:fs/promises, node:path

domain Verifier {
  version: "1.0.0"

  type VerificationResult = String

  invariants exports_present {
    - true
  }
}
