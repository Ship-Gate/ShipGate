/**
 * SMT Solver Backend
 * 
 * Provides SMT solving capabilities with:
 * - Built-in solver for simple cases
 * - Z3 integration via subprocess (when available)
 * - Proper timeout handling with UNKNOWN fallback
 */

import { spawn } from 'child_process';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Prover, toSMTLib, declToSMTLib, Expr, Decl, Sort } from '@isl-lang/prover';
import type { SMTExpr, SMTDecl, SMTSort } from '@isl-lang/prover';
import type { SMTCheckResult, SMTVerifyOptions } from './types.js';

/**
 * Default timeout in milliseconds
 */
const DEFAULT_TIMEOUT = 5000;

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
 * SMT Solver implementation
 */
class SMTSolverImpl implements ISMTSolver {
  private config: Required<SMTVerifyOptions>;
  private z3Available: boolean | null = null;
  
  constructor(config: Required<SMTVerifyOptions>) {
    this.config = config;
  }
  
  async checkSat(formula: SMTExpr, declarations: SMTDecl[] = []): Promise<SMTCheckResult> {
    const start = Date.now();
    
    try {
      // Try external solver first if configured
      if (this.config.solver === 'z3') {
        const available = await this.checkZ3Available();
        if (available) {
          return await this.solveWithZ3(formula, declarations);
        }
        // Fall back to builtin if Z3 not available
        if (this.config.verbose) {
          console.log('[SMT] Z3 not available, falling back to builtin solver');
        }
      }
      
      // Use builtin solver
      return await this.solveBuiltin(formula, declarations);
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
    } finally {
      // Cleanup
      if (tmpFile) {
        try { await unlink(tmpFile); } catch { /* ignore */ }
      }
      if (tmpDir) {
        try { await unlink(tmpDir); } catch { /* ignore */ }
      }
    }
  }
  
  /**
   * Run Z3 on a file with timeout
   */
  private runZ3(filePath: string): Promise<SMTCheckResult> {
    return new Promise((resolve) => {
      const timeout = this.config.timeout;
      const timeoutSec = Math.ceil(timeout / 1000);
      
      const proc = spawn('z3', [
        '-smt2',
        `-T:${timeoutSec}`,
        filePath,
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      
      let stdout = '';
      let stderr = '';
      let resolved = false;
      
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill('SIGKILL');
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
   * Solve using builtin solver (from prover package)
   */
  private async solveBuiltin(formula: SMTExpr, declarations: SMTDecl[]): Promise<SMTCheckResult> {
    const prover = new Prover({
      solver: 'builtin',
      timeout: this.config.timeout,
      produceModels: this.config.produceModels,
    });
    
    // Add declarations
    for (const decl of declarations) {
      prover.declare(decl);
    }
    
    // Assert the formula
    prover.assert(formula);
    
    // Check sat with timeout
    const start = Date.now();
    const deadline = start + this.config.timeout;
    
    try {
      const status = await Promise.race([
        prover.checkSat(),
        this.createTimeout(this.config.timeout),
      ]);
      
      if (status === 'timeout') {
        return { status: 'timeout' };
      }
      
      switch (status) {
        case 'sat':
          return { status: 'sat', model: {} };
        case 'unsat':
          return { status: 'unsat' };
        default:
          return { status: 'unknown', reason: 'Builtin solver returned unknown' };
      }
    } catch (error) {
      if (Date.now() > deadline) {
        return { status: 'timeout' };
      }
      return {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<'timeout'> {
    return new Promise((resolve) => {
      setTimeout(() => resolve('timeout'), ms);
    });
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
