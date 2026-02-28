# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createClaimGraphBuilder, buildClaimGraph, ClaimKind, ClaimStatus, ClaimSubject, ClaimLocation, ClaimEvidence, ClaimRelationship, UnifiedClaim, ClaimGraph, GraphBuilderOptions, ClaimGraphBuilder
# dependencies: crypto

domain ClaimGraph {
  version: "1.0.0"

  type ClaimKind = String
  type ClaimStatus = String
  type ClaimSubject = String
  type ClaimLocation = String
  type ClaimEvidence = String
  type ClaimRelationship = String
  type UnifiedClaim = String
  type ClaimGraph = String
  type GraphBuilderOptions = String
  type ClaimGraphBuilder = String

  invariants exports_present {
    - true
  }
}
