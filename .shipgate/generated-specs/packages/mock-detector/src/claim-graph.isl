# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: buildClaimGraph, addToClaimGraph, getClaimGraphSummary, ClaimGraphNode, ClaimGraphEdge, ClaimGraph
# dependencies: 

domain ClaimGraph {
  version: "1.0.0"

  type ClaimGraphNode = String
  type ClaimGraphEdge = String
  type ClaimGraph = String

  invariants exports_present {
    - true
  }
}
