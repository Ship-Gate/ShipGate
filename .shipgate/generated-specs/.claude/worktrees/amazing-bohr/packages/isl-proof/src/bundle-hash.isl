# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: bundleHash, createBundle, verifyBundle, serializeBundle, parseBundle, ClaimStatus, BundleVerdict, BundleClaim, BundleVerdictArtifact, BundleTraceRef, BundleEvidence, ProofBundleV1, SOC2ControlEntry, CreateBundleInput, VerifyBundleCheck, VerifyBundleResult
# dependencies: crypto

domain BundleHash {
  version: "1.0.0"

  type ClaimStatus = String
  type BundleVerdict = String
  type BundleClaim = String
  type BundleVerdictArtifact = String
  type BundleTraceRef = String
  type BundleEvidence = String
  type ProofBundleV1 = String
  type SOC2ControlEntry = String
  type CreateBundleInput = String
  type VerifyBundleCheck = String
  type VerifyBundleResult = String

  invariants exports_present {
    - true
  }
}
