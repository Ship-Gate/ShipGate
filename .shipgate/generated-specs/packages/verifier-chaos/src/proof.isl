# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: buildProofBundle, serialiseProofBundle, verifyProofIntegrity, ChaosProofBundle, ChaosProofVerdict, ChaosProofEvidence, ChaosProofAssertion, ChaosProofTimeline, ChaosProofCoverage
# dependencies: crypto

domain Proof {
  version: "1.0.0"

  type ChaosProofBundle = String
  type ChaosProofVerdict = String
  type ChaosProofEvidence = String
  type ChaosProofAssertion = String
  type ChaosProofTimeline = String
  type ChaosProofCoverage = String

  invariants exports_present {
    - true
  }
}
