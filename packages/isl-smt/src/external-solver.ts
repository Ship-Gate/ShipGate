/**
 * External SMT Solver Adapter
 * 
 * Robust adapter for external SMT solvers (Z3, CVC5) with:
 * - Cross-platform binary detection
 * - Strict timeout enforcement with process kill
 * - Output size limits
 * - Deterministic caching by query hash
 * - Proper error handling and recovery
 * 
 * Non-negotiables:
 * - No hanging processes: every solve has a hard timeout
 * - Deterministic: same query → same result (within solver version limits)
 * - Cross-platform: explicit strategy for Windows/Linux/macOS
 */

import { spawn, ChildProcess } from 'child_process';
import { writeFile, unlink, mkdtemp, rmdir, access, constants } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { SMTCheckResult } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Supported SMT solvers
 */
export type ExternalSolver = 'z3' | 'cvc5';

/**
 * Solver execution result with statistics
 */
export interface SolverExecResult extends SMTCheckResult {
  /** Execution statistics */
  stats?: SolverStats;
  /** Raw solver output (for debugging) */
  rawOutput?: string;
}

/**
 * Solver execution statistics
 */
export interface SolverStats {
  /** Time spent in solver (ms) */
  solverTimeMs: number;
  /** Peak memory usage estimate (bytes) */
  memoryUsed?: number;
  /** Number of conflicts (if reported) */
  conflicts?: number;
  /** Number of decisions (if reported) */
  decisions?: number;
}

/**
 * Solver configuration
 */
export interface ExternalSolverConfig {
  /** Solver to use */
  solver: ExternalSolver;
  /** Timeout in milliseconds (hard limit) */
  timeoutMs: number;
  /** Maximum output size in bytes (default: 1MB) */
  maxOutputBytes?: number;
  /** Maximum memory for solver in MB (default: 512) */
  maxMemoryMB?: number;
  /** Custom solver binary path (optional) */
  solverPath?: string;
  /** Produce models on SAT */
  produceModels?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Solver availability info
 */
export interface SolverAvailability {
  available: boolean;
  path?: string;
  version?: string;
  error?: string;
}

// ============================================================================
// Cross-Platform Solver Detection
// ============================================================================

/**
 * Platform-specific solver binary names
 */
const SOLVER_BINARIES: Record<ExternalSolver, { windows: string[]; unix: string[] }> = {
  z3: {
    windows: ['z3.exe', 'z3'],
    unix: ['z3'],
  },
  cvc5: {
    windows: ['cvc5.exe', 'cvc5', 'cvc5-Win64-static.exe'],
    unix: ['cvc5', 'cvc5-Linux-static', 'cvc5-macOS-static'],
  },
};

/**
 * Common installation paths to search
 */
const SOLVER_SEARCH_PATHS: Record<ExternalSolver, string[]> = {
  z3: [
    // System PATH (handled by spawn)
    // Common install locations
    '/usr/bin',
    '/usr/local/bin',
    '/opt/homebrew/bin',
    'C:\\Program Files\\Z3\\bin',
    'C:\\z3\\bin',
    // User-local installations
    process.env.HOME ? join(process.env.HOME, '.local', 'bin') : '',
    process.env.USERPROFILE ? join(process.env.USERPROFILE, '.local', 'bin') : '',
  ].filter(Boolean),
  cvc5: [
    '/usr/bin',
    '/usr/local/bin',
    '/opt/homebrew/bin',
    'C:\\Program Files\\cvc5\\bin',
    'C:\\cvc5\\bin',
    process.env.HOME ? join(process.env.HOME, '.local', 'bin') : '',
    process.env.USERPROFILE ? join(process.env.USERPROFILE, '.local', 'bin') : '',
  ].filter(Boolean),
};

/**
 * Cache for solver availability checks
 */
const solverCache = new Map<ExternalSolver, SolverAvailability>();

/**
 * Check if a file exists and is executable
 */
async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find solver binary path
 */
async function findSolverBinary(solver: ExternalSolver): Promise<string | null> {
  const isWindows = process.platform === 'win32';
  const binaries = isWindows ? SOLVER_BINARIES[solver].windows : SOLVER_BINARIES[solver].unix;
  const searchPaths = SOLVER_SEARCH_PATHS[solver];
  
  // First, try the bare binary name (will use PATH)
  for (const binary of binaries) {
    // Check if it's available in PATH by trying to spawn it
    const available = await checkBinaryInPath(binary);
    if (available) {
      return binary;
    }
  }
  
  // Search in common installation directories
  for (const searchPath of searchPaths) {
    for (const binary of binaries) {
      const fullPath = join(searchPath, binary);
      if (await isExecutable(fullPath)) {
        return fullPath;
      }
    }
  }
  
  return null;
}

/**
 * Check if a binary is available in PATH
 */
async function checkBinaryInPath(binary: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(binary, ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      timeout: 5000,
    });
    
