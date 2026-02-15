# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: BuiltinSolverConfig, BuiltinSolver
# dependencies: @isl-lang/prover

domain BuiltinSolver {
  version: "1.0.0"

  type BuiltinSolverConfig = String
  type BuiltinSolver = String

  invariants exports_present {
    - true
  }
}
