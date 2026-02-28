# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: collectEvidence, EvidenceBundle, EvidenceCollection, EvidenceSummary, EvidenceCollector
# dependencies: 

domain Evidence {
  version: "1.0.0"

  type EvidenceBundle = String
  type EvidenceCollection = String
  type EvidenceSummary = String
  type EvidenceCollector = String

  invariants exports_present {
    - true
  }
}
