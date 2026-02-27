# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createSolver, verifyQuery, AuthoritativeSolverOptions, SolverResult, AuthoritativeSolver
# dependencies: child_process, fs/promises, os, path

domain AuthoritativeSolver {
  version: "1.0.0"

  type AuthoritativeSolverOptions = String
  type SolverResult = String
  type AuthoritativeSolver = String

  invariants exports_present {
    - true
  }
}
