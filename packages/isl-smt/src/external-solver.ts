/**
 * External SMT Solver Adapter
 *
 * Robust adapter for external SMT solvers (Z3, CVC5) with:
 * - Cross-platform binary detection (Windows/macOS/Linux)
 * - Strict timeout enforcement with process kill
 * - Balanced-parenthesis SMT-LIB output parsing
 * - Retry on crash with solver fallback
 * - CVC5 feature-parity with Z3
 * - Output size limits
 * - Deterministic caching by query hash
 *
 * Non-negotiables:
 * - No hanging processes: every solve has a hard timeout
 * - Deterministic: same query → same result (within solver version limits)
 * - Cross-platform: explicit strategy for Windows/Linux/macOS
 * - Crash resilience: automatic retry + fallback to alternate solver
 */

import { spawn, execFile, type ChildProcess } from 'child_process';
import { writeFile, unlink, mkdtemp, rmdir, access, stat, constants } from 'fs/promises';
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
export type SolverExecResult = SMTCheckResult & {
  /** Execution statistics */
  stats?: SolverStats;
  /** Raw solver output (for debugging) */
  rawOutput?: string;
};

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
  /** Number of retry attempts before success */
  retryAttempts?: number;
  /** Solver that actually produced the result (may differ if fallback used) */
  actualSolver?: ExternalSolver;
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
  /** Maximum retry attempts on crash (default: 2) */
  maxRetries?: number;
  /** Fall back to alternate solver on failure (default: true) */
  fallbackOnFailure?: boolean;
}

/**
 * Solver availability info
 */
export interface SolverAvailability {
  available: boolean;
  path?: string;
  version?: string;
  error?: string;
  platform?: NodeJS.Platform;
}

/**
 * Solver availability matrix (all solvers, all info)
 */
export interface SolverAvailabilityMatrix {
  platform: NodeJS.Platform;
  arch: string;
  solvers: Record<ExternalSolver, SolverAvailability>;
  bestAvailable: ExternalSolver | null;
  timestamp: string;
}

// ============================================================================
// Cross-Platform Solver Detection
// ============================================================================

/**
 * Platform-specific solver binary names.
 *
 * Windows: .exe variants first, then bare name (resolved via `where`).
 * macOS: Homebrew arm64 + x64 paths, plus bare name.
 * Linux: bare name, plus common static-binary names from upstream releases.
 */
const SOLVER_BINARIES: Record<ExternalSolver, { windows: string[]; darwin: string[]; linux: string[] }> = {
  z3: {
    windows: ['z3.exe', 'z3'],
    darwin: ['z3'],
    linux: ['z3'],
  },
  cvc5: {
    windows: ['cvc5.exe', 'cvc5', 'cvc5-Win64-static.exe'],
    darwin: ['cvc5', 'cvc5-macOS-arm64-static', 'cvc5-macOS-static'],
    linux: ['cvc5', 'cvc5-Linux-static', 'cvc5-Linux-x86_64-static'],
  },
};

/**
 * Environment variables that may point to solver binaries.
 * Checked before any PATH walk.
 */
const SOLVER_ENV_VARS: Record<ExternalSolver, string[]> = {
  z3: ['Z3_PATH', 'Z3_BIN', 'Z3_SOLVER'],
  cvc5: ['CVC5_PATH', 'CVC5_BIN', 'CVC5_SOLVER'],
};

/**
 * Common installation paths by platform.
 * These are searched after PATH-based detection fails.
 */
