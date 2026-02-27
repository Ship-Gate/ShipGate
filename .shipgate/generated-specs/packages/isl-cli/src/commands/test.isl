# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: test, printTestResult, TestOptions, TestCommandResult
# dependencies: fs/promises, path, child_process, util, chalk

domain Test {
  version: "1.0.0"

  type TestOptions = String
  type TestCommandResult = String

  invariants exports_present {
    - true
  }
}
