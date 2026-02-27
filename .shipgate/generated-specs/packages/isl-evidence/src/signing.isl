# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: computeHash, deterministicSerialize, createSignature, verifySignature, createFingerprint, verifyFingerprint, EvidenceSignature
# dependencies: crypto

domain Signing {
  version: "1.0.0"

  type EvidenceSignature = String

  invariants exports_present {
    - true
  }
}
