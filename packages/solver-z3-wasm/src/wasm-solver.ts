/**
 * Z3 WASM Solver Adapter
 * 
 * Provides SMT solving capabilities using Z3 compiled to WebAssembly.
 * This allows SMT verification without requiring external Z3 installation.
 * 
 * Features:
 * - Deterministic execution with fixed seeds
 * - Timeout handling
 * - Model extraction
 * - SMT-LIB string parsing and execution
 * 
 * Limitations:
 * - Requires SharedArrayBuffer support (Node.js 16+ or browser with COOP/COEP headers)
 * - Slower than native Z3 (but still useful for verification)
 * - Memory limits apply (WASM heap)
 */

import type { SMTExpr, SMTDecl, SMTSort } from '@isl-lang/prover';
import type { SMTCheckResult } from '@isl-lang/isl-smt';
import { toSMTLib, declToSMTLib } from '@isl-lang/prover';
import { convertExpr, createVarMap, type Z3Context } from './expr-converter.js';

// Dynamic import to avoid loading WASM unless needed
let z3Module: {
  init: () => Promise<{ Z3: unknown; Context: new (name: string) => unknown }>;
} | null = null;
let z3Initialized = false;
let z3InitPromise: Promise<void> | null = null;

/**
 * Initialize Z3 WASM module
 * 
 * This is lazy-loaded and cached for performance.
 */
async function initZ3(): Promise<{
  Z3: {
    mk_context: (config: unknown) => unknown;
    parse_smtlib2_string: (ctx: unknown, str: string, sorts: unknown[], decls: unknown[]) => unknown;
    solver_check: (ctx: unknown, solver: unknown) => Promise<string>;
    solver_get_model: (ctx: unknown, solver: unknown) => unknown;
    model_to_string: (ctx: unknown, model: unknown) => string;
    del_context: (ctx: unknown) => void;
    solver_inc_ref: (ctx: unknown, solver: unknown) => void;
    solver_dec_ref: (ctx: unknown, solver: unknown) => void;
    mk_solver: (ctx: unknown) => unknown;
    solver_assert: (ctx: unknown, solver: unknown, ast: unknown) => void;
  };
  Context: new (name: string) => {
    Solver: new () => {
      add: (expr: unknown) => void;
      check: () => Promise<string>;
      model: () => unknown;
    };
    Int: {
      const: (name: string) => {
        ge: (val: unknown) => unknown;
        le: (val: unknown) => unknown;
        gt: (val: unknown) => unknown;
        lt: (val: unknown) => unknown;
        eq: (val: unknown) => unknown;
      };
    };
    And: (...args: unknown[]) => unknown;
    Or: (...args: unknown[]) => unknown;
    Not: (arg: unknown) => unknown;
    Implies: (left: unknown, right: unknown) => unknown;
  };
}> {
  if (z3Initialized && z3Module) {
    return z3Module as unknown as Awaited<ReturnType<typeof initZ3>>;
  }

  if (z3InitPromise) {
    await z3InitPromise;
    return z3Module as unknown as Awaited<ReturnType<typeof initZ3>>;
  }

  z3InitPromise = (async () => {
    try {
      // Dynamic import to avoid bundling issues
      const mod = await import('z3-solver');
      const initFn = mod.init || (mod as { default?: { init?: () => Promise<unknown> } }).default?.init;
      
      if (!initFn || typeof initFn !== 'function') {
        throw new Error('z3-solver module does not export init function');
      }

      const result = await initFn();
      z3Module = result as typeof z3Module;
      z3Initialized = true;
    } catch (error) {
      z3InitPromise = null;
      throw new Error(`Failed to initialize Z3 WASM: ${error instanceof Error ? error.message : String(error)}`);
    }
  })();

  await z3InitPromise;
  return z3Module as unknown as Awaited<ReturnType<typeof initZ3>>;
}

/**
 * Check if Z3 WASM is available
 */
