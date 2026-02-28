# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyProofBundle, formatVerificationResult, isValidBundle, isProvenEnough, VerificationSeverity, VerificationIssue, VerificationResult, VerifyOptions
# dependencies: fs/promises, path

domain Verifier {
  version: "1.0.0"

  type VerificationSeverity = String
  type VerificationIssue = String
  type VerificationResult = String
  type VerifyOptions = String

  invariants exports_present {
    - true
  }
}
