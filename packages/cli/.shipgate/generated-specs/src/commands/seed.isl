# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: seedGenerate, seedRun, seedReset, printSeedGenerateResult, printSeedRunResult, printSeedResetResult, getSeedGenerateExitCode, getSeedRunExitCode, getSeedResetExitCode, SeedGenerateOptions, SeedRunOptions, SeedResetOptions, SeedGenerateResult, SeedRunResult, SeedResetResult
# dependencies: fs/promises, child_process, path, chalk

domain Seed {
  version: "1.0.0"

  type SeedGenerateOptions = String
  type SeedRunOptions = String
  type SeedResetOptions = String
  type SeedGenerateResult = String
  type SeedRunResult = String
  type SeedResetResult = String

  invariants exports_present {
    - true
  }
}