function getSolverSearchPaths(solver: ExternalSolver): string[] {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const platform = process.platform;

  const common = [
    // User-local installations
    home ? join(home, '.local', 'bin') : '',
    home ? join(home, 'bin') : '',
  ].filter(Boolean);

  if (platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files';
    const localAppData = process.env['LOCALAPPDATA'] ?? '';
    return [
      // Standard install paths
      `${programFiles}\\${solver}\\bin`,
      `${programFiles}\\${solver.toUpperCase()}\\bin`,
      `C:\\${solver}\\bin`,
      // Chocolatey
      'C:\\ProgramData\\chocolatey\\bin',
      // Scoop
      localAppData ? join(localAppData, 'scoop', 'shims') : '',
      home ? join(home, 'scoop', 'shims') : '',
      // WinGet / standard paths
      `${programFiles}\\Microsoft\\WinGet\\Links`,
      ...common,
    ].filter(Boolean);
  }

  if (platform === 'darwin') {
    return [
      // Homebrew (Apple Silicon + Intel)
      '/opt/homebrew/bin',
      '/usr/local/bin',
      // MacPorts
      '/opt/local/bin',
      // Nix
      '/nix/var/nix/profiles/default/bin',
      ...common,
    ];
  }

  // Linux
  return [
    '/usr/bin',
    '/usr/local/bin',
    // Snap
    '/snap/bin',
    // Nix
    '/nix/var/nix/profiles/default/bin',
    // Linuxbrew
    '/home/linuxbrew/.linuxbrew/bin',
    ...common,
  ];
}

/**
 * Cache for solver availability checks.
 * Keyed by "solver:customPath" to avoid stale results when customPath differs.
 */
const solverCache = new Map<string, SolverAvailability>();

function cacheKey(solver: ExternalSolver, customPath?: string): string {
  return customPath ? `${solver}:${customPath}` : solver;
}

/**
 * Check if a file exists and is likely executable.
 *
 * On Windows, `X_OK` is meaningless (Node falls back to `F_OK`), so we
 * stat the file and check for a reasonable extension or simply that it exists.
 */
async function isExecutable(filePath: string): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      // On Windows, X_OK is not meaningful. Just check the file exists and
      // is a regular file.
      const info = await stat(filePath);
      return info.isFile();
    }
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a solver binary via the system `where` (Windows) or `which` (POSIX).
 * Returns the resolved path or null.
 */
async function resolveViaSystem(binary: string): Promise<string | null> {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  return new Promise((resolve) => {
    execFile(cmd, [binary], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null);
        return;
      }
      // `where` on Windows can return multiple lines; take the first.
      const firstLine = stdout.trim().split(/\r?\n/)[0]?.trim();
      resolve(firstLine || null);
    });
  });
}

/**
 * Check if a binary is reachable in PATH by spawning `--version`.
 * Returns true only if the process exits with code 0.
 */
async function checkBinaryInPath(binary: string): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (ok: boolean) => {
      if (!resolved) { resolved = true; resolve(ok); }
    };

    let proc: ChildProcess;
    try {
      proc = spawn(binary, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        // On Windows, use shell so that PATH and PATHEXT are respected.
        shell: process.platform === 'win32',
        timeout: 5000,
        windowsHide: true,
      });
    } catch {
      done(false);
      return;
    }

    proc.on('error', () => done(false));
    proc.on('close', (code) => done(code === 0));

    // Hard safety timeout
    setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* ignore */ }
      done(false);
    }, 4000);
  });
}

/**
 * Find solver binary path using a multi-strategy search:
 *
 * 1. Environment variable override (Z3_PATH, CVC5_PATH, ...)
 * 2. System `where`/`which` resolution
 * 3. Spawn-based PATH probe
 * 4. Exhaustive search of known installation directories
 */
