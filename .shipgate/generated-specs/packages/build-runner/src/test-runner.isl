# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runVitest, produceTestReport, TestRunResult, TestFailure, TestReport
# dependencies: node:child_process, node:path, node:fs/promises, node:fs

domain TestRunner {
  version: "1.0.0"

  type TestRunResult = String
  type TestFailure = String
  type TestReport = String

  invariants exports_present {
    - true
  }
}
