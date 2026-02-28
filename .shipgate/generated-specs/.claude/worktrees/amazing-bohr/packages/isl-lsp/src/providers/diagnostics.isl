# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DiagnosticCodes, DiagnosticProvider
# dependencies: vscode-languageserver/node.js, vscode-languageserver-textdocument

domain Diagnostics {
  version: "1.0.0"

  type DiagnosticProvider = String

  invariants exports_present {
    - true
  }
}
