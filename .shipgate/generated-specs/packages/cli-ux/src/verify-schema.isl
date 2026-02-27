# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateVerifyJsonOutput, validateVerifyResult, formatVerifyValidationErrors, ClauseVerdictSchema, OverallVerdictSchema, VerifyClauseTypeSchema, TraceSliceRefSchema, AdapterSnapshotRefSchema, NoEvidenceRefSchema, EvidenceRefSchema, UnknownReasonCodeSchema, UnknownReasonSchema, SourceLocationSchema, VerifyClauseResultSchema, VerifySummarySchema, VerifyResultSchema, VerifyJsonOutputMetaSchema, VerifyJsonOutputSchema, VerifyValidationResult, ClauseVerdictSchemaType, OverallVerdictSchemaType, EvidenceRefSchemaType, VerifyClauseResultSchemaType, VerifySummarySchemaType, VerifyResultSchemaType, VerifyJsonOutputSchemaType
# dependencies: zod

domain VerifySchema {
  version: "1.0.0"

  type VerifyValidationResult = String
  type ClauseVerdictSchemaType = String
  type OverallVerdictSchemaType = String
  type EvidenceRefSchemaType = String
  type VerifyClauseResultSchemaType = String
  type VerifySummarySchemaType = String
  type VerifyResultSchemaType = String
  type VerifyJsonOutputSchemaType = String

  invariants exports_present {
    - true
  }
}
