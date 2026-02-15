# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: checkSolverAvailability, clearSolverCache, runSolver, checkSatExternal, checkAllSolvers, getBestAvailableSolver, getSolverAvailabilityMatrix, _testInternals, ExternalSolver, SolverExecResult, SolverStats, ExternalSolverConfig, SolverAvailability, SolverAvailabilityMatrix
# dependencies: child_process, fs/promises, os, path

domain ExternalSolver {
  version: "1.0.0"

  type ExternalSolver = String
  type SolverExecResult = String
  type SolverStats = String
  type ExternalSolverConfig = String
  type SolverAvailability = String
  type SolverAvailabilityMatrix = String

  invariants exports_present {
    - true
  }
}
