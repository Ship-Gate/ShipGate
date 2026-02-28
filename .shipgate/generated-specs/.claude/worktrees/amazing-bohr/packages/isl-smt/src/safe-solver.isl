# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: measureQuery, createSafeSolver, SafeSolverLimits, SafeSolverResult, QueryMetrics, SafeSolver
# dependencies: @isl-lang/prover

domain SafeSolver {
  version: "1.0.0"

  type SafeSolverLimits = String
  type SafeSolverResult = String
  type QueryMetrics = String
  type SafeSolver = String

  invariants exports_present {
    - true
  }
}
