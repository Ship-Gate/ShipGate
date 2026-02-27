# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generate, printGenerateResult, GenerateOptions, GeneratedFile, GenerateResult
# dependencies: fs/promises, glob, path, ora, @isl-lang/parser, vitest

domain Generate {
  version: "1.0.0"

  type GenerateOptions = String
  type GeneratedFile = String
  type GenerateResult = String

  invariants exports_present {
    - true
  }
}
