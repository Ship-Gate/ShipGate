# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: lint, printLintResult, getLintExitCode, LintOptions, LintIssue, LintFix, LintEdit, LintResult
# dependencies: fs/promises, path, chalk, ora, @isl-lang/parser, @isl-lang/semantic-analysis, ${symbolName}

domain Lint {
  version: "1.0.0"

  type LintOptions = String
  type LintIssue = String
  type LintFix = String
  type LintEdit = String
  type LintResult = String

  invariants exports_present {
    - true
  }
}
