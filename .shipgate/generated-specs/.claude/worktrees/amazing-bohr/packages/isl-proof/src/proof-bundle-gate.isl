# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: stableSortResults, mapClauseStatusToResultStatus, mapSeverity, createProofBundleGate, proofBundleGateHash, createProofBundleGateWithHash, serializeProofBundleGate, formatProofBundleGateMarkdown, signProofBundleGateEd25519, writeProofBundleGate, verifyProofBundleGateEd25519, PROOF_BUNDLE_GATE_SCHEMA_VERSION, ProofBundleGateResultStatus, ProofBundleGateSeverity, ProofBundleGateResult, ProofBundleGate, CreateProofBundleGateInput, ProofBundleGateSignature
# dependencies: crypto

domain ProofBundleGate {
  version: "1.0.0"

  type ProofBundleGateResultStatus = String
  type ProofBundleGateSeverity = String
  type ProofBundleGateResult = String
  type ProofBundleGate = String
  type CreateProofBundleGateInput = String
  type ProofBundleGateSignature = String

  invariants exports_present {
    - true
  }
}
