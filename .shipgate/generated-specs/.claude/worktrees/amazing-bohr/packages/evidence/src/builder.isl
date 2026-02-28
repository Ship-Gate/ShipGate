# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createReport, createClause, createEvidence, addClause, addAssumption, addOpenQuestion, addReproCommand, finalizeReport, CreateReportOptions, CreateClauseOptions, CreateEvidenceOptions
# dependencies: 

domain Builder {
  version: "1.0.0"

  type CreateReportOptions = String
  type CreateClauseOptions = String
  type CreateEvidenceOptions = String

  invariants exports_present {
    - true
  }
}