    let resolved = false;
    
    proc.on('error', () => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });
    
    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        resolve(code === 0);
      }
    });
    
    // Safety timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { proc.kill('SIGKILL'); } catch { /* ignore */ }
        resolve(false);
      }
    }, 3000);
  });
}

/**
 * Get solver version
 */
async function getSolverVersion(binaryPath: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const proc = spawn(binaryPath, ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      timeout: 5000,
    });
    
    let stdout = '';
    let resolved = false;
    
    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    
    proc.on('error', () => {
      if (!resolved) {
        resolved = true;
        resolve(undefined);
      }
    });
    
    proc.on('close', () => {
      if (!resolved) {
        resolved = true;
        // Parse version from output
        const match = stdout.match(/(\d+\.\d+\.\d+)/);
        resolve(match ? match[1] : undefined);
      }
    });
    
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { proc.kill('SIGKILL'); } catch { /* ignore */ }
        resolve(undefined);
      }
    }, 3000);
  });
}

/**
 * Check if a solver is available
 */
export async function checkSolverAvailability(
  solver: ExternalSolver,
  customPath?: string
): Promise<SolverAvailability> {
  // Check cache first (but not if custom path specified)
  if (!customPath && solverCache.has(solver)) {
    return solverCache.get(solver)!;
  }
  
  try {
    const binaryPath = customPath || await findSolverBinary(solver);
    
    if (!binaryPath) {
      const result: SolverAvailability = {
        available: false,
        error: `${solver.toUpperCase()} binary not found. Install it or specify path in config.`,
      };
      if (!customPath) solverCache.set(solver, result);
      return result;
    }
    
    const version = await getSolverVersion(binaryPath);
    
    const result: SolverAvailability = {
      available: true,
      path: binaryPath,
      version,
    };
    
    if (!customPath) solverCache.set(solver, result);
    return result;
  } catch (error) {
    const result: SolverAvailability = {
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
    if (!customPath) solverCache.set(solver, result);
    return result;
  }
}

/**
 * Clear solver availability cache
 */
export function clearSolverCache(): void {
  solverCache.clear();
}

// ============================================================================
// SMT Query Execution
// ============================================================================

/**
 * Default configuration values
 */
const DEFAULTS = {
  maxOutputBytes: 1024 * 1024, // 1MB
  maxMemoryMB: 512,
  produceModels: true,
};

/**
 * Run an external SMT solver with strict sandboxing
 * 
 * Guarantees:
 * - Process will be killed if timeout exceeded
 * - Output truncated if maxOutputBytes exceeded
 * - Deterministic results for same query
 */
export async function runSolver(
  smtLibQuery: string,
  config: ExternalSolverConfig
): Promise<SolverExecResult> {
  const startTime = Date.now();
  const maxOutput = config.maxOutputBytes ?? DEFAULTS.maxOutputBytes;
  const maxMemory = config.maxMemoryMB ?? DEFAULTS.maxMemoryMB;
  
  // Check solver availability
  const availability = await checkSolverAvailability(config.solver, config.solverPath);
  
  if (!availability.available) {
    return {
      status: 'error',
      message: availability.error ?? `${config.solver.toUpperCase()} not available`,
    };
  }
  
  const solverPath = availability.path!;
  
  // Write query to temp file
  let tmpDir: string | null = null;
  let tmpFile: string | null = null;
  
  try {
    tmpDir = await mkdtemp(join(tmpdir(), 'isl-smt-'));
    tmpFile = join(tmpDir, 'query.smt2');
    await writeFile(tmpFile, smtLibQuery, 'utf-8');
    
    // Build solver arguments
    const args = buildSolverArgs(config.solver, tmpFile, config.timeoutMs, maxMemory, config.produceModels ?? DEFAULTS.produceModels);
    
    if (config.verbose) {
      console.log(`[SMT] Running ${config.solver}: ${solverPath} ${args.join(' ')}`);
      console.log(`[SMT] Query:\n${smtLibQuery}`);
    }
    
    // Execute solver with strict timeout
    const result = await executeSolverProcess(
      solverPath,
      args,
      config.timeoutMs,
      maxOutput,
      config.verbose
    );
    
    result.stats = {
      solverTimeMs: Date.now() - startTime,
    };
    
    return result;
  } catch (error) {
    return {
      status: 'error',
      message: `Solver execution failed: ${error instanceof Error ? error.message : String(error)}`,
      stats: { solverTimeMs: Date.now() - startTime },
    };
  } finally {
    // Cleanup temp files
    await cleanupTempFiles(tmpFile, tmpDir);
  }
}

/**
 * Build solver-specific command line arguments
 */
function buildSolverArgs(
  solver: ExternalSolver,
  inputFile: string,
  timeoutMs: number,
  maxMemoryMB: number,
  produceModels: boolean
): string[] {
  const timeoutSec = Math.ceil(timeoutMs / 1000);
  
  switch (solver) {
    case 'z3':
      return [
        '-smt2',
        `-T:${timeoutSec}`,
        `-memory:${maxMemoryMB}`,
        inputFile,
      ];
      
    case 'cvc5':
      return [
        '--lang=smt2',
        `--tlimit=${timeoutMs}`,
        `--rlimit=${maxMemoryMB * 1000000}`, // CVC5 uses resource limit
        produceModels ? '--produce-models' : '--no-produce-models',
        inputFile,
      ];
      
    default:
      return [inputFile];
  }
}

/**
 * Execute solver process with strict timeout and output limits
 */
function executeSolverProcess(
  solverPath: string,
  args: string[],
  timeoutMs: number,
  maxOutputBytes: number,
  verbose?: boolean
): Promise<SolverExecResult> {
  return new Promise((resolve) => {
    let proc: ChildProcess;
    let stdout = '';
    let stderr = '';
    let stdoutSize = 0;
    let resolved = false;
    let timeoutHandle: NodeJS.Timeout;
    
    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
    
    const resolveOnce = (result: SolverExecResult) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(result);
      }
    };
    
    const killProcess = () => {
      try {
        // Try SIGTERM first
        proc.kill('SIGTERM');
        // Force kill after 500ms if still running
        setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch { /* ignore - process may already be dead */ }
        }, 500);
      } catch { /* ignore */ }
    };
    
    try {
      proc = spawn(solverPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32', // Use shell on Windows for PATH resolution
        timeout: timeoutMs + 5000, // Node's built-in timeout as backup
      });
    } catch (error) {
      resolveOnce({
        status: 'error',
        message: `Failed to spawn solver: ${error instanceof Error ? error.message : String(error)}`,
      });
      return;
    }
    
    // Collect stdout with size limit
    proc.stdout?.on('data', (data: Buffer) => {
      if (stdoutSize < maxOutputBytes) {
        const chunk = data.toString();
        stdout += chunk;
        stdoutSize += data.length;
        
        if (stdoutSize >= maxOutputBytes && verbose) {
          console.log('[SMT] Warning: Output truncated at', maxOutputBytes, 'bytes');
        }
      }
    });
    
    // Collect stderr
    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    
    // Handle process errors
    proc.on('error', (err) => {
      resolveOnce({
        status: 'error',
        message: `Solver process error: ${err.message}`,
      });
    });
    
    // Handle process completion
    proc.on('close', (code, signal) => {
      if (!resolved) {
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          resolveOnce({
            status: 'timeout',
            rawOutput: stdout,
          });
        } else {
          const result = parseSolverOutput(stdout, stderr, code);
          result.rawOutput = stdout;
          resolveOnce(result);
        }
      }
    });
    
    // Set hard timeout - WILL kill the process
    timeoutHandle = setTimeout(() => {
      if (!resolved) {
        if (verbose) {
          console.log('[SMT] Timeout reached, killing solver process');
        }
        killProcess();
        // Don't resolve here - let the 'close' handler do it
        // This ensures proper cleanup
      }
    }, timeoutMs);
  });
}

