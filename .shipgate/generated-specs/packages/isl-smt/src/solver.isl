# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createSolver, isZ3Available, isCVC5Available, getSolverAvailability, translate, solve, ISMTSolver
# dependencies: @isl-lang/prover

domain Solver {
  version: "1.0.0"

  type ISMTSolver = String

  invariants exports_present {
    - true
  }
}
