# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyCert, printVerifyCertResult, getVerifyCertExitCode, VerifyCertOptions, VerifyCertResult
# dependencies: fs/promises, path, chalk, @isl-lang/isl-certificate

domain VerifyCert {
  version: "1.0.0"

  type VerifyCertOptions = String
  type VerifyCertResult = String

  invariants exports_present {
    - true
  }
}
