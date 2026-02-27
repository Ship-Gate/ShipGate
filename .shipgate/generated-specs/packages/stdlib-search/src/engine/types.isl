# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: EngineConfig, IndexState, QueryContext, DocumentVector, TermVector, SearchMetrics
# dependencies: 

domain Types {
  version: "1.0.0"

  type EngineConfig = String
  type IndexState = String
  type QueryContext = String
  type DocumentVector = String
  type TermVector = String
  type SearchMetrics = String

  invariants exports_present {
    - true
  }
}
