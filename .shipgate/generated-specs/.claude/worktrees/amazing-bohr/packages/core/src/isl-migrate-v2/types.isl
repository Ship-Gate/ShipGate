# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createLocation, generateQuestionId, DEFAULT_CONFIG, PRIMITIVE_MAP, SourceType, MigrationSource, QuestionCategory, QuestionPriority, OpenQuestion, ExtractedType, ExtractedProperty, TypeConstraints, ExtractedOperation, ExtractedError, MigrationStats, MigrationResult, MigrationConfig, SourceAdapter, ISLPrimitive
# dependencies: 

domain Types {
  version: "1.0.0"

  type SourceType = String
  type MigrationSource = String
  type QuestionCategory = String
  type QuestionPriority = String
  type OpenQuestion = String
  type ExtractedType = String
  type ExtractedProperty = String
  type TypeConstraints = String
  type ExtractedOperation = String
  type ExtractedError = String
  type MigrationStats = String
  type MigrationResult = String
  type MigrationConfig = String
  type SourceAdapter = String
  type ISLPrimitive = String

  invariants exports_present {
    - true
  }
}
