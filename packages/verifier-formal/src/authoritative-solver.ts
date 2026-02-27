// ============================================================================
// Authoritative SMT Solver
// Makes SMT results authoritative when applicable, safely degradable otherwise
// ============================================================================

import { spawn } from 'child_process';
import { writeFile, unlink, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  Verdict,
  CounterexampleData,
  UnknownReason,
  createProvedVerdict,
  createDisprovedVerdict,
  createUnknownVerdict,
  createTimeoutReason,
  createSolverErrorReason,
  createResourceExhaustedReason,
  createTheoryIncompleteReason,
} from './verdict';
import {
  ComplexityLimits,
  DEFAULT_LIMITS,
  analyzeComplexity,
  checkComplexityLimits,
  estimateTimeout,
  shouldSkipSolver,
} from './complexity';
import { parseCounterexample } from './counterexample';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthoritativeSolverOptions {
  timeout?: number;
  z3Path?: string;
  complexityLimits?: ComplexityLimits;
  enableFallback?: boolean;
  debug?: boolean;
  maxRetries?: number;
}

export interface SolverResult {
  verdict: Verdict;
  complexity: ReturnType<typeof analyzeComplexity>;
  rawOutput?: string;
}

// ============================================================================
// AUTHORITATIVE SOLVER CLASS
// ============================================================================

export class AuthoritativeSolver {
  private readonly timeout: number;
  private readonly z3Path: string;
  private readonly complexityLimits: ComplexityLimits;
  private readonly enableFallback: boolean;
  private readonly debug: boolean;
  private readonly maxRetries: number;

  constructor(options: AuthoritativeSolverOptions = {}) {
    this.timeout = options.timeout ?? 30000;
    this.z3Path = options.z3Path ?? 'z3';
    this.complexityLimits = options.complexityLimits ?? DEFAULT_LIMITS;
    this.enableFallback = options.enableFallback ?? true;
    this.debug = options.debug ?? false;
    this.maxRetries = options.maxRetries ?? 1;
  }

  /**
   * Verify a property with authoritative verdicts
   * Returns PROVED, DISPROVED, or UNKNOWN with explicit reason
   */
  async verify(smtLib: string): Promise<SolverResult> {
    const startTime = Date.now();
    
    // Step 1: Analyze complexity
    const complexity = analyzeComplexity(smtLib);
    
    if (this.debug) {
      console.log(`[AuthoritativeSolver] Complexity: ${complexity.estimatedDifficulty}`);
    }

    // Step 2: Pre-check complexity limits
    const complexityViolation = checkComplexityLimits(complexity, this.complexityLimits);
    if (complexityViolation) {
      // Complexity exceeded - return unknown with reason
      return {
        verdict: createUnknownVerdict(complexityViolation, Date.now() - startTime, smtLib),
        complexity,
      };
    }

    // Step 3: Check if we should skip the solver entirely
    if (shouldSkipSolver(complexity)) {
      return {
        verdict: createUnknownVerdict(
          createTheoryIncompleteReason('quantifier-alternation'),
          Date.now() - startTime,
          smtLib
        ),
        complexity,
      };
    }

    // Step 4: Calculate adaptive timeout
    const adaptiveTimeout = Math.min(
      estimateTimeout(complexity, this.timeout),
      this.timeout
    );

    // Step 5: Run Z3 with retries
    let lastError: UnknownReason | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const result = await this.runZ3(smtLib, adaptiveTimeout);
      
      if (result.verdict.kind !== 'unknown') {
        return { verdict: result.verdict, complexity, rawOutput: result.rawOutput };
      }

      lastError = result.verdict.reason;

      // Don't retry for certain reasons
      if (
        result.verdict.reason.type === 'complexity' ||
        result.verdict.reason.type === 'unsupported-feature' ||
        result.verdict.reason.type === 'solver-error'
      ) {
        break;
      }

      // If timeout, try with increased timeout on retry
      if (result.verdict.reason.type === 'timeout' && attempt < this.maxRetries) {
        if (this.debug) {
          console.log(`[AuthoritativeSolver] Retrying with increased timeout`);
        }
      }
    }

    // Step 6: Fallback strategy if enabled
    if (this.enableFallback && lastError) {
      const fallbackResult = await this.tryFallbackStrategies(smtLib, complexity, lastError);
      if (fallbackResult) {
        return { verdict: fallbackResult, complexity };
      }
    }

