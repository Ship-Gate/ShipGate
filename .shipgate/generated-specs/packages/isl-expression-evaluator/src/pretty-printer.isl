# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: registerSource, clearSourceCache, getSourceLines, formatDiagnostic, formatDiagnostics, prettyPrintExpression, highlightFailingSubExpression, diagnosticToLine, diagnosticToJson, PrettyPrintOptions
# dependencies: 

domain PrettyPrinter {
  version: "1.0.0"

  type PrettyPrintOptions = String

  invariants exports_present {
    - true
  }
}
