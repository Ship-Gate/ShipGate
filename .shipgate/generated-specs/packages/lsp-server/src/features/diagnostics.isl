# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DiagnosticsResult, DiagnosticsOptions, ISLDiagnosticsProvider
# dependencies: vscode-languageserver

domain Diagnostics {
  version: "1.0.0"

  type DiagnosticsResult = String
  type DiagnosticsOptions = String
  type ISLDiagnosticsProvider = String

  invariants exports_present {
    - true
  }
}
