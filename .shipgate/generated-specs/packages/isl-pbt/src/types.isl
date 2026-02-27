# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_PBT_CONFIG, DEFAULT_PII_CONFIG, PRNG, Generator, Property, BehaviorProperties, InputFieldSpec, FieldConstraints, PBTConfig, TestRun, LogCapture, ShrinkResult, ShrinkStep, PBTReport, PropertyViolation, PBTStats, PBTJsonReport, CLIOptions, PIIConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type PRNG = String
  type Generator = String
  type Property = String
  type BehaviorProperties = String
  type InputFieldSpec = String
  type FieldConstraints = String
  type PBTConfig = String
  type TestRun = String
  type LogCapture = String
  type ShrinkResult = String
  type ShrinkStep = String
  type PBTReport = String
  type PropertyViolation = String
  type PBTStats = String
  type PBTJsonReport = String
  type CLIOptions = String
  type PIIConfig = String

  invariants exports_present {
    - true
  }
}