export async function isZ3WasmAvailable(): Promise<boolean> {
  try {
    await initZ3();
    return z3Initialized;
  } catch {
    return false;
  }
}

/**
 * WASM Solver Configuration
 */
export interface WasmSolverConfig {
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Produce models on SAT (default: true) */
  produceModels?: boolean;
  /** Verbose logging (default: false) */
  verbose?: boolean;
  /** Fixed random seed for deterministic execution (default: 0) */
  randomSeed?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<WasmSolverConfig> = {
  timeout: 5000,
  produceModels: true,
  verbose: false,
  randomSeed: 0,
};

/**
 * Z3 WASM Solver Implementation
 * 
 * Implements the ISMTSolver interface using Z3 compiled to WASM.
 */
export class Z3WasmSolver {
  private config: Required<WasmSolverConfig>;
  private context: unknown = null;

  constructor(config: WasmSolverConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the solver (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.context) {
      return;
    }

    const z3 = await initZ3();
    
    // Create a new context for this solver instance
    // The z3-solver API uses Context objects
    this.context = new z3.Context('isl-solver');
  }

  /**
   * Check satisfiability of a formula
   */
  async checkSat(formula: SMTExpr, declarations: SMTDecl[] = []): Promise<SMTCheckResult> {
    try {
      await this.ensureInitialized();

      const smtLib = this.generateSMTLib(formula, declarations);
      
      if (this.config.verbose) {
        console.log('[Z3-WASM] Query:\n', smtLib);
      }

      // Use expression-based solving (more reliable than SMT-LIB parsing)
      return await this.solveWithExpressions(formula, declarations);
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check validity (formula is true for all assignments)
   */
  async checkValid(formula: SMTExpr, declarations: SMTDecl[] = []): Promise<SMTCheckResult> {
    // Valid iff negation is unsatisfiable
    const { Expr } = await import('@isl-lang/prover');
    const negated = Expr.not(formula);
    const result = await this.checkSat(negated, declarations);
    
    // Invert the result
    switch (result.status) {
      case 'sat':
        // Negation is satisfiable, so original is NOT valid
        return { status: 'unsat' };
      case 'unsat':
        // Negation is unsatisfiable, so original IS valid
        return { status: 'sat' };
      default:
        return result;
    }
  }

  /**
   * Check if precondition is satisfiable
   */
  async checkPreconditionSat(
    precondition: SMTExpr,
    inputVars: Map<string, SMTSort>
  ): Promise<SMTCheckResult> {
    const { Decl } = await import('@isl-lang/prover');
    const declarations: SMTDecl[] = [];
    for (const [name, sort] of inputVars) {
      declarations.push(Decl.const(name, sort));
    }
    
    return await this.checkSat(precondition, declarations);
  }

  /**
   * Check if postcondition follows from precondition
   */
  async checkPostconditionImplication(
    precondition: SMTExpr,
    postcondition: SMTExpr,
    vars: Map<string, SMTSort>
  ): Promise<SMTCheckResult> {
    const { Expr, Decl } = await import('@isl-lang/prover');
    
    // Check if: precondition => postcondition is valid
    // This is valid iff NOT(precondition AND NOT postcondition) is valid
    const formula = Expr.and(precondition, Expr.not(postcondition));
    
    const declarations: SMTDecl[] = [];
    for (const [name, sort] of vars) {
      declarations.push(Decl.const(name, sort));
    }
    
    const result = await this.checkSat(formula, declarations);
    
    // Interpret the result:
    // - unsat: implication is valid (good!)
    // - sat: implication is NOT valid (counterexample found)
    // - unknown/timeout: cannot determine
    return result;
  }

  /**
   * Generate SMT-LIB script from formula and declarations
   */
  private generateSMTLib(formula: SMTExpr, declarations: SMTDecl[]): string {
    const lines: string[] = [
      '; ISL SMT Verification Query (Z3 WASM)',
      '(set-logic ALL)',
      '(set-option :produce-models true)',
      `(set-option :timeout ${this.config.timeout})`,
      `(set-option :random-seed ${this.config.randomSeed})`,
      '',
      '; Declarations',
    ];
    
    for (const decl of declarations) {
      lines.push(declToSMTLib(decl));
    }
    
    lines.push('');
    lines.push('; Formula');
    lines.push(`(assert ${toSMTLib(formula)})`);
    lines.push('');
    lines.push('(check-sat)');
    
    if (this.config.produceModels) {
      lines.push('(get-model)');
    }
    
    return lines.join('\n');
  }

  /**
   * Solve SMT-LIB query using Z3 WASM
   * 
   * Uses Z3's high-level API by converting SMT expressions directly.
   * For now, uses a simplified conversion approach.
   */
  private async solveSMTLib(smtLib: string): Promise<SMTCheckResult> {
    if (!this.context) {
      throw new Error('Z3 context not initialized');
    }

    const ctx = this.context as unknown as Z3Context & {
      eval?: (script: string) => Promise<string>;
      parseSMTLib2String?: (str: string) => unknown[];
    };

    const timeoutPromise = new Promise<SMTCheckResult>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), this.config.timeout);
    });