async function findSolverBinary(solver: ExternalSolver): Promise<string | null> {
  const platform = process.platform;
  const binaries =
    platform === 'win32' ? SOLVER_BINARIES[solver].windows :
    platform === 'darwin' ? SOLVER_BINARIES[solver].darwin :
    SOLVER_BINARIES[solver].linux;

  // ---- Strategy 1: Environment variable override ----
  for (const envVar of SOLVER_ENV_VARS[solver]) {
    const envPath = process.env[envVar];
    if (envPath && await isExecutable(envPath)) {
      return envPath;
    }
  }

  // ---- Strategy 2: System `where`/`which` ----
  for (const binary of binaries) {
    const resolved = await resolveViaSystem(binary);
    if (resolved && await isExecutable(resolved)) {
      return resolved;
    }
  }

  // ---- Strategy 3: spawn-based PATH probe (fallback for edge cases) ----
  for (const binary of binaries) {
    if (await checkBinaryInPath(binary)) {
      return binary;
    }
  }

  // ---- Strategy 4: Search known installation directories ----
  const searchPaths = getSolverSearchPaths(solver);
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
 * Get solver version string from `--version` output.
 */
async function getSolverVersion(binaryPath: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (v: string | undefined) => {
      if (!resolved) { resolved = true; resolve(v); }
    };

    let proc: ChildProcess;
    try {
      proc = spawn(binaryPath, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
        timeout: 5000,
        windowsHide: true,
      });
    } catch {
      done(undefined);
      return;
    }

    let stdout = '';
    proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.on('error', () => done(undefined));
    proc.on('close', () => {
      const match = stdout.match(/(\d+\.\d+\.\d+)/);
      done(match ? match[1] : stdout.trim().slice(0, 60) || undefined);
    });

    setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* ignore */ }
      done(undefined);
    }, 4000);
  });
}

/**
 * Check if a specific solver is available on this system.
 *
 * Results are cached by (solver, customPath) pair.  Call `clearSolverCache()`
 * to force re-detection.
 */
export async function checkSolverAvailability(
  solver: ExternalSolver,
  customPath?: string
): Promise<SolverAvailability> {
  const key = cacheKey(solver, customPath);
  if (solverCache.has(key)) {
    return solverCache.get(key)!;
  }

  try {
    if (customPath && !(await isExecutable(customPath))) {
      const result: SolverAvailability = {
        available: false,
        error: `Solver path is not executable or does not exist: ${customPath}`,
        platform: process.platform,
      };
      solverCache.set(key, result);
      return result;
    }

    const binaryPath = customPath || await findSolverBinary(solver);

    if (!binaryPath) {
      const result: SolverAvailability = {
        available: false,
        error: `${solver.toUpperCase()} binary not found. Install it or set ${SOLVER_ENV_VARS[solver][0]} environment variable.`,
        platform: process.platform,
      };
      solverCache.set(key, result);
      return result;
    }

    const version = await getSolverVersion(binaryPath);

    const result: SolverAvailability = {
      available: true,
      path: binaryPath,
      version,
      platform: process.platform,
    };

    solverCache.set(key, result);
    return result;
  } catch (error) {
    const result: SolverAvailability = {
      available: false,
      error: error instanceof Error ? error.message : String(error),
      platform: process.platform,
    };
    solverCache.set(key, result);
    return result;
  }
}

/**
 * Clear solver availability cache, forcing re-detection on next call.
 */
export function clearSolverCache(): void {
  solverCache.clear();
}

// ============================================================================
// Solver CLI Argument Builders
// ============================================================================

/**
 * Build solver-specific command line arguments.
 *
 * CVC5 parity: uses `--tlimit-per` for per-query wall-clock limit (not
 * `--tlimit` which is process-total), `--produce-models`, and
 * `--finite-model-find` for finite domains.
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
        ...(produceModels ? ['model=true'] : []),
        inputFile,
      ];

    case 'cvc5':
      return [
        '--lang=smt2',
        `--tlimit-per=${timeoutMs}`,
        produceModels ? '--produce-models' : '--no-produce-models',
        '--finite-model-find',
        '--strings-exp',       // extended string support
        inputFile,
      ];

    default:
      return [inputFile];
  }
}

// ============================================================================
// SMT-LIB Output Parsing (Balanced Parenthesis Aware)
// ============================================================================

/**
 * Find matching closing parenthesis, respecting nesting and string literals.
 */
function findMatchingParen(text: string, openIdx: number): number {
  let depth = 0;
  let inString = false;

  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (ch === '"' && text[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1; // unbalanced
}

/**
 * Strip SMT-LIB comments (lines starting with `;`).
 */
function stripComments(output: string): string {
  return output
    .split('\n')
    .map((line) => (line.trimStart().startsWith(';') ? '' : line))
    .join('\n');
}

/**
 * Extract the first result keyword from solver output.
 *
 * The result keyword is the first non-comment, non-empty line that is
 * exactly "sat", "unsat", or "unknown".
 */
function extractResultKeyword(output: string): 'sat' | 'unsat' | 'unknown' | null {
  const stripped = stripComments(output);
  const lines = stripped.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower === 'sat') return 'sat';
    if (lower === 'unsat') return 'unsat';
    if (lower === 'unknown') return 'unknown';
    // Some solvers emit result with trailing parens or extra info; check prefix.
    if (/^sat\b/.test(lower)) return 'sat';
    if (/^unsat\b/.test(lower)) return 'unsat';
    if (/^unknown\b/.test(lower)) return 'unknown';
  }

  return null;
}

