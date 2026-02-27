# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateJsonOutput, validateVerificationResult, formatValidationErrors, ClauseStatusSchema, ImpactLevelSchema, ClauseCategorySchema, RecommendationSchema, ClauseResultSchema, CategoryScoreSchema, CategoryBreakdownSchema, VerificationResultSchema, JsonOutputMetaSchema, JsonOutputSchema, ValidationResult, ClauseResultSchemaType, CategoryScoreSchemaType, CategoryBreakdownSchemaType, VerificationResultSchemaType, JsonOutputSchemaType
# dependencies: zod

domain Schema {
  version: "1.0.0"

  type ValidationResult = String
  type ClauseResultSchemaType = String
  type CategoryScoreSchemaType = String
  type CategoryBreakdownSchemaType = String
  type VerificationResultSchemaType = String
  type JsonOutputSchemaType = String

  invariants exports_present {
    - true
  }
}
