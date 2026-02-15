# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: hashEvent, verifyEventHash, verifyEventChain, buildMerkleTree, getMerkleProof, verifyMerkleProof, ChainVerificationResult, ChainError, MerkleTree, MerkleProof, ProofNode
# dependencies: crypto

domain Hashing {
  version: "1.0.0"

  type ChainVerificationResult = String
  type ChainError = String
  type MerkleTree = String
  type MerkleProof = String
  type ProofNode = String

  invariants exports_present {
    - true
  }
}
