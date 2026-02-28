# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: gen, printGenResult, getGenExitCode, GenerationTarget, GenOptions, GeneratedFile, GenResult, VALID_TARGETS
# dependencies: fs/promises, path, chalk, ora, @isl-lang/parser, @isl-lang/observability

domain Gen {
  version: "1.0.0"

  type GenerationTarget = String
  type GenOptions = String
  type GeneratedFile = String
  type GenResult = String

  invariants exports_present {
    - true
  }
}
