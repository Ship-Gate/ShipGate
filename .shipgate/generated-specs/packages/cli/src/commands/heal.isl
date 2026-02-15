# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: heal, aiHeal, printHealResult, getHealExitCode, HealOptions, HealResult
# dependencies: fs/promises, fs, path, glob, chalk, ora, @isl-lang/parser, @isl-lang/pipeline, @isl-lang/autofix

domain Heal {
  version: "1.0.0"

  type HealOptions = String
  type HealResult = String

  invariants exports_present {
    - true
  }
}
