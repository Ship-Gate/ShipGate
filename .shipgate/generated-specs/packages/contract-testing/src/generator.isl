# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateTests, TestSuite, TestFile, TestGeneratorOptions, TestGenerator
# dependencies: vitest, @jest/globals, mocha, chai, fast-check

domain Generator {
  version: "1.0.0"

  type TestSuite = String
  type TestFile = String
  type TestGeneratorOptions = String
  type TestGenerator = String

  invariants exports_present {
    - true
  }
}
