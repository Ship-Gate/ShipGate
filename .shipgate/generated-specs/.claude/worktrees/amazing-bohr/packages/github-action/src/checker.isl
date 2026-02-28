# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CheckResult, ISLChecker
# dependencies: @actions/core, @actions/exec, @actions/glob, path

domain Checker {
  version: "1.0.0"

  type CheckResult = String
  type ISLChecker = String

  invariants exports_present {
    - true
  }
}
