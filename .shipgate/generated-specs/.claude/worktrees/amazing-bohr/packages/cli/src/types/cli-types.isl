# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: OutputFormat, BaseCommandOptions, BaseCommandResult, Verdict, UnifiedVerdict, ProofBundleSummary, CLIConfig
# dependencies: 

domain CliTypes {
  version: "1.0.0"

  type OutputFormat = String
  type BaseCommandOptions = String
  type BaseCommandResult = String
  type Verdict = String
  type UnifiedVerdict = String
  type ProofBundleSummary = String
  type CLIConfig = String

  invariants exports_present {
    - true
  }
}
