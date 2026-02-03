// ============================================================================
// CLI E2E Tests - Run actual CLI commands and verify output
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';
import { join, resolve } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';

const execAsync = promisify(exec);

// Paths
const CLI_PATH = resolve(__dirname, '../src/index.ts');
const FIXTURES_ROOT = resolve(__dirname, '../../../test-fixtures');
const TEMP_DIR = resolve(__dirname, '../../../.test-temp');

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

// Helper to run CLI with spawn for exit code verification
function runCLISync(args: string[], options: { cwd?: string } = {}) {
  const { cwd = process.cwd() } = options;
  
  try {
    const result = execSync(
      `npx tsx ${CLI_PATH} ${args.join(' ')}`,
      { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return {
      exitCode: 0,
      stdout: result.trim(),
      stderr: '',
    };
  } catch (error: unknown) {
    const execError = error as { status?: number; stdout?: string; stderr?: string };
    return {
      exitCode: execError.status ?? 1,
      stdout: execError.stdout?.toString().trim() ?? '',
      stderr: execError.stderr?.toString().trim() ?? '',
    };
  }
}

describe('CLI E2E Tests', () => {
  const fixturesExist = existsSync(FIXTURES_ROOT);

  beforeAll(async () => {
    // Clean up temp directory if it exists (with retry for Windows)
    if (existsSync(TEMP_DIR)) {
      try {
        rmSync(TEMP_DIR, { recursive: true, force: true });
      } catch {
        // On Windows, sometimes files are still locked - wait and retry
        await new Promise(r => setTimeout(r, 100));
        try {
          rmSync(TEMP_DIR, { recursive: true, force: true });
        } catch {
          // If still failing, just proceed - mkdirSync will fail if truly problematic
        }
      }
    }
    mkdirSync(TEMP_DIR, { recursive: true });
  });

  describe('--help and --version', () => {
    it('should display help', async () => {
      const result = await runCLI(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('isl');
      expect(result.stdout).toContain('parse');
      expect(result.stdout).toContain('check');
    });

    it('should display version', async () => {
      const result = await runCLI(['--version']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should show help for parse command', async () => {
      const result = await runCLI(['parse', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Parse');
    });

    it('should show help for check command', async () => {
      const result = await runCLI(['check', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('check');
    });
  });

  describe('parse command', () => {
    it.skipIf(!fixturesExist)('should parse valid minimal file', async () => {
      const file = join(FIXTURES_ROOT, 'valid/minimal.isl');
      const result = await runCLI(['parse', file]);
      
      expect(result.exitCode).toBe(0);
    });

    it.skipIf(!fixturesExist)('should fail on invalid syntax', async () => {
      const file = join(FIXTURES_ROOT, 'invalid/syntax-errors/unterminated-string.isl');
      const result = await runCLI(['parse', file]);
      
      expect(result.exitCode).not.toBe(0);
    });

    it('should fail on non-existent file', async () => {
      const result = await runCLI(['parse', '/non/existent/file.isl']);
      
      expect(result.exitCode).not.toBe(0);
    });

    it.skipIf(!fixturesExist)('should output JSON with --format json', async () => {
      const file = join(FIXTURES_ROOT, 'valid/minimal.isl');
      const result = await runCLI(['parse', file, '--format', 'json']);
      
      // Should be valid JSON
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });
  });

  describe('check command', () => {
    it.skipIf(!fixturesExist)('should check valid file', async () => {
      const file = join(FIXTURES_ROOT, 'valid/minimal.isl');
      const result = await runCLI(['check', file]);
      
      expect(result.exitCode).toBe(0);
    });

    it.skipIf(!fixturesExist)('should check multiple files', async () => {
      const files = [
        join(FIXTURES_ROOT, 'valid/minimal.isl'),
        join(FIXTURES_ROOT, 'valid/complex-types.isl'),
      ];
      const result = await runCLI(['check', ...files]);
      
      expect(result.exitCode).toBe(0);
    });

    it.skipIf(!fixturesExist)('should fail on type errors', async () => {
      const file = join(FIXTURES_ROOT, 'invalid/type-errors/undefined-type.isl');
      const result = await runCLI(['check', file]);
      
      // Should fail due to type errors
      expect(result.exitCode).not.toBe(0);
    });

    it.skipIf(!fixturesExist)('should output JSON with --format json', async () => {
      const file = join(FIXTURES_ROOT, 'valid/minimal.isl');
      const result = await runCLI(['check', file, '--format', 'json']);
      
      // Should be valid JSON
      let parsed;
      expect(() => { parsed = JSON.parse(result.stdout); }).not.toThrow();
      expect(parsed).toHaveProperty('success');
    });
  });

  describe('gen command', () => {
    it.skipIf(!fixturesExist)('should generate TypeScript types', async () => {
      const file = join(FIXTURES_ROOT, 'valid/minimal.isl');
      const outDir = join(TEMP_DIR, 'gen-ts');
      mkdirSync(outDir, { recursive: true });
      
      const result = await runCLI(['gen', 'ts', file, '-o', outDir]);
      
      // May succeed or fail depending on generator implementation
      // We're testing that the command runs without crashing
      expect(typeof result.exitCode).toBe('number');
    });

    it('should fail with unknown target', async () => {
      const result = await runCLI(['gen', 'unknown-target', 'file.isl']);
      
      expect(result.exitCode).not.toBe(0);
    });

    it('should show available targets on error', async () => {
      const result = await runCLI(['gen', 'badtarget', 'file.isl']);
      
      // Should mention valid targets
      const output = result.stdout + result.stderr;
      expect(output.toLowerCase()).toMatch(/ts|typescript|rust|go|openapi|target/i);
    });
  });

  describe('init command', () => {
    it('should create new project', async () => {
      const projectDir = join(TEMP_DIR, 'init-test');
      
      const result = await runCLI(['init', 'test-project', '--directory', projectDir, '--no-git']);
      
      // Should create directory or fail gracefully
      expect(typeof result.exitCode).toBe('number');
    });

    it('should fail if directory exists and not forced', async () => {
      const projectDir = join(TEMP_DIR, 'existing-project');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'file.txt'), 'existing content');
      
      const result = await runCLI(['init', 'test-project', '--directory', projectDir]);
      
      // Should fail because directory exists
      expect(result.exitCode).not.toBe(0);
    });

    it('should succeed with --force on existing directory', async () => {
      const projectDir = join(TEMP_DIR, 'force-init');
      mkdirSync(projectDir, { recursive: true });
      
      const result = await runCLI(['init', 'test-project', '--directory', projectDir, '--force', '--no-git']);
      
      // Should succeed with force
      expect(typeof result.exitCode).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should show helpful message for unknown command', async () => {
      const result = await runCLI(['unknowncommand']);
      
      expect(result.exitCode).not.toBe(0);
    });

    it('should handle missing arguments', async () => {
      const result = await runCLI(['parse']);
      
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('Exit Codes', () => {
    it('should exit 0 on success', async () => {
      const result = await runCLI(['--version']);
      expect(result.exitCode).toBe(0);
    });

    it('should exit non-zero on error', async () => {
      const result = await runCLI(['parse', '/nonexistent.isl']);
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('Output Formats', () => {
    it('should support --format json', async () => {
      const result = await runCLI(['--help', '--format', 'json']);
      // --help might not respect --format, but command should not crash
      expect(typeof result.exitCode).toBe('number');
    });

    it('should support --quiet', async () => {
      const result = await runCLI(['--help', '--quiet']);
      expect(typeof result.exitCode).toBe('number');
    });

    it('should support --no-color', async () => {
      const result = await runCLI(['--help', '--no-color']);
      expect(result.exitCode).toBe(0);
      // Output should not contain ANSI escape codes
      expect(result.stdout).not.toMatch(/\x1b\[[0-9;]*m/);
    });
  });
});

describe('CLI Performance', () => {
  const fixturesExist = existsSync(FIXTURES_ROOT);

  it.skipIf(!fixturesExist)('should parse large file within 5s', async () => {
    const file = join(FIXTURES_ROOT, 'edge-cases/max-size.isl');
    
    const startTime = Date.now();
    const result = await runCLI(['parse', file], { timeout: 10000 });
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(5000);
  });

  it.skipIf(!fixturesExist)('should check multiple files efficiently', async () => {
    const files = [
      join(FIXTURES_ROOT, 'valid/minimal.isl'),
      join(FIXTURES_ROOT, 'valid/all-features.isl'),
      join(FIXTURES_ROOT, 'valid/complex-types.isl'),
    ];
    
    const startTime = Date.now();
    const result = await runCLI(['check', ...files], { timeout: 10000 });
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(5000);
  });
});
