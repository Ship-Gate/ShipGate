# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyContract, verifyProvider, VerificationOptions, VerificationResult, BehaviorVerificationResult, FieldVerificationResult, TypeMismatch, ConditionVerificationResult, VerificationError, VerificationWarning, ContractVerifier
# dependencies: @isl-lang/isl-core

domain Verifier {
  version: "1.0.0"

  type VerificationOptions = String
  type VerificationResult = String
  type BehaviorVerificationResult = String
  type FieldVerificationResult = String
  type TypeMismatch = String
  type ConditionVerificationResult = String
  type VerificationError = String
  type VerificationWarning = String
  type ContractVerifier = String

  invariants exports_present {
    - true
  }
}