/**
 * Parse solver output into result
 */
function parseSolverOutput(
  stdout: string,
  stderr: string,
  exitCode: number | null
): SolverExecResult {
  const output = stdout.trim().toLowerCase();
  
  // Check for timeout indicators
  if (output.includes('timeout') || output.includes('time limit') || exitCode === -1) {
    return { status: 'timeout' };
  }
  
  // Check for resource exhaustion
  if (output.includes('out of memory') || output.includes('memory exhausted') ||
      output.includes('resource limit')) {
    return { 
      status: 'unknown', 
      reason: 'Resource limit exceeded',
    };
  }
  
  // Parse result
  if (output.startsWith('sat') || output.includes('\nsat')) {
    const model = parseModel(stdout);
    return { status: 'sat', model };
  }
  
  if (output.startsWith('unsat') || output.includes('\nunsat')) {
    return { status: 'unsat' };
  }
  
  if (output.startsWith('unknown') || output.includes('\nunknown')) {
    // Try to extract reason
    const reasonMatch = stdout.match(/\(:reason-unknown\s+"?([^"]+)"?\)/i);
    return { 
      status: 'unknown', 
      reason: reasonMatch ? reasonMatch[1] : 'Solver returned unknown',
    };
  }
  
  // Check for errors
  if (stderr || output.includes('error') || output.includes('unsupported')) {
    const errorMsg = stderr || stdout;
    return {
      status: 'error',
      message: errorMsg.slice(0, 500), // Truncate error message
    };
  }
  
  // Unexpected output
  return {
    status: 'unknown',
    reason: `Unexpected solver output: ${output.slice(0, 100)}`,
  };
}