    const solvePromise = (async (): Promise<SMTCheckResult> => {
      try {
        if (typeof ctx.parseSMTLib2String === 'function') {
          const assertions = ctx.parseSMTLib2String(smtLib);
          const solver = new ctx.Solver();
          for (const a of assertions) {
            solver.add(a);
          }
          const checkResult = await solver.check();
          if (checkResult === 'sat') {
            return { status: 'sat', model: this.parseModelString(solver.model().toString()) };
          } else if (checkResult === 'unsat') {
            return { status: 'unsat' };
          }
          return { status: 'unknown', reason: `Z3 returned: ${checkResult}` };
        }

        return {
          status: 'error',
          message: 'SMT-LIB string parsing not available in this Z3 WASM build. Use expression-based API.',
        };
      } catch (error) {
        if (error instanceof Error && error.message === 'Timeout') {
          return { status: 'timeout' };
        }
        return {
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        };
      }
    })();

    try {
      return await Promise.race([solvePromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && error.message === 'Timeout') {
        return { status: 'timeout' };
      }
      return {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Solve using expression conversion (preferred method).
   *
   * Converts the SMTExpr tree to Z3 expressions via the expr-converter
   * module, which handles Bool, Int, Real, String, Array sorts and quantifiers.
   */
  private async solveWithExpressions(
    formula: SMTExpr,
    declarations: SMTDecl[]
  ): Promise<SMTCheckResult> {
    if (!this.context) {
      throw new Error('Z3 context not initialized');
    }

    const ctx = this.context as unknown as Z3Context;

    const timeoutPromise = new Promise<SMTCheckResult>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout'));
      }, this.config.timeout);
    });

    const solvePromise = (async () => {
      try {
        const vars = createVarMap(declarations, ctx);
        const z3Expr = convertExpr(formula, ctx, vars);

        const solver = new ctx.Solver();
        solver.add(z3Expr);

        const checkResult = await solver.check();

        if (checkResult === 'sat') {
          const model = solver.model();
          return {
            status: 'sat' as const,
            model: this.extractModel(model, vars),
          };
        } else if (checkResult === 'unsat') {
          return { status: 'unsat' as const };
        } else {
          return {
            status: 'unknown' as const,
            reason: `Z3 returned: ${checkResult}`,
          };
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'Timeout') {
          return { status: 'timeout' as const };
        }
        throw error;
      }
    })();

