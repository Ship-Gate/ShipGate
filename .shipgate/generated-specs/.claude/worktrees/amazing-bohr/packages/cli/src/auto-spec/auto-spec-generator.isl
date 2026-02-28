# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: fn, generateUtilitySpec, isUtilityFile, X, ExtractedExport, ExtractedDependency, AutoSpecResult, a, b, c
# dependencies: fs/promises, path, Y

domain AutoSpecGenerator {
  version: "1.0.0"

  type ExtractedExport = String
  type ExtractedDependency = String
  type AutoSpecResult = String

  invariants exports_present {
    - true
  }
}
