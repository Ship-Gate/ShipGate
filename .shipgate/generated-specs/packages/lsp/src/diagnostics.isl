# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getDiagnostics, getRules, DiagnosticRule
# dependencies: vscode-languageserver

domain Diagnostics {
  version: "1.0.0"

  type DiagnosticRule = String

  invariants exports_present {
    - true
  }
}
