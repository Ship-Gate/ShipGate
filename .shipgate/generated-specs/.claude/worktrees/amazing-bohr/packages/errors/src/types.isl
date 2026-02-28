# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_FORMAT_OPTIONS, SourceLocation, Position, DiagnosticSeverity, RelatedInformation, CodeFix, TextEdit, ErrorCategory, Diagnostic, DiagnosticTag, ErrorExplanation, SourceFile, FormatOptions, DiagnosticResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type SourceLocation = String
  type Position = String
  type DiagnosticSeverity = String
  type RelatedInformation = String
  type CodeFix = String
  type TextEdit = String
  type ErrorCategory = String
  type Diagnostic = String
  type DiagnosticTag = String
  type ErrorExplanation = String
  type SourceFile = String
  type FormatOptions = String
  type DiagnosticResult = String

  invariants exports_present {
    - true
  }
}
