# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createErrorMessage, formatLocation, unexpectedToken, expectedToken, missingClosingDelimiter, duplicateDefinition, unclosedBlock, unknownKeyword, ErrorCode, SYNC_TOKENS, SECONDARY_SYNC_TOKENS, DiagnosticSeverity, DiagnosticTag, RelatedInformation, CodeFix, TextEdit, Position, Diagnostic, ErrorCodeType, ParseError, ErrorCollector
# dependencies: 

domain Errors {
  version: "1.0.0"

  type DiagnosticSeverity = String
  type DiagnosticTag = String
  type RelatedInformation = String
  type CodeFix = String
  type TextEdit = String
  type Position = String
  type Diagnostic = String
  type ErrorCodeType = String
  type ParseError = String
  type ErrorCollector = String

  invariants exports_present {
    - true
  }
}
