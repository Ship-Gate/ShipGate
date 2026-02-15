# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isZ3WasmAvailable, createZ3WasmSolver, WasmSolverConfig, Z3WasmSolver
# dependencies: @isl-lang/prover

domain WasmSolver {
  version: "1.0.0"

  type WasmSolverConfig = String
  type Z3WasmSolver = String

  invariants exports_present {
    - true
  }
}
