/**
 * SMT Solver Backend
 * 
 * Provides SMT solving capabilities with:
 * - Built-in solver for simple cases (with bounded integer arithmetic)
 * - Z3 and CVC5 integration via subprocess (when available)
 * - Query caching for deterministic results
 * - Strict timeout handling with process kill - NO HANGING PROCESSES
 * - Safe memory limits - no unbounded solver runs
 * - Cross-platform support (Windows, Linux, macOS)
 * 
 * Non-negotiables:
 * - Every solve has a hard timeout with guaranteed process termination
 * - Same query → same result (deterministic via caching)
 * - Cross-platform binary detection
 */

import { toSMTLib, declToSMTLib, Expr, Decl } from '@isl-lang/prover';
import type { SMTExpr, SMTDecl, SMTSort } from '@isl-lang/prover';
import type { SMTCheckResult, SMTVerifyOptions } from './types.js';
import { SMTCache, getGlobalCache, type CacheConfig } from './cache.js';
import { BuiltinSolver } from './builtin-solver.js';
import {
  checkSatExternal,
  checkSolverAvailability,
  getBestAvailableSolver,
  type ExternalSolver,
  type SolverAvailability,
} from './external-solver.js';

/**
 * Default timeout in milliseconds
 */
const DEFAULT_TIMEOUT = 5000;

/**
 * Maximum memory limit for solver subprocess (in MB)
 */
const MAX_MEMORY_MB = 512;

/**
 * Maximum output size from solver (bytes)
 */
const MAX_OUTPUT_BYTES = 1024 * 1024; // 1MB

/**
 * SMT Solver interface
 */
export interface ISMTSolver {
  /**
   * Check satisfiability of a formula
   */
  checkSat(formula: SMTExpr, declarations?: SMTDecl[]): Promise<SMTCheckResult>;
  
  /**
   * Check validity (formula is true for all assignments)
   * Valid iff negation is unsatisfiable
   */
  checkValid(formula: SMTExpr, declarations?: SMTDecl[]): Promise<SMTCheckResult>;
  
  /**
   * Check if precondition is satisfiable (there exists valid inputs)
   */
  checkPreconditionSat(
    precondition: SMTExpr,
    inputVars: Map<string, SMTSort>
  ): Promise<SMTCheckResult>;
  
  /**
   * Check if postcondition follows from precondition
   * (pre => post) should be valid
   */
  checkPostconditionImplication(
    precondition: SMTExpr,
    postcondition: SMTExpr,
    vars: Map<string, SMTSort>
  ): Promise<SMTCheckResult>;
}

/**
 * Create an SMT solver with the given options
 */
export function createSolver(options: SMTVerifyOptions = {}): ISMTSolver {
  const solver = options.solver ?? 'builtin';
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const verbose = options.verbose ?? false;
  const produceModels = options.produceModels ?? true;
  
  return new SMTSolverImpl({
    solver,
    timeout,
    verbose,
    produceModels,
  });
}

/**
 * Extended solver options for internal use
 */
interface ExtendedSolverOptions extends Required<SMTVerifyOptions> {
  cacheConfig?: CacheConfig;
}

/**
 * SMT Solver implementation
 */
class SMTSolverImpl implements ISMTSolver {
  private config: ExtendedSolverOptions;
  private solverAvailability: Map<ExternalSolver, SolverAvailability | null> = new Map();
  private cache: SMTCache;
  private builtinSolver: BuiltinSolver;
  
  constructor(config: ExtendedSolverOptions) {
    this.config = config;
    this.cache = config.cacheConfig ? new SMTCache(config.cacheConfig) : getGlobalCache();
    this.builtinSolver = new BuiltinSolver({
      timeout: config.timeout,
      verbose: config.verbose,
    });
  }
  
