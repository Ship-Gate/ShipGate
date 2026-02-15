# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: writeToProofBundle, generateVerificationResult, updateManifest, readVerificationResults, readEvaluationTable, ProofBundleIntegrationConfig, PostconditionVerificationResult
# dependencies: fs/promises, path, @isl-lang/proof

domain ProofBundleIntegration {
  version: "1.0.0"

  type ProofBundleIntegrationConfig = String
  type PostconditionVerificationResult = String

  invariants exports_present {
    - true
  }
}
