# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_VERIFIED_INTENT_CONFIG, DEV_VERIFIED_INTENT_CONFIG, PillarStatus, PillarName, ProvenanceOrigin, ExecutionStatus, ProvenanceRecord, ProvenanceReport, PillarResult, PillarDetail, VerifiedIntentResult, MissingPillarPolicy, VerifiedIntentConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type PillarStatus = String
  type PillarName = String
  type ProvenanceOrigin = String
  type ExecutionStatus = String
  type ProvenanceRecord = String
  type ProvenanceReport = String
  type PillarResult = String
  type PillarDetail = String
  type VerifiedIntentResult = String
  type MissingPillarPolicy = String
  type VerifiedIntentConfig = String

  invariants exports_present {
    - true
  }
}
