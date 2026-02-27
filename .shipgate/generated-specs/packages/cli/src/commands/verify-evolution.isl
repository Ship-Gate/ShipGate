# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyEvolution, printEvolutionResult, getEvolutionExitCode, EvolutionVerifyOptions, EvolutionVerifyResult
# dependencies: fs/promises, path, chalk, @isl-lang/parser, @isl-lang/api-versioning, @isl-lang/schema-evolution

domain VerifyEvolution {
  version: "1.0.0"

  type EvolutionVerifyOptions = String
  type EvolutionVerifyResult = String

  invariants exports_present {
    - true
  }
}
