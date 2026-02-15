# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_SCORING_WEIGHTS, DEFAULT_RETRIEVAL_OPTIONS, ISLTemplate, TemplateQuestion, RetrievalContext, StackInfo, UserPreferences, RetrieveTemplatesInput, SelectedTemplate, SelectionReason, ScoreBreakdown, RetrieveTemplatesOutput, RetrievalMetadata, ScoringWeights
# dependencies: 

domain RetrievalTypes {
  version: "1.0.0"

  type ISLTemplate = String
  type TemplateQuestion = String
  type RetrievalContext = String
  type StackInfo = String
  type UserPreferences = String
  type RetrieveTemplatesInput = String
  type SelectedTemplate = String
  type SelectionReason = String
  type ScoreBreakdown = String
  type RetrieveTemplatesOutput = String
  type RetrievalMetadata = String
  type ScoringWeights = String

  invariants exports_present {
    - true
  }
}
