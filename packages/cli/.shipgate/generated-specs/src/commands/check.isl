# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: check, printCheckResult, CheckOptions, ResolvedImportInfo, FileCheckResult, CheckResult
# dependencies: fs/promises, glob, path, chalk, ora, @isl-lang/parser, @isl-lang/observability, @isl-lang/semantic-analysis, @isl-lang/import-resolver

domain Check {
  version: "1.0.0"

  type CheckOptions = String
  type ResolvedImportInfo = String
  type FileCheckResult = String
  type CheckResult = String

  invariants exports_present {
    - true
  }
}
