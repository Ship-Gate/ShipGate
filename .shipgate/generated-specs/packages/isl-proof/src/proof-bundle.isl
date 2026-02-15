# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyBundle, formatProofBundle, createProofBundle, ProofBundle, Evidence, TestEvidence, GateEvidence, GateViolation, ProofChainEntry, ProofBundleBuilder, VerificationResult
# dependencies: crypto

domain ProofBundle {
  version: "1.0.0"

  type ProofBundle = String
  type Evidence = String
  type TestEvidence = String
  type GateEvidence = String
  type GateViolation = String
  type ProofChainEntry = String
  type ProofBundleBuilder = String
  type VerificationResult = String

  invariants exports_present {
    - true
  }
}
