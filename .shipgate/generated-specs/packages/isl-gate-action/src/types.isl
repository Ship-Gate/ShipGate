# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: VerificationMode, FailOnLevel, Verdict, FileStatus, FileMethod, ActionInputs, FileResult, VerifyResult, ShipGateConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type VerificationMode = String
  type FailOnLevel = String
  type Verdict = String
  type FileStatus = String
  type FileMethod = String
  type ActionInputs = String
  type FileResult = String
  type VerifyResult = String
  type ShipGateConfig = String

  invariants exports_present {
    - true
  }
}
