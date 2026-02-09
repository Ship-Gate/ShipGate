/**
 * @isl-lang/solver-z3-wasm
 * 
 * Z3 WASM Solver Adapter for ISL
 * 
 * Provides SMT solving capabilities using Z3 compiled to WebAssembly,
 * allowing verification without external Z3 installation.
 * 
 * @example
 * ```typescript
 * import { createWasmSolver } from '@isl-lang/solver-z3-wasm';
 * import { Expr, Sort, Decl } from '@isl-lang/prover';
 * 
 * const solver = createWasmSolver({
 *   timeout: 5000,
 *   randomSeed: 42, // For deterministic results
 * });
 * 
 * const result = await solver.checkSat(
 *   Expr.and(
 *     Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
 *     Expr.lt(Expr.var('x', Sort.Int()), Expr.int(10))
 *   ),
 *   [Decl.const('x', Sort.Int())]
 * );
 * 
 * if (result.status === 'sat') {
 *   console.log('Satisfiable with model:', result.model);
 * }
 * ```
 */

export {
  Z3WasmSolver,
  createZ3WasmSolver,
  isZ3WasmAvailable,
  type WasmSolverConfig,
} from './wasm-solver.js';

// Re-export types for convenience
export type { SMTCheckResult } from '@isl-lang/isl-smt';
export type { SMTExpr, SMTDecl, SMTSort } from '@isl-lang/prover';

/**
 * Create a WASM solver that implements ISMTSolver interface
 * 
 * This is the main entry point for using Z3 WASM as an SMT solver.
 */
export { createWasmSolver } from './adapter.js';