/**
 * Extract the model block from solver output.
 *
 * Handles both Z3-style `(model ...)` wrapper and CVC5-style bare
 * `(define-fun ...)` sequences.
 */
function extractModelBlock(output: string): string | null {
  // Look for `(model` wrapper first (Z3 style)
  const modelIdx = output.indexOf('(model');
  if (modelIdx !== -1) {
    const closeIdx = findMatchingParen(output, modelIdx);
    if (closeIdx !== -1) {
      return output.slice(modelIdx, closeIdx + 1);
    }
  }

  // CVC5 style: bare define-fun sequences after "sat"
  const defineFunIdx = output.indexOf('(define-fun');
  if (defineFunIdx !== -1) {
    // Collect all consecutive define-fun blocks
    let block = '';
    let pos = defineFunIdx;
    while (pos < output.length) {
      const nextDef = output.indexOf('(define-fun', pos);
      if (nextDef === -1 || (block && nextDef - pos > 100)) break; // gap = end of model
      const closeIdx = findMatchingParen(output, nextDef);
      if (closeIdx === -1) break;
      block += output.slice(nextDef, closeIdx + 1) + '\n';
      pos = closeIdx + 1;
    }
    return block.trim() || null;
  }

  return null;
}

/**
 * Parse a single define-fun block into a (name, value) pair.
 *
 * Format: `(define-fun NAME () SORT VALUE)`
 * VALUE may be a nested s-expression.
 */
function parseDefineFun(block: string): { name: string; sort: string; value: string } | null {
  // Skip "(define-fun "
  const prefix = '(define-fun ';
  const idx = block.indexOf(prefix);
  if (idx === -1) return null;

  let pos = idx + prefix.length;

  // Parse name (until whitespace)
  const nameEnd = block.indexOf(' ', pos);
  if (nameEnd === -1) return null;
  const name = block.slice(pos, nameEnd).trim();
  pos = nameEnd + 1;

  // Skip parameter list "()" — find the matching close paren
  const paramOpen = block.indexOf('(', pos);
  if (paramOpen === -1) return null;
  const paramClose = findMatchingParen(block, paramOpen);
  if (paramClose === -1) return null;
  pos = paramClose + 1;

  // Skip whitespace
  while (pos < block.length && /\s/.test(block[pos]!)) pos++;

  // Parse sort: either a bare word or an s-expression like (Array Int Int)
  let sort: string;
  if (block[pos] === '(') {
    const sortClose = findMatchingParen(block, pos);
    if (sortClose === -1) return null;
    sort = block.slice(pos, sortClose + 1);
    pos = sortClose + 1;
  } else {
    const sortEnd = block.indexOf(' ', pos);
    if (sortEnd === -1) return null;
    sort = block.slice(pos, sortEnd).trim();
    pos = sortEnd + 1;
  }

  // Skip whitespace
  while (pos < block.length && /\s/.test(block[pos]!)) pos++;

  // Remaining until the last `)` is the value
  // Find the closing paren of the outer define-fun
  let endPos = block.length - 1;
  while (endPos > pos && block[endPos] !== ')') endPos--;
  const value = block.slice(pos, endPos).trim();

  return value ? { name, sort, value } : null;
}

/**
 * Parse a value string based on its sort.
 */
