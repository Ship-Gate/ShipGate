# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: formatForISLVerify, assertTestsExecuted, createFixtureStoreAdapter, createVitestAdapter, FixtureSnapshot, VerificationResult, VerificationEvidence, CheckEvidence, ProofBundle, FixtureStoreAdapter, VitestAdapterConfig, VitestAdapter, ISLVerifyInput, ISLVerifyOutput
# dependencies: 

domain FixtureAdapter {
  version: "1.0.0"

  type FixtureSnapshot = String
  type VerificationResult = String
  type VerificationEvidence = String
  type CheckEvidence = String
  type ProofBundle = String
  type FixtureStoreAdapter = String
  type VitestAdapterConfig = String
  type VitestAdapter = String
  type ISLVerifyInput = String
  type ISLVerifyOutput = String

  invariants exports_present {
    - true
  }
}