  async checkSat(formula: SMTExpr, declarations: SMTDecl[] = []): Promise<SMTCheckResult> {
    try {
      // Check cache first for deterministic results
      const queryHash = this.cache.hashQuery(formula, declarations);
      const cachedResult = this.cache.get(queryHash);
      
      if (cachedResult) {
        if (this.config.verbose) {
          console.log('[SMT] Cache hit for query:', queryHash.slice(0, 16));
        }
        return cachedResult;
      }
      
      let result: SMTCheckResult;
      
      // Try external solver if configured
      if (this.config.solver === 'z3' || this.config.solver === 'cvc5') {
        const available = await this.checkExternalSolverAvailable(this.config.solver);
        if (available) {
          result = await this.solveWithExternalSolver(formula, declarations, this.config.solver);
        } else {
          // Try WASM fallback for Z3
          if (this.config.solver === 'z3') {
            const wasmAvailable = await this.checkWasmSolverAvailable();
            if (wasmAvailable) {
              if (this.config.verbose) {
                console.log('[SMT] Z3 not available, falling back to Z3 WASM');
              }
              result = await this.solveWithWasmSolver(formula, declarations);
            } else {
              // Fall back to builtin if WASM also not available
              if (this.config.verbose) {
                console.log('[SMT] Z3 and Z3 WASM not available, falling back to builtin solver');
              }
              result = await this.solveEnhancedBuiltin(formula, declarations);
            }
          } else {
            // Fall back to builtin if external solver not available
            if (this.config.verbose) {
              console.log(`[SMT] ${this.config.solver.toUpperCase()} not available, falling back to builtin solver`);
            }
            result = await this.solveEnhancedBuiltin(formula, declarations);
          }
        }
      } else if (this.config.solver === 'z3-wasm') {
        // Use WASM solver directly
        const wasmAvailable = await this.checkWasmSolverAvailable();
        if (wasmAvailable) {
          result = await this.solveWithWasmSolver(formula, declarations);
        } else {
          if (this.config.verbose) {
            console.log('[SMT] Z3 WASM not available, falling back to builtin solver');
          }
          result = await this.solveEnhancedBuiltin(formula, declarations);
        }
      } else {
        // Use enhanced builtin solver
        result = await this.solveEnhancedBuiltin(formula, declarations);
      }
      
      // Cache the result
      this.cache.set(queryHash, result);
      
      return result;
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  async checkValid(formula: SMTExpr, declarations: SMTDecl[] = []): Promise<SMTCheckResult> {
    // Valid iff negation is unsatisfiable
    const negated = Expr.not(formula);
    const result = await this.checkSat(negated, declarations);
    
    // Invert the result
    switch (result.status) {
      case 'sat':
        // Negation is satisfiable, so original is NOT valid
        return { status: 'unsat' }; // This means "not valid"
      case 'unsat':
        // Negation is unsatisfiable, so original IS valid
        return { status: 'sat' }; // This means "valid"
      default:
        return result;
    }
  }
  
  async checkPreconditionSat(
    precondition: SMTExpr,
    inputVars: Map<string, SMTSort>
  ): Promise<SMTCheckResult> {
    // Generate declarations for input variables
    const declarations: SMTDecl[] = [];
    for (const [name, sort] of inputVars) {
      declarations.push(Decl.const(name, sort));
    }
    
    return await this.checkSat(precondition, declarations);
  }
  
  async checkPostconditionImplication(
    precondition: SMTExpr,
    postcondition: SMTExpr,
    vars: Map<string, SMTSort>
  ): Promise<SMTCheckResult> {
    // Check if: precondition => postcondition is valid
    // This is valid iff NOT(precondition AND NOT postcondition) is valid
    // Which is true iff (precondition AND NOT postcondition) is unsat
    
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
   * Check if an external solver is available on the system
   */
  private async checkExternalSolverAvailable(solver: ExternalSolver): Promise<boolean> {
    // Check cache
    const cached = this.solverAvailability.get(solver);
    if (cached !== undefined && cached !== null) {
      return cached.available;
    }
    
    const availability = await checkSolverAvailability(solver);
    this.solverAvailability.set(solver, availability);
    
    if (this.config.verbose && availability.available) {
      console.log(`[SMT] ${solver.toUpperCase()} available: ${availability.path} (v${availability.version})`);
    }
    
    return availability.available;
  }
  
  /**
   * Solve using external SMT solver (Z3 or CVC5)
   * 
   * Uses the external-solver adapter which provides:
   * - Cross-platform binary detection
   * - Strict timeout enforcement with process kill
   * - Output size limits
   * - Proper model parsing
   */
  private async solveWithExternalSolver(
    formula: SMTExpr,
    declarations: SMTDecl[],
    solver: ExternalSolver
  ): Promise<SMTCheckResult> {
    const smtLib = this.generateSMTLib(formula, declarations);
    
    if (this.config.verbose) {
      console.log(`[SMT] ${solver.toUpperCase()} query:\n`, smtLib);
    }
    
    const result = await checkSatExternal(smtLib, {
      solver,
      timeoutMs: this.config.timeout,
      maxOutputBytes: MAX_OUTPUT_BYTES,
      maxMemoryMB: MAX_MEMORY_MB,
      produceModels: this.config.produceModels,
      verbose: this.config.verbose,
    });
    
    // Convert external result to SMTCheckResult
    return {
      status: result.status,
      model: result.status === 'sat' ? result.model : undefined,
      reason: result.status === 'unknown' ? result.reason : undefined,
      message: result.status === 'error' ? result.message : undefined,
    } as SMTCheckResult;
  }
  
  /**
   * Check if WASM solver is available
   */
  private async checkWasmSolverAvailable(): Promise<boolean> {
    try {
      // Dynamic import to avoid loading WASM unless needed
      const { isZ3WasmAvailable } = await import('@isl-lang/solver-z3-wasm');
      return await isZ3WasmAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Solve using WASM solver
   */
  private async solveWithWasmSolver(formula: SMTExpr, declarations: SMTDecl[]): Promise<SMTCheckResult> {
    try {
      // Dynamic import to avoid loading WASM unless needed
      const { createWasmSolver } = await import('@isl-lang/solver-z3-wasm');
      const wasmSolver = createWasmSolver({
        timeout: this.config.timeout,
        produceModels: this.config.produceModels,
        verbose: this.config.verbose,
        randomSeed: 0, // Fixed seed for deterministic execution
      });
      
      return await wasmSolver.checkSat(formula, declarations);
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Solve using enhanced builtin solver
   * 
   * The enhanced solver supports:
   * - Boolean SAT solving
   * - Bounded integer arithmetic
   * - Linear constraint analysis
   * - Proper timeout handling
   */
  private async solveEnhancedBuiltin(formula: SMTExpr, declarations: SMTDecl[]): Promise<SMTCheckResult> {
    try {
      return await this.builtinSolver.checkSat(formula, declarations);
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Generate SMT-LIB script
   */
  private generateSMTLib(formula: SMTExpr, declarations: SMTDecl[]): string {
    const lines: string[] = [
      '; ISL SMT Verification Query',
      '(set-logic ALL)',
      '(set-option :produce-models true)',
      `(set-option :timeout ${this.config.timeout})`,
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
}

/**
 * Check if Z3 is available on the system
 */
export async function isZ3Available(): Promise<boolean> {
  const availability = await checkSolverAvailability('z3');
  return availability.available;
}

/**
 * Check if CVC5 is available on the system
 */
export async function isCVC5Available(): Promise<boolean> {
  const availability = await checkSolverAvailability('cvc5');
  return availability.available;
}

/**
 * Get availability info for all supported solvers
 */
export async function getSolverAvailability(): Promise<{
  z3: SolverAvailability;
  cvc5: SolverAvailability;
  bestAvailable: ExternalSolver | 'builtin';
}> {
  const [z3, cvc5] = await Promise.all([
    checkSolverAvailability('z3'),
    checkSolverAvailability('cvc5'),
  ]);
  
  const best = await getBestAvailableSolver();
  
  return {
    z3,
    cvc5,
    bestAvailable: best || 'builtin',
  };
}

/**
 * Translate an SMT expression to SMT-LIB format
 * 
 * This produces a deterministic string representation that can be:
 * - Sent to external solvers
 * - Used for debugging
 * - Cached for deduplication
 */
export function translate(
  formula: SMTExpr,
  declarations: SMTDecl[] = []
): string {
  const lines: string[] = [
    '; ISL SMT Query',
    '(set-logic ALL)',
    '(set-option :produce-models true)',
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
  lines.push('(get-model)');
  
  return lines.join('\n');
}

/**
 * High-level solve function with tri-state output
 * 
 * This is the recommended API for SMT solving:
 * - Returns { verdict: 'proved' } if property is definitively true
 * - Returns { verdict: 'disproved', model?, reason? } if false with counterexample
 * - Returns { verdict: 'unknown', reason } if cannot determine
 * 
 * @example
 * ```typescript
 * // Check if x > 0 and x < 10 is satisfiable
 * const result = await solve(
 *   Expr.and(
 *     Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
 *     Expr.lt(Expr.var('x', Sort.Int()), Expr.int(10))
 *   ),
 *   { timeout: 1000 }
 * );
 * 
 * if (result.verdict === 'disproved') {
 *   console.log('Satisfiable with model:', result.model);
 * }
 * ```
 */
export async function solve(
  formula: SMTExpr,
  options: SMTVerifyOptions = {}
): Promise<import('./types.js').SolveResult> {
  const solver = createSolver(options);
  
  // Generate declarations from free variables in formula
  const declarations: SMTDecl[] = collectDeclarations(formula);
  
  const result = await solver.checkSat(formula, declarations);
  
  switch (result.status) {
    case 'unsat':
      return { verdict: 'proved' };
      
    case 'sat':
      return { 
        verdict: 'disproved', 
        model: result.model,
        reason: 'Found satisfying assignment',
      };
      
    case 'unknown':
      return { verdict: 'unknown', reason: result.reason };
      
    case 'timeout':
      return { verdict: 'unknown', reason: 'Timeout' };
      
    case 'error':
      return { verdict: 'unknown', reason: `Error: ${result.message}` };
  }
}

/**
 * Collect free variables from expression and create declarations
 */
function collectDeclarations(expr: SMTExpr): SMTDecl[] {
  const vars = new Map<string, SMTSort>();
  
  const collect = (e: SMTExpr): void => {
    switch (e.kind) {
      case 'Var':
        vars.set(e.name, e.sort);
        break;
      case 'Not':
      case 'Neg':
      case 'Abs':
        collect(e.arg);
        break;
      case 'And':
      case 'Or':
      case 'Add':
      case 'Mul':
      case 'Distinct':
        for (const arg of e.args) collect(arg);
        break;
      case 'Implies':
      case 'Iff':
      case 'Eq':
      case 'Lt':
      case 'Le':
      case 'Gt':
      case 'Ge':
      case 'Sub':
      case 'Div':
      case 'Mod':
        collect(e.left);
        collect(e.right);
        break;
      case 'Ite':
        collect(e.cond);
        collect(e.then);
        collect(e.else);
        break;
      case 'Forall':
      case 'Exists':
        collect(e.body);
        // Remove bound variables
        for (const v of e.vars) {
          vars.delete(v.name);
        }
        break;
      case 'Select':
        collect(e.array);
        collect(e.index);
        break;
      case 'Store':
        collect(e.array);
        collect(e.index);
        collect(e.value);
        break;
      case 'Apply':
        for (const arg of e.args) collect(arg);
        break;
      case 'Let':
        for (const b of e.bindings) collect(b.value);
        collect(e.body);
        break;
    }
  };
  
  collect(expr);
  
  return Array.from(vars.entries()).map(([name, sort]) => 
    Decl.const(name, sort)
  );
}
