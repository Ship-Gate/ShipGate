# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: escapeSmtString, formatSmtLib, validateSmtLib, Z3Options, Z3Result, Z3Solver, MockZ3Solver
# dependencies: child_process, fs/promises, os, path

domain Solver {
  version: "1.0.0"

  type Z3Options = String
  type Z3Result = String
  type Z3Solver = String
  type MockZ3Solver = String

  invariants exports_present {
    - true
  }
}