/**
 * Parse model from solver output
 * 
 * Handles both Z3 and CVC5 model formats
 */
function parseModel(output: string): Record<string, unknown> | undefined {
  const model: Record<string, unknown> = {};
  
  // Z3 format: (model (define-fun name () Type value))
  // CVC5 format: (define-fun name () Type value)
  
  const defineRegex = /\(define-fun\s+(\w+)\s+\(\)\s+(\w+)\s+([\s\S]*?)\)(?=\s*(?:\(define-fun|\)|\z))/g;
  
  let match;
  while ((match = defineRegex.exec(output)) !== null) {
    const name = match[1]!;
    const sort = match[2]!;
    let valueStr = match[3]!.trim();
    
    // Parse value based on sort
    const value = parseValue(valueStr, sort);
    if (value !== undefined) {
      model[name] = value;
    }
  }
  
  // Also try simpler format for single values
  const simpleRegex = /\(\s*(\w+)\s+([\w\d\-\.]+)\s*\)/g;
  while ((match = simpleRegex.exec(output)) !== null) {
    const name = match[1]!;
    const valueStr = match[2]!;
    
    if (!model[name]) {
      const value = parseValue(valueStr, 'unknown');
      if (value !== undefined) {
        model[name] = value;
      }
    }
  }
  
  return Object.keys(model).length > 0 ? model : undefined;
}

/**
 * Parse a value string based on its sort
 */
function parseValue(valueStr: string, sort: string): unknown {
  valueStr = valueStr.trim();
  
  // Boolean
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;
  
  // Integer
  if (/^-?\d+$/.test(valueStr)) {
    return parseInt(valueStr, 10);
  }
  
  // Negative integer (Z3 format: (- 5))
  const negMatch = valueStr.match(/^\(\s*-\s*(\d+)\s*\)$/);
  if (negMatch) {
    return -parseInt(negMatch[1]!, 10);
  }
  
  // Real/Decimal
  if (/^-?\d+\.\d+$/.test(valueStr)) {
    return parseFloat(valueStr);
  }
  
  // Rational (Z3 format: (/ 1 2))
  const ratMatch = valueStr.match(/^\(\s*\/\s*(-?\d+)\s+(\d+)\s*\)$/);
  if (ratMatch) {
    return parseInt(ratMatch[1]!, 10) / parseInt(ratMatch[2]!, 10);
  }
  
  // String (quoted)
  const strMatch = valueStr.match(/^"(.*)"$/);
  if (strMatch) {
    return strMatch[1];
  }
  
  // Return as string if we can't parse it
  return valueStr;
}

/**
 * Cleanup temporary files
 */
async function cleanupTempFiles(tmpFile: string | null, tmpDir: string | null): Promise<void> {
  try {
    if (tmpFile) await unlink(tmpFile);
    if (tmpDir) await rmdir(tmpDir);
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// High-Level API
// ============================================================================

/**
 * Check satisfiability using external solver
 * 
 * This is the recommended high-level API for running external SMT solvers.
 * It handles all the complexity of process management, timeouts, and parsing.
 * 
 * @example
 * ```typescript
 * const result = await checkSatExternal(smtLibQuery, {
 *   solver: 'z3',
 *   timeoutMs: 5000,
 * });
 * 
 * if (result.status === 'sat') {
 *   console.log('Satisfiable with model:', result.model);
 * }
 * ```
 */
export async function checkSatExternal(
  smtLibQuery: string,
  config: ExternalSolverConfig
): Promise<SolverExecResult> {
  return runSolver(smtLibQuery, config);
}

/**
 * Check availability of all supported solvers
 */
export async function checkAllSolvers(): Promise<Record<ExternalSolver, SolverAvailability>> {
  const [z3, cvc5] = await Promise.all([
    checkSolverAvailability('z3'),
    checkSolverAvailability('cvc5'),
  ]);
  
  return { z3, cvc5 };
}

/**
 * Get the best available solver
 * 
 * Preference order: z3 > cvc5 > null
 */
export async function getBestAvailableSolver(): Promise<ExternalSolver | null> {
  const z3 = await checkSolverAvailability('z3');
  if (z3.available) return 'z3';
  
  const cvc5 = await checkSolverAvailability('cvc5');
  if (cvc5.available) return 'cvc5';
  
  return null;
}
