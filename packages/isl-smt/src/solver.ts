/**
 * SMT Solver Backend
 * 
 * Provides SMT solving capabilities with:
 * - Built-in solver for simple cases (with bounded integer arithmetic)
 * - Z3 integration via subprocess (when available)
 * - Query caching for deterministic results
 * - Proper timeout handling with UNKNOWN fallback
 * - Safe memory limits - no unbounded solver runs
 */

import { spawn } from 'child_process';
import { writeFile, unlink, mkdtemp, rmdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { toSMTLib, declToSMTLib, Expr, Decl } from '@isl-lang/prover';
import type { SMTExpr, SMTDecl, SMTSort } from '@isl-lang/prover';
import type { SMTCheckResult, SMTVerifyOptions } from './types.js';
import { SMTCache, getGlobalCache, type CacheConfig } from './cache.js';
import { BuiltinSolver } from './builtin-solver.js';

/**
 * Default timeout in milliseconds
 */
const DEFAULT_TIMEOUT = 5000;

/**
 * Maximum memory limit for Z3 subprocess (in MB)
 */
const MAX_MEMORY_MB = 512;

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
  private z3Available: boolean | null = null;
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
      
      // Try external solver first if configured
      if (this.config.solver === 'z3') {
        const available = await this.checkZ3Available();
        if (available) {
          result = await this.solveWithZ3(formula, declarations);
        } else {
          // Fall back to builtin if Z3 not available
          if (this.config.verbose) {
            console.log('[SMT] Z3 not available, falling back to builtin solver');
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
   * Check if Z3 is available on the system
   */
  private async checkZ3Available(): Promise<boolean> {
    if (this.z3Available !== null) {
      return this.z3Available;
    }
    
    return new Promise((resolve) => {
      const proc = spawn('z3', ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      
      let resolved = false;
      
      proc.on('error', () => {
        if (!resolved) {
          resolved = true;
          this.z3Available = false;
          resolve(false);
        }
      });
      
      proc.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          this.z3Available = code === 0;
          resolve(code === 0);
        }
      });
      
      // Timeout check
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill();
          this.z3Available = false;
          resolve(false);
        }
      }, 1000);
    });
  }
  
  /**
   * Solve using Z3 subprocess
   */
  private async solveWithZ3(formula: SMTExpr, declarations: SMTDecl[]): Promise<SMTCheckResult> {
    const smtLib = this.generateSMTLib(formula, declarations);
    
    if (this.config.verbose) {
      console.log('[SMT] Z3 query:\n', smtLib);
    }
    
    // Write to temp file
    let tmpDir: string | null = null;
    let tmpFile: string | null = null;
    
    try {
      tmpDir = await mkdtemp(join(tmpdir(), 'isl-smt-'));
      tmpFile = join(tmpDir, 'query.smt2');
      await writeFile(tmpFile, smtLib, 'utf-8');
      
      // Run Z3 with timeout
      const result = await this.runZ3(tmpFile);
      return result;
    } catch (error) {
      return {
        status: 'error',
        message: `Z3 execution failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      // Cleanup temp files
      try {
        if (tmpFile) await unlink(tmpFile);
        if (tmpDir) await rmdir(tmpDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
  
  /**
   * Run Z3 on a file with timeout and memory limits
   */
  private runZ3(filePath: string): Promise<SMTCheckResult> {
    return new Promise((resolve) => {
      const timeout = this.config.timeout;
      const timeoutSec = Math.ceil(timeout / 1000);
      
      const proc = spawn('z3', [
        '-smt2',
        `-T:${timeoutSec}`,
        `-memory:${MAX_MEMORY_MB}`,
        filePath,
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        // Limit process resources
        timeout: timeout + 2000,
      });
      
      let stdout = '';
      let stderr = '';
      let stdoutSize = 0;
      let resolved = false;
      
      const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB limit on output
      
      proc.stdout?.on('data', (data: Buffer) => {
        if (stdoutSize < MAX_OUTPUT_SIZE) {
          stdout += data.toString();
          stdoutSize += data.length;
        }
      });
      
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            proc.kill('SIGKILL');
          } catch {
            // Process may already be dead
          }
          resolve({ status: 'timeout' });
        }
      }, timeout + 1000); // Add buffer for Z3's own timeout
      
      proc.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutHandle);
          resolve({
            status: 'error',
            message: `Z3 error: ${err.message}`,
          });
        }
      });
      
      proc.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutHandle);
          resolve(this.parseZ3Output(stdout, stderr, code));
        }
      });
    });
  }
  
  /**
   * Parse Z3 output
   */
  private parseZ3Output(stdout: string, stderr: string, exitCode: number | null): SMTCheckResult {
    const output = stdout.trim().toLowerCase();
    
    if (output.includes('timeout') || exitCode === -1) {
      return { status: 'timeout' };
    }
    
    if (output.startsWith('sat')) {
      // Parse model if available
      const model = this.parseZ3Model(stdout);
      return { status: 'sat', model };
    }
    
    if (output.startsWith('unsat')) {
      return { status: 'unsat' };
    }
    
    if (output.startsWith('unknown')) {
      return { status: 'unknown', reason: 'Z3 returned unknown' };
    }
    
    // Check for errors
    if (stderr || output.includes('error')) {
      return {
        status: 'error',
        message: stderr || stdout || 'Unknown Z3 error',
      };
    }
    
    return { status: 'unknown', reason: `Unexpected Z3 output: ${output}` };
  }
  
  /**
   * Parse Z3 model output
   */
  private parseZ3Model(output: string): Record<string, unknown> | undefined {
    // Simple model parsing - looks for (define-fun varname () Type value)
    const model: Record<string, unknown> = {};
    
    const modelMatch = output.match(/\(model[\s\S]*?\)/);
    if (!modelMatch) return undefined;
    
    const defineRegex = /\(define-fun\s+(\w+)\s+\(\)\s+\w+\s+([\w\d\-\.]+)\)/g;
    let match;
    
    while ((match = defineRegex.exec(modelMatch[0])) !== null) {
      const name = match[1]!;
      const value = match[2]!;
      
      // Parse value
      if (value === 'true') {
        model[name] = true;
      } else if (value === 'false') {
        model[name] = false;
      } else if (/^-?\d+$/.test(value)) {
        model[name] = parseInt(value);
      } else if (/^-?\d+\.\d+$/.test(value)) {
        model[name] = parseFloat(value);
      } else {
        model[name] = value;
      }
    }
    
    return Object.keys(model).length > 0 ? model : undefined;
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
  const solver = createSolver({ solver: 'z3' }) as SMTSolverImpl;
  return (solver as any).checkZ3Available();
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
