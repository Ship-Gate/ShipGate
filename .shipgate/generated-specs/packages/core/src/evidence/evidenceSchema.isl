# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ClauseStateSchema, ArtifactTypeSchema, EvidenceArtifactSchema, AssumptionCategorySchema, ImpactLevelSchema, AssumptionSchema, PriorityLevelSchema, OpenQuestionSchema, ConfidenceLevelSchema, RecommendationSchema, ScoreSummarySchema, VerificationModeSchema, VerificationMetadataSchema, ClauseTypeSchema, EvidenceClauseResultSchema, EvidenceReportSchema, EvidenceReportFromSchema, EvidenceClauseResultFromSchema, ScoreSummaryFromSchema, AssumptionFromSchema, OpenQuestionFromSchema, EvidenceArtifactFromSchema, VerificationMetadataFromSchema
# dependencies: zod

domain EvidenceSchema {
  version: "1.0.0"

  type EvidenceReportFromSchema = String
  type EvidenceClauseResultFromSchema = String
  type ScoreSummaryFromSchema = String
  type AssumptionFromSchema = String
  type OpenQuestionFromSchema = String
  type EvidenceArtifactFromSchema = String
  type VerificationMetadataFromSchema = String

  invariants exports_present {
    - true
  }
}
