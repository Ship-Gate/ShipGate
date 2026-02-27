# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: convertExpr, createVarMap, Z3Context, Z3Solver, Z3Int, Z3Bool, Z3Expr, Z3Model
# dependencies: 

domain ExprConverter {
  version: "1.0.0"

  type Z3Context = String
  type Z3Solver = String
  type Z3Int = String
  type Z3Bool = String
  type Z3Expr = String
  type Z3Model = String

  invariants exports_present {
    - true
  }
}
