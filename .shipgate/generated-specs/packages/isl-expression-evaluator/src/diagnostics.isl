# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: sourceLocationToSpan, diagnostic, unsupportedOperator, unknownIdentifier, typeMismatch, nullAccess, oldWithoutSnapshot, maxDepthExceeded, unknownMethod, unknownProperty, notIterable, indexOutOfBounds, divisionByZero, getAllDiagnosticCodes, getDiagnosticCode, getDiagnosticByCatalogCode, EvaluatorDiagnosticCode, EvaluatorDiagnosticCodeKey, EvaluatorDiagnosticCodeId, DiagnosticSpan, DiagnosticSeverity, EvaluatorDiagnostic, DiagnosticBuilder
# dependencies: 

domain Diagnostics {
  version: "1.0.0"

  type EvaluatorDiagnosticCodeKey = String
  type EvaluatorDiagnosticCodeId = String
  type DiagnosticSpan = String
  type DiagnosticSeverity = String
  type EvaluatorDiagnostic = String
  type DiagnosticBuilder = String

  invariants exports_present {
    - true
  }
}
