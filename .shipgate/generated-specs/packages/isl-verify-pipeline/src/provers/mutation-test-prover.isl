# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: MutationTestThoroughness, MutationTestConfig, MutationEvidence, MutationProof, MutationTestResult, MutationTestProver
# dependencies: fs, path, @isl-lang/mutation-testing

domain MutationTestProver {
  version: "1.0.0"

  type MutationTestThoroughness = String
  type MutationTestConfig = String
  type MutationEvidence = String
  type MutationProof = String
  type MutationTestResult = String
  type MutationTestProver = String

  invariants exports_present {
    - true
  }
}
