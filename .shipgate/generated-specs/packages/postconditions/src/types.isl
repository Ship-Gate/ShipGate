# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: EVIDENCE_PRIORITY, PostconditionStatus, EvidenceType, Evidence, SpecClause, ClauseResult, EvaluationInput, EvaluationResult, EvaluatorConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type PostconditionStatus = String
  type EvidenceType = String
  type Evidence = String
  type SpecClause = String
  type ClauseResult = String
  type EvaluationInput = String
  type EvaluationResult = String
  type EvaluatorConfig = String

  invariants exports_present {
    - true
  }
}
