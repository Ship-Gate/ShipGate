# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: diffOpenAPI, printDiffOpenAPIResult, getDiffOpenAPIExitCode, DiffOpenAPIOptions, DiffOpenAPIResult, DiffChange
# dependencies: fs/promises, path, chalk, ora, yaml

domain DiffOpenapi {
  version: "1.0.0"

  type DiffOpenAPIOptions = String
  type DiffOpenAPIResult = String
  type DiffChange = String

  invariants exports_present {
    - true
  }
}
