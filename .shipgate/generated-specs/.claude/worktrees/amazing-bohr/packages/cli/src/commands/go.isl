# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: go, printGoResult, getGoExitCode, GoOptions, GoResult
# dependencies: path, fs, fs/promises, chalk

domain Go {
  version: "1.0.0"

  type GoOptions = String
  type GoResult = String

  invariants exports_present {
    - true
  }
}