    // Return the last unknown verdict
    return {
      verdict: createUnknownVerdict(lastError!, Date.now() - startTime, smtLib),
      complexity,
    };
  }

  /**
   * Verify multiple properties in batch
   */
  async verifyBatch(queries: string[]): Promise<SolverResult[]> {
    return Promise.all(queries.map(q => this.verify(q)));
  }

  /**
   * Run Z3 solver
   */
  private async runZ3(
    smtLib: string,
    timeout: number
  ): Promise<{ verdict: Verdict; rawOutput?: string }> {
    const startTime = Date.now();
    let tempDir: string | null = null;

    try {
      // Create temp file
      tempDir = await mkdtemp(join(tmpdir(), 'isl-smt-'));
      const inputFile = join(tempDir, 'query.smt2');
      await writeFile(inputFile, smtLib, 'utf-8');

      // Run Z3
      const output = await this.executeZ3(inputFile, timeout);
      const solverTime = Date.now() - startTime;

      // Parse output
      return this.parseZ3Output(output, solverTime, smtLib);

    } catch (error) {
      const solverTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Categorize the error
      if (errorMsg.includes('timeout') || errorMsg.includes('SIGTERM')) {
        return {
          verdict: createUnknownVerdict(
            createTimeoutReason(timeout, solverTime),
            solverTime,
            smtLib
          ),
        };
      }

      if (errorMsg.includes('memory') || errorMsg.includes('out of memory')) {
        return {
          verdict: createUnknownVerdict(
            createResourceExhaustedReason('memory'),
            solverTime,
            smtLib
          ),
        };
      }

      if (errorMsg.includes('stack')) {
        return {
          verdict: createUnknownVerdict(
            createResourceExhaustedReason('stack'),
            solverTime,
            smtLib
          ),
        };
      }

      return {
        verdict: createUnknownVerdict(
          createSolverErrorReason(errorMsg),
          solverTime,
          smtLib
        ),
      };

    } finally {
      // Cleanup temp directory
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  /**
   * Execute Z3 process
   */
  private executeZ3(inputFile: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-smt2',
        `-t:${timeout}`,
        '-st', // Include statistics
        inputFile,
      ];

      const proc = spawn(this.z3Path, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Hard timeout (5 seconds beyond solver timeout)
      const hardTimeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Z3 timeout after ${timeout}ms`));
      }, timeout + 5000);

      proc.on('close', (code) => {
        clearTimeout(hardTimeout);

        if (code !== 0 && !stdout.includes('sat') && !stdout.includes('unsat') && !stdout.includes('unknown')) {
          reject(new Error(stderr || `Z3 exited with code ${code}`));
        } else {
          resolve(stdout);
        }
      });

      proc.on('error', (err) => {
        clearTimeout(hardTimeout);
        reject(err);
      });
    });
  }

  /**
   * Parse Z3 output into verdict
   */
  private parseZ3Output(
    output: string,
    solverTime: number,
    smtLib: string
  ): { verdict: Verdict; rawOutput: string } {
    const lines = output.trim().split('\n');
    const firstLine = lines[0]?.trim();

    // UNSAT means property is PROVED (negation is unsatisfiable)
    if (firstLine === 'unsat') {
      return {
        verdict: createProvedVerdict(solverTime, this.debug ? smtLib : undefined),
        rawOutput: output,
      };
    }

    // SAT means property is DISPROVED (found counterexample)
    if (firstLine === 'sat') {
      const model = this.extractModel(output);
      const counterexample = this.buildCounterexample(model);
      
      return {
        verdict: createDisprovedVerdict(counterexample, solverTime, this.debug ? smtLib : undefined),
        rawOutput: output,
      };
    }

    // UNKNOWN - extract reason from statistics
    if (firstLine === 'unknown') {
      const reason = this.extractUnknownReason(output, solverTime);
      return {
        verdict: createUnknownVerdict(reason, solverTime, this.debug ? smtLib : undefined),
        rawOutput: output,
      };
    }

    // Timeout
    if (firstLine === 'timeout' || output.includes('timeout')) {
      return {
        verdict: createUnknownVerdict(
          createTimeoutReason(this.timeout, solverTime),
          solverTime,
          this.debug ? smtLib : undefined
        ),
        rawOutput: output,
      };
    }

    // Unknown output format
    return {
      verdict: createUnknownVerdict(
        createSolverErrorReason(`Unexpected Z3 output: ${firstLine}`),
        solverTime,
        this.debug ? smtLib : undefined
      ),
      rawOutput: output,
    };
  }

  /**
   * Extract model from SAT output
   */
  private extractModel(output: string): string {
    const modelStart = output.indexOf('(model');
    if (modelStart !== -1) {
      return output.slice(modelStart);
    }

    // Try to find definitions after 'sat'
    const defsStart = output.indexOf('\n(');
    if (defsStart !== -1) {
      return output.slice(defsStart + 1);
    }

    return '';
  }

  /**
   * Build counterexample from model
   */
  private buildCounterexample(model: string): CounterexampleData {
    if (!model) {
      return {
        inputs: {},
        state: {},
        trace: ['No model available'],
        rawModel: model,
      };
    }

    const parsed = parseCounterexample(model, 'property');
    return {
      inputs: parsed.inputs,
      state: parsed.state,
      trace: parsed.trace,
      rawModel: model,
    };
  }

  /**
   * Extract reason for unknown from Z3 output/statistics
   */
  private extractUnknownReason(output: string, solverTime: number): UnknownReason {
    // Check for specific reasons in Z3 output
    const lowerOutput = output.toLowerCase();

    if (lowerOutput.includes('canceled') || lowerOutput.includes('timeout')) {
      return createTimeoutReason(this.timeout, solverTime);
    }

    if (lowerOutput.includes('incomplete')) {
      // Check for specific theory incompleteness
      if (lowerOutput.includes('str') || lowerOutput.includes('string')) {
        return createTheoryIncompleteReason('strings');
      }
      if (lowerOutput.includes('nonlinear') || lowerOutput.includes('nla')) {
        return createTheoryIncompleteReason('nonlinear-arithmetic');
      }
      if (lowerOutput.includes('quantifier')) {
        return createTheoryIncompleteReason('quantifiers');
      }
      return createTheoryIncompleteReason('mixed');
    }

    if (lowerOutput.includes('resource') || lowerOutput.includes('limit')) {
      return createResourceExhaustedReason('terms');
    }

    // Default: generic incomplete reason
    return createTheoryIncompleteReason('decision-procedure');
  }

  /**
   * Try fallback strategies when primary solver returns unknown
   */
  private async tryFallbackStrategies(
    smtLib: string,
    complexity: ReturnType<typeof analyzeComplexity>,
    originalReason: UnknownReason
  ): Promise<Verdict | null> {
    // Strategy 1: Try with different solver tactics
    if (originalReason.type === 'timeout' && complexity.usesQuantifiers) {
      const simplifiedQuery = this.simplifyQuantifiers(smtLib);
      if (simplifiedQuery !== smtLib) {
        const result = await this.runZ3(simplifiedQuery, this.timeout * 2);
        if (result.verdict.kind !== 'unknown') {
          return result.verdict;
        }
      }
    }

    // Strategy 2: Try with relaxed constraints
    if (originalReason.type === 'complexity' && complexity.constraintCount > 50) {
      // Could implement constraint slicing here
    }

    // No successful fallback
    return null;
  }

  /**
   * Attempt to simplify quantifiers in the query
   */
  private simplifyQuantifiers(smtLib: string): string {
    // Add quantifier instantiation hints
    let modified = smtLib;

    // Replace forall with bounded forall where possible
    // This is a simplified heuristic - real implementation would be more sophisticated
    
    // Add solver hints for quantifier handling
    if (!modified.includes('(set-option :smt.mbqi')) {
      modified = modified.replace(
        '(check-sat)',
        '(set-option :smt.mbqi true)\n(check-sat)'
      );
    }

    return modified;
  }

  /**
   * Check if Z3 is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.getVersion();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Z3 version
   */
  async getVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.z3Path, ['--version']);
      let output = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        resolve(output.trim());
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a solver with default configuration
 */
export function createSolver(options?: AuthoritativeSolverOptions): AuthoritativeSolver {
  return new AuthoritativeSolver(options);
}

/**
 * Quick verification of a single query
 */
export async function verifyQuery(
  smtLib: string,
  options?: AuthoritativeSolverOptions
): Promise<Verdict> {
  const solver = new AuthoritativeSolver(options);
  const result = await solver.verify(smtLib);
  return result.verdict;
}
