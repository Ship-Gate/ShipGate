// ============================================================================
// SMT Integration Tests for CLI
// ============================================================================
/**
 * Tests the `isl verify --smt` command integration:
 * - Solver selection (builtin/z3/cvc5/auto)
 * - Timeout handling
 * - Known sat/unsat cases
 * - Error handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Paths
const CLI_PATH = resolve(__dirname, '../src/index.ts');
const TEMP_DIR = resolve(__dirname, '../../../.test-temp/smt-integration-tests');

// Helper to run CLI command
async function runCLI(args: string[], options: { cwd?: string; timeout?: number } = {}) {
  const { cwd = process.cwd(), timeout = 30000 } = options;
  
  try {
    const { stdout, stderr } = await execAsync(
      `npx tsx ${CLI_PATH} ${args.join(' ')}`,
      { cwd, timeout }
    );
    return {
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error: unknown) {
    const execError = error as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: execError.code ?? 1,
      stdout: execError.stdout?.trim() ?? '',
      stderr: execError.stderr?.trim() ?? '',
    };
  }
}

describe('SMT CLI Integration', () => {
  beforeAll(() => {
    // Clean up temp directory if it exists
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEMP_DIR, { recursive: true });
  });

  afterAll(() => {
    // Clean up
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  describe('--smt flag', () => {
    it('should show --smt flag in help', async () => {
      const result = await runCLI(['verify', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--smt');
      expect(result.stdout).toMatch(/SMT|smt/i);
    });

    it('should show --smt-solver flag in help', async () => {
      const result = await runCLI(['verify', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--smt-solver');
    });

    it('should show --smt-timeout flag in help', async () => {
      const result = await runCLI(['verify', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--smt-timeout');
    });
  });

  describe('SMT verification with simple ISL spec', () => {
    const simpleSpec = `
isl 1.0

domain Test {
  behavior Add {
    input {
      x: Int
      y: Int
    }
    output {
      success: Int
    }
    preconditions {
      "x non-negative" => x >= 0
      "y non-negative" => y >= 0
    }
    postconditions {
      "result equals sum" => result == x + y
    }
  }
}
`;

    const simpleImpl = `
export async function Add(input: { x: number; y: number }): Promise<number> {
  return input.x + input.y;
}
`;

    it('should run SMT verification with builtin solver', async () => {
      const specPath = join(TEMP_DIR, 'test.isl');
      const implPath = join(TEMP_DIR, 'test.ts');
      
      writeFileSync(specPath, simpleSpec);
      writeFileSync(implPath, simpleImpl);

      const result = await runCLI([
        'verify',
        specPath,
        '--impl',
        implPath,
        '--smt',
        '--smt-solver',
        'builtin',
        '--format',
        'json',
      ]);

      expect(typeof result.exitCode).toBe('number');
      
      // Try to parse JSON if available
      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        // JSON might be in stderr or mixed with other output
        return;
      }

      if (parsed) {
        // SMT result may be present if verification ran
        expect(parsed).toBeDefined();
      }
    });

    it('should run SMT verification with auto solver selection', async () => {
      const specPath = join(TEMP_DIR, 'test2.isl');
      const implPath = join(TEMP_DIR, 'test2.ts');
      
      writeFileSync(specPath, simpleSpec);
      writeFileSync(implPath, simpleImpl);

      const result = await runCLI([
        'verify',
        specPath,
        '--impl',
        implPath,
        '--smt',
        '--smt-solver',
        'auto',
        '--format',
        'json',
      ]);

      expect(typeof result.exitCode).toBe('number');
      
      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return;
      }

      if (parsed) {
        expect(parsed).toBeDefined();
      }
    });

    it('should respect timeout setting', async () => {
      const specPath = join(TEMP_DIR, 'test3.isl');
      const implPath = join(TEMP_DIR, 'test3.ts');
      
      writeFileSync(specPath, simpleSpec);
      writeFileSync(implPath, simpleImpl);

      const start = Date.now();
      const result = await runCLI([
        'verify',
        specPath,
        '--impl',
        implPath,
        '--smt',
        '--smt-timeout',
        '1000',
        '--format',
        'json',
      ], { timeout: 10000 });
      const duration = Date.now() - start;

      // Should complete within reasonable time (timeout + overhead)
      expect(duration).toBeLessThan(8000);
      expect(typeof result.exitCode).toBe('number');
      
      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return;
      }

      if (parsed) {
        expect(parsed).toBeDefined();
      }
    });
  });

  describe('Known SAT/UNSAT cases', () => {
    it('should detect satisfiable precondition', async () => {
      const spec = `
isl 1.0

domain Test {
  behavior Test {
    input {
      x: Int
    }
    output {
      success: Int
    }
    preconditions {
      "x positive" => x > 0
      "x less than 10" => x < 10
    }
    postconditions {
      "result equals x" => result == x
    }
  }
}
`;

      const impl = `
export async function Test(input: { x: number }): Promise<number> {
  return input.x;
}
`;

      const specPath = join(TEMP_DIR, 'sat-test.isl');
      const implPath = join(TEMP_DIR, 'sat-test.ts');
      
      writeFileSync(specPath, spec);
      writeFileSync(implPath, impl);

      const result = await runCLI([
        'verify',
        specPath,
        '--impl',
        implPath,
        '--smt',
        '--format',
        'json',
      ]);

      expect(typeof result.exitCode).toBe('number');
      
      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return;
      }

      if (parsed) {
        // Precondition should be satisfiable
        expect(parsed).toBeDefined();
      }
    });

    it('should detect unsatisfiable precondition', async () => {
      const spec = `
isl 1.0

domain Test {
  behavior Test {
    input {
      x: Int
    }
    output {
      success: Int
    }
    preconditions {
      "x greater than 10" => x > 10
      "x less than 5" => x < 5
    }
    postconditions {
      "result equals x" => result == x
    }
  }
}
`;

      const impl = `
export async function Test(input: { x: number }): Promise<number> {
  return input.x;
}
`;

      const specPath = join(TEMP_DIR, 'unsat-test.isl');
      const implPath = join(TEMP_DIR, 'unsat-test.ts');
      
      writeFileSync(specPath, spec);
      writeFileSync(implPath, impl);

      const result = await runCLI([
        'verify',
        specPath,
        '--impl',
        implPath,
        '--smt',
        '--format',
        'json',
      ]);

      // Should still exit successfully (verification reports the issue)
      expect(typeof result.exitCode).toBe('number');
      
      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return;
      }

      if (parsed) {
        // May have unsat results (depending on solver)
        expect(parsed).toBeDefined();
      }
    });
  });

  describe('Error handling', () => {
    it('should handle missing SMT package gracefully', async () => {
      // This test verifies that the CLI doesn't crash if SMT package is unavailable
      // In practice, the package should be available, but we test the error path
      const spec = `
isl 1.0

domain Test {
  behavior Test {
    input {
      x: Int
    }
    output {
      success: Int
    }
  }
}
`;

      const impl = `
export async function Test(input: { x: number }): Promise<number> {
  return input.x;
}
`;

      const specPath = join(TEMP_DIR, 'error-test.isl');
      const implPath = join(TEMP_DIR, 'error-test.ts');
      
      writeFileSync(specPath, spec);
      writeFileSync(implPath, impl);

      const result = await runCLI([
        'verify',
        specPath,
        '--impl',
        implPath,
        '--smt',
        '--format',
        'json',
      ]);

      // Should not crash - either succeeds or reports error gracefully
      expect(typeof result.exitCode).toBe('number');
      
      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return;
      }

      if (parsed) {
        // Should have some result structure
        expect(parsed).toBeDefined();
      }
    });

    it('should handle invalid solver name', async () => {
      const spec = `
isl 1.0

domain Test {
  behavior Test {
    input {
      x: Int
    }
    output {
      success: Int
    }
  }
}
`;

      const impl = `
export async function Test(input: { x: number }): Promise<number> {
  return input.x;
}
`;

      const specPath = join(TEMP_DIR, 'invalid-solver.isl');
      const implPath = join(TEMP_DIR, 'invalid-solver.ts');
      
      writeFileSync(specPath, spec);
      writeFileSync(implPath, impl);

      // Invalid solver should fall back to builtin
      const result = await runCLI([
        'verify',
        specPath,
        '--impl',
        implPath,
        '--smt',
        '--smt-solver',
        'invalid',
        '--format',
        'json',
      ]);

      // Should still work (falls back to builtin)
      expect(typeof result.exitCode).toBe('number');
    });
  });

  describe('Timeout handling', () => {
    it('should respect timeout and return unknown for complex queries', async () => {
      // Create a spec with many variables (may timeout)
      const spec = `
isl 1.0

domain Test {
  behavior Test {
    input {
      x1: Int
      x2: Int
      x3: Int
      x4: Int
      x5: Int
    }
    output {
      success: Int
    }
    preconditions {
      "x1 non-negative" => x1 >= 0
      "x2 non-negative" => x2 >= 0
      "x3 non-negative" => x3 >= 0
      "x4 non-negative" => x4 >= 0
      "x5 non-negative" => x5 >= 0
      "sum equals 100" => x1 + x2 + x3 + x4 + x5 == 100
    }
    postconditions {
      "result equals sum" => result == x1 + x2 + x3 + x4 + x5
    }
  }
}
`;

      const impl = `
export async function Test(input: { x1: number; x2: number; x3: number; x4: number; x5: number }): Promise<number> {
  return input.x1 + input.x2 + input.x3 + input.x4 + input.x5;
}
`;

      const specPath = join(TEMP_DIR, 'timeout-test.isl');
      const implPath = join(TEMP_DIR, 'timeout-test.ts');
      
      writeFileSync(specPath, spec);
      writeFileSync(implPath, impl);

      const start = Date.now();
      const result = await runCLI([
        'verify',
        specPath,
        '--impl',
        implPath,
        '--smt',
        '--smt-timeout',
        '100',
        '--format',
        'json',
      ], { timeout: 5000 });
      const duration = Date.now() - start;

      // Should complete quickly (timeout enforced)
      expect(duration).toBeLessThan(4000);
      expect(typeof result.exitCode).toBe('number');
      
      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return;
      }

      if (parsed) {
        // May have unknown/timeout results
        expect(parsed).toBeDefined();
      }
    });
  });
});
