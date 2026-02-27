# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createGateEvidence, computeScore, findCriticalFailures, hasCriticalFailure, produceVerdict, SCORING_THRESHOLDS, CRITICAL_FAILURES, ScoringThresholds, CriticalFailureKind, GateEvidenceSource, GateEvidence, VerdictDecision, GateVerdict, VerdictOptions
# dependencies: 

domain VerdictEngine {
  version: "1.0.0"

  type ScoringThresholds = String
  type CriticalFailureKind = String
  type GateEvidenceSource = String
  type GateEvidence = String
  type VerdictDecision = String
  type GateVerdict = String
  type VerdictOptions = String

  invariants exports_present {
    - true
  }
}
