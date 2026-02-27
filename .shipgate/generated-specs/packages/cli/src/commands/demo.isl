# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: login, getUser, createTestUser, demo, printDemoResult, getDemoExitCode, DemoOptions, DemoResult
# dependencies: fs/promises, fs, path, chalk, ora, uuid

domain Demo {
  version: "1.0.0"

  type DemoOptions = String
  type DemoResult = String

  invariants exports_present {
    - true
  }
}
