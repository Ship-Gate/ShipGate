/**
 * WASM Solver Adapter
 * 
 * Adapter that implements the ISMTSolver interface using Z3 WASM.
 */

import type { SMTExpr, SMTDecl, SMTSort } from '@isl-lang/prover';
import type { ISMTSolver, SMTCheckResult } from '@isl-lang/isl-smt';
import { Z3WasmSolver, type WasmSolverConfig } from './wasm-solver.js';

/**
 * WASM Solver Adapter Options
 */
export interface WasmSolverAdapterOptions extends WasmSolverConfig {
  // Inherits all options from WasmSolverConfig
}

/**
 * WASM Solver Adapter implementing ISMTSolver interface
 */
class WasmSolverAdapter implements ISMTSolver {
  private wasmSolver: Z3WasmSolver;

  constructor(options: WasmSolverAdapterOptions = {}) {
    this.wasmSolver = new Z3WasmSolver(options);
  }

  async checkSat(formula: SMTExpr, declarations?: SMTDecl[]): Promise<SMTCheckResult> {
    return await this.wasmSolver.checkSat(formula, declarations);
  }

  async checkValid(formula: SMTExpr, declarations?: SMTDecl[]): Promise<SMTCheckResult> {
    return await this.wasmSolver.checkValid(formula, declarations);
  }

  async checkPreconditionSat(
    precondition: SMTExpr,
    inputVars: Map<string, SMTSort>
  ): Promise<SMTCheckResult> {
    return await this.wasmSolver.checkPreconditionSat(precondition, inputVars);
  }

  async checkPostconditionImplication(
    precondition: SMTExpr,
    postcondition: SMTExpr,
    vars: Map<string, SMTSort>
  ): Promise<SMTCheckResult> {
    return await this.wasmSolver.checkPostconditionImplication(precondition, postcondition, vars);
  }
}

/**
 * Create a WASM solver adapter implementing ISMTSolver
 */
export function createWasmSolver(options: WasmSolverAdapterOptions = {}): ISMTSolver {
  return new WasmSolverAdapter(options);
}
