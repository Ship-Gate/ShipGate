// ============================================================================
// Z3 Solver Interface
// Handles communication with Z3 via subprocess
// ============================================================================

import { spawn, ChildProcess } from 'child_process';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface Z3Options {
  timeout?: number;
  z3Path?: string;
}

export interface Z3Result {
  status: 'sat' | 'unsat' | 'unknown' | 'timeout' | 'error';
  model?: string;
  error?: string;
  time: number;
}

// ============================================================================
// Z3 SOLVER CLASS
// ============================================================================

export class Z3Solver {
  private timeout: number;
  private z3Path: string;

  constructor(options: Z3Options = {}) {
    this.timeout = options.timeout ?? 30000;
    this.z3Path = options.z3Path ?? 'z3';
  }

  /**
   * Check satisfiability of an SMT-LIB query
   */
  async checkSat(smtLib: string): Promise<Z3Result> {
    const startTime = Date.now();
    
    try {
      // Create temp file for SMT-LIB input
      const tempDir = await mkdtemp(join(tmpdir(), 'isl-z3-'));
      const inputFile = join(tempDir, 'input.smt2');
      
      await writeFile(inputFile, smtLib, 'utf-8');

      try {
        const output = await this.runZ3(inputFile);
        const time = Date.now() - startTime;
        
        return this.parseOutput(output, time);
      } finally {
        // Cleanup
        await unlink(inputFile).catch(() => {});
      }
    } catch (error) {
      const time = Date.now() - startTime;
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        time,
      };
    }
  }

  /**
   * Check multiple queries in batch
   */
  async checkBatch(queries: string[]): Promise<Z3Result[]> {
    return Promise.all(queries.map(q => this.checkSat(q)));
  }

  /**
   * Run Z3 on an input file
   */
  private runZ3(inputFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-smt2',
        `-t:${this.timeout}`,
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

      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Z3 timeout'));
      }, this.timeout + 5000);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code !== 0 && !stdout.includes('sat') && !stdout.includes('unsat')) {
          reject(new Error(stderr || `Z3 exited with code ${code}`));
        } else {
          resolve(stdout);
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });
  }

  /**
   * Parse Z3 output
   */
  private parseOutput(output: string, time: number): Z3Result {
    const lines = output.trim().split('\n');
    const firstLine = lines[0]?.trim();

    if (firstLine === 'sat') {
      // Look for model
      const modelStart = output.indexOf('(model');
      let model: string | undefined;
      
      if (modelStart !== -1) {
        model = output.slice(modelStart);
      } else {
        // Try to find any definitions after 'sat'
        const defsStart = output.indexOf('\n(');
        if (defsStart !== -1) {
          model = output.slice(defsStart + 1);
        }
      }

      return { status: 'sat', model, time };
    }

    if (firstLine === 'unsat') {
      return { status: 'unsat', time };
    }

    if (firstLine === 'unknown') {
      return { status: 'unknown', time };
    }

    if (firstLine === 'timeout' || output.includes('timeout')) {
      return { status: 'timeout', time };
    }

    // Default to unknown if can't parse
    return { status: 'unknown', error: output, time };
  }

  /**
   * Get Z3 version info
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
// IN-MEMORY Z3 INTERFACE (for testing without subprocess)
// ============================================================================

export class MockZ3Solver extends Z3Solver {
  private responses: Map<string, Z3Result> = new Map();

  /**
   * Set a mock response for a query pattern
   */
  setResponse(pattern: string, result: Z3Result): void {
    this.responses.set(pattern, result);
  }

  /**
   * Override checkSat to return mock responses
   */
  async checkSat(smtLib: string): Promise<Z3Result> {
    const startTime = Date.now();

    // Check for pattern matches
    for (const [pattern, result] of this.responses) {
      if (smtLib.includes(pattern)) {
        return { ...result, time: Date.now() - startTime };
      }
    }

    // Default: return sat
    return {
      status: 'sat',
      model: '(model)',
      time: Date.now() - startTime,
    };
  }
}

// ============================================================================
// SMT-LIB UTILITIES
// ============================================================================

/**
 * Escape a string for SMT-LIB
 */
export function escapeSmtString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Format an SMT-LIB expression with indentation
 */
export function formatSmtLib(smt: string): string {
  let result = '';
  let indent = 0;
  let inString = false;

  for (let i = 0; i < smt.length; i++) {
    const char = smt[i];
    const prev = smt[i - 1];

    if (char === '"' && prev !== '\\') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      result += char;
      continue;
    }

    if (char === '(') {
      if (result.endsWith('\n')) {
        result += '  '.repeat(indent);
      }
      result += char;
      indent++;
    } else if (char === ')') {
      indent = Math.max(0, indent - 1);
      result += char;
    } else if (char === '\n') {
      result += char;
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Validate SMT-LIB syntax (basic check)
 */
export function validateSmtLib(smt: string): { valid: boolean; error?: string } {
  let parenCount = 0;
  let inString = false;

  for (let i = 0; i < smt.length; i++) {
    const char = smt[i];
    const prev = smt[i - 1];

    if (char === '"' && prev !== '\\') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '(') parenCount++;
    if (char === ')') parenCount--;

    if (parenCount < 0) {
      return { valid: false, error: `Unmatched ')' at position ${i}` };
    }
  }

  if (inString) {
    return { valid: false, error: 'Unclosed string literal' };
  }

  if (parenCount !== 0) {
    return { valid: false, error: `Unmatched parentheses: ${parenCount} unclosed '('` };
  }

  return { valid: true };
}
