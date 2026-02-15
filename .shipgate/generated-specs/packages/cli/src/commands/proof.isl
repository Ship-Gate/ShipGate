# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyProof, printProofVerifyResult, getProofVerifyExitCode, ProofVerifyCommandOptions, ProofVerifyResult
# dependencies: fs, path, chalk, @isl-lang/proof

domain Proof {
  version: "1.0.0"

  type ProofVerifyCommandOptions = String
  type ProofVerifyResult = String

  invariants exports_present {
    - true
  }
}
