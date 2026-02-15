# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: importOpenAPI, printImportOpenAPIResult, getImportOpenAPIExitCode, ImportOpenAPIOptions, ImportOpenAPIResult
# dependencies: fs/promises, path, chalk, ora, yaml

domain ImportOpenapi {
  version: "1.0.0"

  type ImportOpenAPIOptions = String
  type ImportOpenAPIResult = String

  invariants exports_present {
    - true
  }
}
