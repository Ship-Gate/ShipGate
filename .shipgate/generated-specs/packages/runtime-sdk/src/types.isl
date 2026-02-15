# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ViolationType, Violation, VerificationResult, ExecutionContext, VerificationMode, VerificationOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type ViolationType = String
  type Violation = String
  type VerificationResult = String
  type ExecutionContext = String
  type VerificationMode = String
  type VerificationOptions = String

  invariants exports_present {
    - true
  }
}
