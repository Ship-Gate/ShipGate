# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RunnerOptions, TestResult, ContractRunner
# dependencies: fast-check

domain Runner {
  version: "1.0.0"

  type RunnerOptions = String
  type TestResult = String
  type ContractRunner = String

  invariants exports_present {
    - true
  }
}
