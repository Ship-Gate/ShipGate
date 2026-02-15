# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyProof, formatVerificationResult, ProofVerifyOptions, ProofVerifyResult, ProofVerifyCheck, FailClosedSummary
# dependencies: fs/promises, path, @isl-lang/parser

domain ProofVerify {
  version: "1.0.0"

  type ProofVerifyOptions = String
  type ProofVerifyResult = String
  type ProofVerifyCheck = String
  type FailClosedSummary = String

  invariants exports_present {
    - true
  }
}
