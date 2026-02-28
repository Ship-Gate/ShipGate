# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isJsonOutput, isQuietOutput, configureOutput, json, outputResult, resetOutput, debug, info, warn, error, success, header, section, listItem, numberedItem, keyValue, filePath, progressBar, score, badge, table, diagnostic, diagnostics, prettyDiagnostic, prettyDiagnostics, box, output, LogLevel, OutputFormat, OutputConfig, TableColumn, DiagnosticError
# dependencies: chalk, @isl-lang/secrets-hygiene

domain Output {
  version: "1.0.0"

  type LogLevel = String
  type OutputFormat = String
  type OutputConfig = String
  type TableColumn = String
  type DiagnosticError = String

  invariants exports_present {
    - true
  }
}