function parseValue(valueStr: string, _sort: string): unknown {
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

  // Negative rational — (/ (- 1) 2)
  const negRatMatch = v.match(/^\(\s*\/\s*\(\s*-\s*(\d+)\s*\)\s+(\d+)\s*\)$/);
  if (negRatMatch) {
    return -parseInt(negRatMatch[1]!, 10) / parseInt(negRatMatch[2]!, 10);
  }

  // Bitvector literal — #b0101 or #x1f
  if (v.startsWith('#b')) {
    return parseInt(v.slice(2), 2);
  }
  if (v.startsWith('#x')) {
    return parseInt(v.slice(2), 16);
  }

  // String (quoted)
  const strMatch = v.match(/^"((?:[^"\\]|\\.)*)"$/);
  if (strMatch) {
    return strMatch[1]!.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  // Fallback: return as string
  return v;
}

/**
 * Parse model from solver output using balanced-parenthesis aware extraction.
 *
 * Handles both Z3 and CVC5 model formats.
 */
function parseModel(output: string): Record<string, unknown> | undefined {
  const model: Record<string, unknown> = {};
  const block = extractModelBlock(output);
  if (!block) return undefined;

  // Find all define-fun blocks
  let pos = 0;
  while (pos < block.length) {
    const defIdx = block.indexOf('(define-fun', pos);
    if (defIdx === -1) break;

    const closeIdx = findMatchingParen(block, defIdx);
    if (closeIdx === -1) break;

    const defBlock = block.slice(defIdx, closeIdx + 1);
    const parsed = parseDefineFun(defBlock);
    if (parsed) {
      const value = parseValue(parsed.value, parsed.sort);
      if (value !== undefined) {
        model[parsed.name] = value;
      }
    }

    pos = closeIdx + 1;
  }

  return Object.keys(model).length > 0 ? model : undefined;
}

/**
 * Parse solver output into structured result.
 *
 * Uses keyword extraction (not substring matching) to determine sat/unsat/unknown,
 * and balanced-parenthesis parsing for model extraction.
 */
function parseSolverOutput(
  stdout: string,
  stderr: string,
  exitCode: number | null
): SolverExecResult {
  const strippedStdout = stripComments(stdout).trim();

  // ---- Check for CVC5 / Z3 structured error ----
  const errorMatch = strippedStdout.match(/^\(error\s+"(.+?)"\)/m) ??
                     stderr.match(/^\(error\s+"(.+?)"\)/m);
  if (errorMatch) {
    return {
      status: 'error',
      message: errorMatch[1]!.slice(0, 500),
    };
  }

  // ---- Timeout indicators (solver-reported) ----
  const lowerStdout = strippedStdout.toLowerCase();
  const keywordEarly = extractResultKeyword(strippedStdout);
  if (
    (lowerStdout.includes('timeout') ||
      lowerStdout.includes('time limit') ||
      lowerStdout.includes('rlimit') ||
      exitCode === -1) &&
    keywordEarly !== 'sat' &&
    keywordEarly !== 'unsat' &&
    keywordEarly !== 'unknown'
  ) {
    return { status: 'timeout' };
  }

  // ---- Resource exhaustion ----
  if (
    lowerStdout.includes('out of memory') ||
    lowerStdout.includes('memory exhausted') ||
    stderr.toLowerCase().includes('out of memory')
  ) {
    return {
      status: 'unknown',
      reason: 'Resource limit exceeded (out of memory)',
    };
  }

  // ---- Extract result keyword ----
  const keyword = extractResultKeyword(strippedStdout);

  if (keyword === 'sat') {
    const modelData = parseModel(stdout);
    return { status: 'sat', model: modelData };
  }

  if (keyword === 'unsat') {
    return { status: 'unsat' };
  }

  if (keyword === 'unknown') {
    const reasonMatch = stdout.match(/\(:reason-unknown\s+"?([^")\n]+)"?\)/i);
    return {
      status: 'unknown',
      reason: reasonMatch ? reasonMatch[1]!.trim() : 'Solver returned unknown',
    };
  }

  // ---- Non-zero exit without result keyword ----
  if (exitCode !== null && exitCode !== 0) {
    const errText = (stderr || stdout).slice(0, 500);
    return {
      status: 'error',
      message: `Solver exited with code ${exitCode}: ${errText}`,
    };
  }

  // ---- Stderr with errors ----
  if (stderr && (stderr.includes('error') || stderr.includes('Error'))) {
    return {
      status: 'error',
      message: stderr.slice(0, 500),
    };
  }

  // ---- Unsupported feature ----
  if (lowerStdout.includes('unsupported')) {
    return {
      status: 'error',
      message: `Unsupported feature: ${strippedStdout.slice(0, 200)}`,
    };
  }

  // ---- Empty output ----
  if (!strippedStdout) {
    return {
      status: 'error',
      message: stderr ? `Solver produced no output. stderr: ${stderr.slice(0, 300)}` : 'Solver produced no output',
    };
  }

  // ---- Fallback ----
  return {
    status: 'unknown',
    reason: `Unexpected solver output: ${strippedStdout.slice(0, 200)}`,
  };
}

