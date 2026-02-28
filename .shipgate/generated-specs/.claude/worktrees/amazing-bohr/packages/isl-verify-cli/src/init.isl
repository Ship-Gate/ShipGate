# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runInit, formatInitOutput, InitOptions, InitResult
# dependencies: fs/promises, fs, path, chalk, @isl-lang/spec-inference

domain Init {
  version: "1.0.0"

  type InitOptions = String
  type InitResult = String

  invariants exports_present {
    - true
  }
}
