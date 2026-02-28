# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: activate, createDiagnosticsProvider, isParserAvailable, ISL_DIAGNOSTIC_SOURCE, ParsedDiagnostic, LintWarning, ISLDiagnosticsProvider
# dependencies: vscode

domain Diagnostics {
  version: "1.0.0"

  type ParsedDiagnostic = String
  type LintWarning = String
  type ISLDiagnosticsProvider = String

  invariants exports_present {
    - true
  }
}
