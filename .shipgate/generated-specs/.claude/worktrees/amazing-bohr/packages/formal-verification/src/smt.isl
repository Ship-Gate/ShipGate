# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createRealSolver, createDemoSolver, SMTResult, SMTStats, SolverMode, SMTSolverConfig, SMTSolver
# dependencies: 

domain Smt {
  version: "1.0.0"

  type SMTResult = String
  type SMTStats = String
  type SolverMode = String
  type SMTSolverConfig = String
  type SMTSolver = String

  invariants exports_present {
    - true
  }
}
