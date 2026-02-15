# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: buildUnifiedClaimGraph, extractClaimsFromProofBundle, extractClaimsFromVerifierReport, mergeClaimCollections, ClauseResultInput, ClaimCollection
# dependencies: 

domain ClaimIntegration {
  version: "1.0.0"

  type ClauseResultInput = String
  type ClaimCollection = String

  invariants exports_present {
    - true
  }
}