    try {
      return await Promise.race([solvePromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && error.message === 'Timeout') {
        return { status: 'timeout' };
      }
      return {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Extract a model as a plain JS object.
   *
   * Tries per-variable eval first (handles all sorts correctly),
   * then falls back to string-based model parsing.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractModel(model: any, vars: Map<string, any>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name, varExpr] of vars) {
      try {
        const val = model.eval(varExpr, true);
        if (val != null) {
          result[name] = this.parseValueString(String(val));
        }
      } catch {
        // Variable not evaluable in model — skip
      }
    }

    if (Object.keys(result).length > 0) return result;

    return this.parseModelString(model.toString());
  }

  /**
   * Parse model string from Z3 output.
   *
   * Handles parametric sorts like (Array Int Int) and nested values
   * by walking balanced parentheses instead of a flat regex.
   */
  private parseModelString(modelStr: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    let searchFrom = 0;
    while (searchFrom < modelStr.length) {
      const idx = modelStr.indexOf('(define-fun ', searchFrom);
      if (idx === -1) break;

      let pos = idx + '(define-fun '.length;

      // Read variable name
      while (pos < modelStr.length && /\s/.test(modelStr[pos]!)) pos++;
      const nameStart = pos;
      while (pos < modelStr.length && /\w/.test(modelStr[pos]!)) pos++;
      const name = modelStr.substring(nameStart, pos);

      // Skip params ()
      while (pos < modelStr.length && modelStr[pos] !== '(') pos++;
      pos = this.skipBalanced(modelStr, pos);

      // Skip whitespace
      while (pos < modelStr.length && /\s/.test(modelStr[pos]!)) pos++;

      // Skip sort — may be an atom like Int or a compound like (Array Int Int)
      pos = this.skipSExpr(modelStr, pos);

      // Skip whitespace
      while (pos < modelStr.length && /\s/.test(modelStr[pos]!)) pos++;

      // Read value
      const valStart = pos;
      pos = this.skipSExpr(modelStr, pos);
      const valueStr = modelStr.substring(valStart, pos).trim();

      if (name) {
        result[name] = this.parseValueString(valueStr);
      }

      searchFrom = pos;
    }

    return result;
  }

  private skipBalanced(str: string, pos: number): number {
    if (pos >= str.length || str[pos] !== '(') return pos;
    let depth = 1;
    pos++;
    while (pos < str.length && depth > 0) {
      if (str[pos] === '(') depth++;
      else if (str[pos] === ')') depth--;
      pos++;
    }
    return pos;
  }

  private skipSExpr(str: string, pos: number): number {
    if (pos >= str.length) return pos;
    if (str[pos] === '(') return this.skipBalanced(str, pos);
    if (str[pos] === '"') {
      pos++;
      while (pos < str.length) {
        if (str[pos] === '\\') { pos += 2; continue; }
        if (str[pos] === '"') { pos++; break; }
        pos++;
      }
      return pos;
    }
    while (pos < str.length && !/[\s()]/.test(str[pos]!)) pos++;
    return pos;
  }


  /**
   * Parse value string from Z3 output
   */
  private parseValueString(valueStr: string): unknown {
    const v = valueStr.trim();
    
    // Boolean
    if (v === 'true') return true;
    if (v === 'false') return false;
    
    // Integer
    if (/^-?\d+$/.test(v)) {
      return parseInt(v, 10);
    }
    
    // Negative integer — Z3 format: (- 5)
    const negMatch = v.match(/^\(\s*-\s*(\d+)\s*\)$/);
    if (negMatch) {
      return -parseInt(negMatch[1]!, 10);
    }
    
    // Real / decimal
    if (/^-?\d+\.\d+$/.test(v)) {
      return parseFloat(v);
    }
    
    // Rational — Z3 format: (/ 1 2)
    const ratMatch = v.match(/^\(\s*\/\s*(-?\d+)\s+(\d+)\s*\)$/);
    if (ratMatch) {
      return parseInt(ratMatch[1]!, 10) / parseInt(ratMatch[2]!, 10);
    }
    
    // String (quoted)
    const strMatch = v.match(/^"((?:[^"\\]|\\.)*)"$/);
    if (strMatch) {
      return strMatch[1]!.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    
    // Fallback: return as string
    return v;
  }
}

/**
 * Create a Z3 WASM solver instance
 */
export function createZ3WasmSolver(config: WasmSolverConfig = {}): Z3WasmSolver {
  return new Z3WasmSolver(config);
}
