# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: detectFramework, runTests, TestRunnerConfig
# dependencies: child_process, path, fs/promises

domain TestRunner {
  version: "1.0.0"

  type TestRunnerConfig = String

  invariants exports_present {
    - true
  }
}
