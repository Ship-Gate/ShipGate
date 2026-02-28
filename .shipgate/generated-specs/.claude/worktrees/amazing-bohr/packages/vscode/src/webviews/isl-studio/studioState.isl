# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createInitialStudioState, calculateScoreFromClauses, getStatusColorClass, getClauseTypeLabel, GenerationMode, StudioStatus, SpecClause, StudioScore, StudioOpenQuestion, StudioAssumption, GeneratedSpec, StudioWebviewMessage, StudioExtensionMessage, StudioState
# dependencies: 

domain StudioState {
  version: "1.0.0"

  type GenerationMode = String
  type StudioStatus = String
  type SpecClause = String
  type StudioScore = String
  type StudioOpenQuestion = String
  type StudioAssumption = String
  type GeneratedSpec = String
  type StudioWebviewMessage = String
  type StudioExtensionMessage = String
  type StudioState = String

  invariants exports_present {
    - true
  }
}
