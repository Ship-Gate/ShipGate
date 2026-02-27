# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: EvidenceManifest, EvidenceResults, EvidenceBundle, EvidenceOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type EvidenceManifest = String
  type EvidenceResults = String
  type EvidenceBundle = String
  type EvidenceOptions = String

  invariants exports_present {
    - true
  }
}
