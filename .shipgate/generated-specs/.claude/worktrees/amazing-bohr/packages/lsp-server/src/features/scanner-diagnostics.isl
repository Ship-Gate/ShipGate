# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ScannerDiagnosticsOptions, ScannerDiagnosticsProvider, SOURCE_HOST, SOURCE_REALITY_GAP
# dependencies: vscode-languageserver, @isl-lang/firewall

domain ScannerDiagnostics {
  version: "1.0.0"

  type ScannerDiagnosticsOptions = String
  type ScannerDiagnosticsProvider = String

  invariants exports_present {
    - true
  }
}
