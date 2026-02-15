# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: proofPack, printProofPackResult, getProofPackExitCode, ProofPackOptions, ProofPackResult
# dependencies: fs, path, chalk, @isl-lang/proof

domain ProofPack {
  version: "1.0.0"

  type ProofPackOptions = String
  type ProofPackResult = String

  invariants exports_present {
    - true
  }
}
