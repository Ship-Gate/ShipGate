# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: scaffold, ScaffoldOptions, ScaffoldResult
# dependencies: fs/promises, path, @isl-lang/generator-sdk, vitest, @isl-lang/isl-core

domain Scaffold {
  version: "1.0.0"

  type ScaffoldOptions = String
  type ScaffoldResult = String

  invariants exports_present {
    - true
  }
}
