# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyGeneratedTests, VerificationOptions, VerificationResult
# dependencies: fs, path, child_process

domain ExecutionVerifier {
  version: "1.0.0"

  type VerificationOptions = String
  type VerificationResult = String

  invariants exports_present {
    - true
  }
}
