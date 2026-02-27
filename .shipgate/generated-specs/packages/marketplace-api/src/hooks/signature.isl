# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: computeDigest, verifyDetachedSignature, processSignature, SignatureInput, SignatureResult
# dependencies: node:crypto

domain Signature {
  version: "1.0.0"

  type SignatureInput = String
  type SignatureResult = String

  invariants exports_present {
    - true
  }
}
