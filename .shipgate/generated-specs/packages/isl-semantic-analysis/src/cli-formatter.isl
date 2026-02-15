# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createFormatter, formatResult, formatSingleDiagnostic, OutputFormat, FormatterOptions, CLIFormatter
# dependencies: 

domain CliFormatter {
  version: "1.0.0"

  type OutputFormat = String
  type FormatterOptions = String
  type CLIFormatter = String

  invariants exports_present {
    - true
  }
}
