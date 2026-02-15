# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generate, printGenerateResult, GenerateOptions, GenerateResult
# dependencies: fs/promises, path, chalk, ora, @isl-lang/isl-core, @isl-lang/isl-ai

domain Generate {
  version: "1.0.0"

  type GenerateOptions = String
  type GenerateResult = String

  invariants exports_present {
    - true
  }
}
