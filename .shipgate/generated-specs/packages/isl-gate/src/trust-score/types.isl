# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TRUST_CATEGORIES, EVIDENCE_PRIORITY, DEFAULT_WEIGHTS, TrustCategory, ClauseStatus, EvidenceSource, TrustClauseResult, TrustScoreInput, TrustWeights, TrustScoreConfig, ResolvedTrustConfig, CategoryScore, TrustVerdict, TrustScoreResult, TrustHistoryEntry, TrustDelta, TrustHistory, TrustReport, TrustReportJSON
# dependencies: 

domain Types {
  version: "1.0.0"

  type TrustCategory = String
  type ClauseStatus = String
  type EvidenceSource = String
  type TrustClauseResult = String
  type TrustScoreInput = String
  type TrustWeights = String
  type TrustScoreConfig = String
  type ResolvedTrustConfig = String
  type CategoryScore = String
  type TrustVerdict = String
  type TrustScoreResult = String
  type TrustHistoryEntry = String
  type TrustDelta = String
  type TrustHistory = String
  type TrustReport = String
  type TrustReportJSON = String

  invariants exports_present {
    - true
  }
}