// ============================================================================
// Process Execution with Timeout
// ============================================================================

/**
 * Default configuration values
 */
const DEFAULTS = {
  maxOutputBytes: 1024 * 1024, // 1MB
  maxMemoryMB: 512,
  produceModels: true,
  maxRetries: 2,
  fallbackOnFailure: true,
} as const;

/**
 * Signals that indicate a solver crash (vs. graceful exit).
 */
const CRASH_SIGNALS = new Set(['SIGSEGV', 'SIGBUS', 'SIGABRT', 'SIGILL', 'SIGFPE']);

/**
 * Exit codes that indicate a solver crash.
 * 139 = SIGSEGV on Linux, -1073741819 = access violation on Windows.
 */
const CRASH_EXIT_CODES = new Set([-1, 134, 136, 139, -1073741819, -1073741571]);

/**
 * Execute solver process with strict timeout and output limits.
 *
 * Returns structured result. Never throws.
 */
function executeSolverProcess(
  solverPath: string,
  args: string[],
  timeoutMs: number,
  maxOutputBytes: number,
  verbose?: boolean
): Promise<SolverExecResult & { crashed: boolean }> {
  return new Promise((resolve) => {
    let proc: ChildProcess;
    let stdout = '';
    let stderr = '';
    let stdoutSize = 0;
    let resolved = false;
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };

    const resolveOnce = (result: SolverExecResult & { crashed: boolean }) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(result);
      }
    };

    const killProcess = () => {
      try {
        if (process.platform === 'win32') {
          // On Windows, SIGTERM is unreliable; use taskkill via spawn.
          if (proc.pid) {
            spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t'], {
              stdio: 'ignore',
              windowsHide: true,
            });
          }
        } else {
          proc.kill('SIGTERM');
          // Force kill after 1s if still running
          setTimeout(() => {
            try { proc.kill('SIGKILL'); } catch { /* process may already be dead */ }
          }, 1000);
        }
      } catch { /* ignore */ }
    };

    try {
      proc = spawn(solverPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        // Use shell on Windows for PATH and PATHEXT resolution.
        shell: process.platform === 'win32',
        timeout: timeoutMs + 5000, // Node built-in timeout as backup
        windowsHide: true,
      });
    } catch (error) {
      resolveOnce({
        status: 'error',
        message: `Failed to spawn solver: ${error instanceof Error ? error.message : String(error)}`,
        crashed: true,
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
          process.stderr.write(`[SMT] Warning: Output truncated at ${maxOutputBytes} bytes\n`);
        }
      }
    });

    // Collect stderr
    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Handle process errors (ENOENT, EACCES, etc.)
    proc.on('error', (err) => {
      resolveOnce({
        status: 'error',
        message: `Solver process error: ${err.message}`,
        crashed: true,
      });
    });

    // Handle process completion
    proc.on('close', (code, signal) => {
      if (resolved) return;

      // Determine if this was a crash
      const crashed =
        (signal !== null && CRASH_SIGNALS.has(signal)) ||
        (code !== null && CRASH_EXIT_CODES.has(code));

      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        resolveOnce({
          status: 'timeout',
          rawOutput: stdout,
          crashed: false,
        });
        return;
      }

      if (crashed && !stdout.trim()) {
        resolveOnce({
          status: 'error',
          message: `Solver crashed (signal=${signal}, code=${code})`,
          rawOutput: stdout,
          crashed: true,
        });
        return;
      }

      const result = parseSolverOutput(stdout, stderr, code);
      result.rawOutput = stdout;
      resolveOnce({ ...result, crashed });
    });

    // Hard timeout — WILL kill the process
    timeoutHandle = setTimeout(() => {
      if (!resolved) {
        if (verbose) {
          process.stderr.write('[SMT] Timeout reached, killing solver process\n');
        }
        killProcess();
        // Let the 'close' handler resolve with timeout status.
      }
    }, timeoutMs);
  });
}

