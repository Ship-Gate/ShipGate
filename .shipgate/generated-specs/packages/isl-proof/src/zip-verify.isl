# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyZipBundle, extractZip, verifyEd25519Signature, ZipVerifyOptions, ZipVerifyResult
# dependencies: fs/promises, path, crypto

domain ZipVerify {
  version: "1.0.0"

  type ZipVerifyOptions = String
  type ZipVerifyResult = String

  invariants exports_present {
    - true
  }
}
