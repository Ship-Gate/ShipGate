# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: heal, aiHeal, printHealResult, getHealExitCode, VerificationFailureInput, HealOptions, HealResult
# dependencies: fs/promises, fs, path, glob, chalk, ora, @isl-lang/parser, @isl-lang/pipeline

domain Heal {
  version: "1.0.0"

  type VerificationFailureInput = String
  type HealOptions = String
  type HealResult = String

  invariants exports_present {
    - true
  }
}
