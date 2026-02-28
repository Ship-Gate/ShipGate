# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: resetStores, createTestInput, createInvalidInput, createTestContext, runTests, TestResult, TestDetail, RunnerOptions, ImplementationLanguage, TestRunner
# dependencies: child_process, fs/promises, path, os, @isl-lang/codegen-tests, @isl-lang/verifier-sandbox, vitest

domain TestRunner {
  version: "1.0.0"

  type TestResult = String
  type TestDetail = String
  type RunnerOptions = String
  type ImplementationLanguage = String
  type TestRunner = String

  invariants exports_present {
    - true
  }
}