// ============================================================================
// Retry + Fallback Logic
// ============================================================================

/**
 * Alternate solver for fallback.
 */
function alternateSolver(solver: ExternalSolver): ExternalSolver {
  return solver === 'z3' ? 'cvc5' : 'z3';
}

/**
 * Run an external SMT solver with strict sandboxing, retry, and fallback.
 *
 * Guarantees:
 * - Process will be killed if timeout exceeded
 * - Output truncated if maxOutputBytes exceeded
 * - Crashes are retried up to `maxRetries` times with backoff
 * - On persistent failure, falls back to alternate solver (if available)
 * - Deterministic results for same query (cache is external to this function)
 */
export async function runSolver(
  smtLibQuery: string,
  config: ExternalSolverConfig
): Promise<SolverExecResult> {
  const startTime = Date.now();
  const maxOutput = config.maxOutputBytes ?? DEFAULTS.maxOutputBytes;
  const maxMemory = config.maxMemoryMB ?? DEFAULTS.maxMemoryMB;
  const maxRetries = config.maxRetries ?? DEFAULTS.maxRetries;
  const fallbackOnFailure = config.fallbackOnFailure ?? DEFAULTS.fallbackOnFailure;

  // ---------- Try primary solver ----------
  const primaryResult = await runSolverWithRetry(
    smtLibQuery,
    config.solver,
    config.solverPath,
    config.timeoutMs,
    maxOutput,
    maxMemory,
    config.produceModels ?? DEFAULTS.produceModels,
    maxRetries,
    config.verbose,
  );

  if (primaryResult) {
    primaryResult.stats = {
      ...primaryResult.stats,
      solverTimeMs: Date.now() - startTime,
      actualSolver: config.solver,
    };
    return primaryResult;
  }

  // ---------- Fallback to alternate solver ----------
  if (fallbackOnFailure) {
    const alt = alternateSolver(config.solver);
    const altAvail = await checkSolverAvailability(alt);

    if (altAvail.available) {
      if (config.verbose) {
        process.stderr.write(`[SMT] Primary solver ${config.solver} failed, falling back to ${alt}\n`);
      }

      const fallbackResult = await runSolverWithRetry(
        smtLibQuery,
        alt,
        undefined, // use detected path
        config.timeoutMs,
        maxOutput,
        maxMemory,
        config.produceModels ?? DEFAULTS.produceModels,
        1, // single attempt for fallback
        config.verbose,
      );

      if (fallbackResult) {
        fallbackResult.stats = {
          ...fallbackResult.stats,
          solverTimeMs: Date.now() - startTime,
          actualSolver: alt,
        };
        return fallbackResult;
      }
    }
  }

  // ---------- Total failure ----------
  return {
    status: 'error',
    message: `All solver attempts failed for ${config.solver}`,
    stats: { solverTimeMs: Date.now() - startTime },
  };
}

/**
 * Run solver with retry logic. Returns result or null if all attempts failed
 * with crashes/spawn errors.
 */
