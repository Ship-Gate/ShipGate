/**
 * Safe Vibe Coding Pipeline Tests
 *
 * Tests the vibe command pipeline:
 *   - CLI flag wiring (--framework, --database, --from-spec, --dry-run)
 *   - API key resolution
 *   - ISL spec validation
 *   - Output structure (printVibeResult, getVibeExitCode)
 *   - Error handling (missing key, invalid prompt, bad spec)
 *
 * These tests run against the built CLI (dist/cli.cjs).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

// ─── Constants ───────────────────────────────────────────────────────────────

const CLI_PATH = resolve(__dirname, '../dist/cli.cjs');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function exec(
  args: string,
  env?: Record<string, string>,
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node "${CLI_PATH}" ${args}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15_000,
      env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', ...env },
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const e = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

// ─── Pre-flight ──────────────────────────────────────────────────────────────

beforeAll(() => {
  if (!existsSync(CLI_PATH)) {
    throw new Error(
      `dist/cli.cjs not found at ${CLI_PATH}. Run "pnpm build" first.`,
    );
  }
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('vibe command help', () => {
  it('shows vibe in top-level help', () => {
    const result = exec('--help');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('vibe');
  });

  it('shows vibe command help with all options', () => {
    const result = exec('vibe --help');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Safe Vibe Coding');
    expect(result.stdout).toContain('--framework');
    expect(result.stdout).toContain('--database');
    expect(result.stdout).toContain('--from-spec');
    expect(result.stdout).toContain('--provider');
    expect(result.stdout).toContain('--model');
    expect(result.stdout).toContain('--dry-run');
    expect(result.stdout).toContain('--max-iterations');
    expect(result.stdout).toContain('--no-frontend');
    expect(result.stdout).toContain('--no-tests');
    expect(result.stdout).toContain('--output');
  });
});

describe('vibe command error handling', () => {
  it('fails when no prompt and no --from-spec provided', () => {
    const result = exec('vibe');
    // Should exit with usage error since no prompt or --from-spec
    expect(result.exitCode).not.toBe(0);
    const output = result.stdout + result.stderr;
    expect(output.toLowerCase()).toMatch(/prompt|from-spec|error/);
  });

  it('fails gracefully when no API key is set', () => {
    const result = exec('vibe "Build a todo app"');
    expect(result.exitCode).not.toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/API key|ANTHROPIC_API_KEY|OPENAI_API_KEY|copilot/i);
  });

  it('fails gracefully with openai provider and no key', () => {
    const result = exec('vibe "Build a todo app" --provider openai');
    expect(result.exitCode).not.toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/API key|OPENAI_API_KEY|copilot/i);
  });

  it('fails when --from-spec references non-existent file', () => {
    const result = exec('vibe --from-spec non-existent.isl');
    expect(result.exitCode).not.toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/not found|no such file|ENOENT|error/i);
  });
});

describe('vibe pipeline types', () => {
  it('exports correct types from commands index', async () => {
    // Verify the vibe module exports are available
    const vibeModule = await import('../src/commands/vibe.js');
    expect(vibeModule.vibe).toBeDefined();
    expect(typeof vibeModule.vibe).toBe('function');
    expect(vibeModule.printVibeResult).toBeDefined();
    expect(typeof vibeModule.printVibeResult).toBe('function');
    expect(vibeModule.getVibeExitCode).toBeDefined();
    expect(typeof vibeModule.getVibeExitCode).toBe('function');
  });

  it('getVibeExitCode returns 0 for SHIP', async () => {
    const { getVibeExitCode } = await import('../src/commands/vibe.js');
    const result = {
      success: true,
      verdict: 'SHIP' as const,
      prompt: 'test',
      outputDir: '/tmp/test',
      files: [],
      stages: [],
      iterations: 1,
      finalScore: 0.95,
      errors: [],
      duration: 1000,
    };
    expect(getVibeExitCode(result)).toBe(0);
  });

  it('getVibeExitCode returns 0 for WARN', async () => {
    const { getVibeExitCode } = await import('../src/commands/vibe.js');
    const result = {
      success: true,
      verdict: 'WARN' as const,
      prompt: 'test',
      outputDir: '/tmp/test',
      files: [],
      stages: [],
      iterations: 1,
      finalScore: 0.6,
      errors: [],
      duration: 1000,
    };
    expect(getVibeExitCode(result)).toBe(0);
  });

  it('getVibeExitCode returns 1 for NO_SHIP', async () => {
    const { getVibeExitCode } = await import('../src/commands/vibe.js');
    const result = {
      success: false,
      verdict: 'NO_SHIP' as const,
      prompt: 'test',
      outputDir: '/tmp/test',
      files: [],
      stages: [],
      iterations: 3,
      finalScore: 0.3,
      errors: ['violation1'],
      duration: 5000,
    };
    expect(getVibeExitCode(result)).toBe(1);
  });
});

describe('vibe examples in help', () => {
  it('help text includes vibe examples', () => {
    const result = exec('--help');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('vibe');
    expect(result.stdout).toContain('todo app');
  });
});