async function runSolverWithRetry(
  smtLibQuery: string,
  solver: ExternalSolver,
  customPath: string | undefined,
  timeoutMs: number,
  maxOutputBytes: number,
  maxMemoryMB: number,
  produceModels: boolean,
  maxRetries: number,
  verbose?: boolean,
): Promise<SolverExecResult | null> {
  // Check solver availability
  const availability = await checkSolverAvailability(solver, customPath);
  if (!availability.available) {
    return {
      status: 'error',
      message: availability.error ?? `${solver.toUpperCase()} not available`,
    };
  }

  const solverPath = availability.path!;
  let lastResult: SolverExecResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Exponential backoff on retries: 0ms, 100ms, 400ms, ...
    if (attempt > 0) {
      const backoffMs = 100 * Math.pow(2, attempt - 1);
      if (verbose) {
        process.stderr.write(`[SMT] Retry attempt ${attempt}/${maxRetries} after ${backoffMs}ms backoff\n`);
      }
      await sleep(backoffMs);
    }

    // Write query to temp file
    let tmpDir: string | null = null;
    let tmpFile: string | null = null;

    try {
      tmpDir = await mkdtemp(join(tmpdir(), 'isl-smt-'));
      tmpFile = join(tmpDir, 'query.smt2');
      await writeFile(tmpFile, smtLibQuery, 'utf-8');

      const args = buildSolverArgs(solver, tmpFile, timeoutMs, maxMemoryMB, produceModels);

      if (verbose) {
        process.stderr.write(`[SMT] Running ${solver}: ${solverPath} ${args.join(' ')}\n`);
      }

      const result = await executeSolverProcess(
        solverPath,
        args,
        timeoutMs,
        maxOutputBytes,
        verbose,
      );

      lastResult = result;

      // If the solver crashed, retry; otherwise return the result.
      if (!result.crashed) {
        result.stats = {
          ...result.stats,
          retryAttempts: attempt,
        };
        return result;
      }

      if (verbose) {
        const msg = result.status === 'error' ? result.message : result.status;
        process.stderr.write(`[SMT] Solver crashed on attempt ${attempt}: ${msg}\n`);
      }
    } catch (error) {
      lastResult = {
        status: 'error',
        message: `Solver execution failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      await cleanupTempFiles(tmpFile, tmpDir);
    }
  }

  // All retries exhausted — return the last result or null to trigger fallback.
  if (lastResult && lastResult.status !== 'error') {
    return lastResult;
  }
  return null;
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cleanup temporary files safely.
 */
async function cleanupTempFiles(tmpFile: string | null, tmpDir: string | null): Promise<void> {
  try {
    if (tmpFile) await unlink(tmpFile);
    if (tmpDir) await rmdir(tmpDir);
  } catch {
    // Ignore cleanup errors — files may already be gone.
  }
}

// ============================================================================
// High-Level API
// ============================================================================

/**
 * Check satisfiability using external solver.
 *
 * This is the recommended high-level API for running external SMT solvers.
 * It handles all the complexity of process management, timeouts, retries,
 * fallback, and parsing.
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
 * Check availability of all supported solvers.
 */
export async function checkAllSolvers(): Promise<Record<ExternalSolver, SolverAvailability>> {
  const [z3, cvc5] = await Promise.all([
    checkSolverAvailability('z3'),
    checkSolverAvailability('cvc5'),
  ]);

  return { z3, cvc5 };
}

/**
 * Get the best available solver.
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

/**
 * Produce a full solver availability matrix for the current system.
 *
 * Useful for CI reporting, diagnostics, and documentation.
 */
export async function getSolverAvailabilityMatrix(): Promise<SolverAvailabilityMatrix> {
  const [z3, cvc5] = await Promise.all([
    checkSolverAvailability('z3'),
    checkSolverAvailability('cvc5'),
  ]);

  const best = z3.available ? 'z3' as ExternalSolver
    : cvc5.available ? 'cvc5' as ExternalSolver
    : null;

  return {
    platform: process.platform,
    arch: process.arch,
    solvers: { z3, cvc5 },
    bestAvailable: best,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Exported internals for testing
// ============================================================================

/** @internal — exported only for unit testing */
export const _testInternals = {
  findMatchingParen,
  stripComments,
  extractResultKeyword,
  extractModelBlock,
  parseDefineFun,
  parseValue,
  parseModel,
  parseSolverOutput,
  buildSolverArgs,
  findSolverBinary,
  getSolverSearchPaths,
  isExecutable,
  resolveViaSystem,
} as const;
