/**
 * Bin-Level Smoke Tests for the shipgate CLI
 *
 * Validates that the *bundled* dist/cli.cjs works correctly:
 *   - Commands are accessible
 *   - --version returns a semver string
 *   - --help output is reasonable
 *   - Exit codes are correct
 *
 * These tests require a prior `pnpm build` (they run against dist/).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';

// ─── Constants ───────────────────────────────────────────────────────────────

const CLI_PATH = resolve(__dirname, '../dist/cli.cjs');
const MAX_BUNDLE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Helpers ─────────────────────────────────────────────────────────────────

function exec(
  args: string,
  options?: { cwd?: string },
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node "${CLI_PATH}" ${args}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15_000,
      cwd: options?.cwd,
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

describe('CLI Bundle', () => {
  it('dist/cli.cjs exists and is non-empty', () => {
    expect(existsSync(CLI_PATH)).toBe(true);
    const stat = statSync(CLI_PATH);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('bundle size is under 10 MB', () => {
    const stat = statSync(CLI_PATH);
    expect(stat.size).toBeLessThan(MAX_BUNDLE_SIZE_BYTES);
  });

  it('starts with a shebang', () => {
    // Read just the first line
    const { readFileSync } = require('fs');
    const firstLine = readFileSync(CLI_PATH, 'utf-8').split('\n')[0];
    expect(firstLine).toBe('#!/usr/bin/env node');
  });
});

describe('shipgate --version', () => {
  it('prints a semver version string', () => {
    const { stdout, exitCode } = exec('--version');
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('shipgate --help', () => {
  it('displays help text with command list', () => {
    const { stdout, exitCode } = exec('--help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('verify');
    expect(stdout).toContain('init');
    expect(stdout).toContain('gate');
  });

  it('shows ShipGate as primary product name', () => {
    const { stdout, exitCode } = exec('--help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('ShipGate');
  });

  it('uses shipgate in usage examples', () => {
    const { stdout, exitCode } = exec('--help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('shipgate init');
    expect(stdout).toContain('shipgate verify');
  });

  it('indicates isl is an alias', () => {
    const { stdout, exitCode } = exec('--help');
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/isl.*alias|alias.*isl/i);
  });
});

describe('shipgate verify --help', () => {
  it('shows verify command help', () => {
    const { stdout, exitCode } = exec('verify --help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Verify');
  });
});

describe('shipgate init --help', () => {
  it('shows init command help', () => {
    const { stdout, exitCode } = exec('init --help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('init');
  });
});

describe('shipgate gate --help', () => {
  it('shows gate command help', () => {
    const { stdout, exitCode } = exec('gate --help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('gate');
  });
});

describe('shipgate build --help', () => {
  it('shows build command help', () => {
    const { stdout, exitCode } = exec('build --help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('build');
  });
});

describe('shipgate isl-generate --help', () => {
  it('shows isl-generate command help', () => {
    const { stdout, exitCode } = exec('isl-generate --help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Generate ISL spec');
  });
});

describe('shipgate generate --help', () => {
  it('shows generate command help', () => {
    const { stdout, exitCode } = exec('generate --help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Generate');
  });
});

describe('Exit codes', () => {
  it('returns exit code 2 for unknown commands', () => {
    const { exitCode, stderr, stdout } = exec('nonexistent-command');
    expect(exitCode).toBe(2);
    const output = stderr || stdout;
    expect(output).toContain('Unknown command');
  });

  it('returns non-zero for missing required arguments', () => {
    const { exitCode } = exec('build');
    expect(exitCode).not.toBe(0);
  });
});

describe('Error handling', () => {
  it('suggests similar command on typo', () => {
    const { stderr, stdout } = exec('verifiy'); // typo
    const output = stderr || stdout;
    expect(output.toLowerCase()).toMatch(/did you mean|verify|unknown/i);
    expect(output).toContain('shipgate');
  });
});

describe('shipgate init', () => {
  it('init --help shows init command help', () => {
    const { stdout, exitCode } = exec('init --help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('init');
    expect(stdout).toContain('template');
  });

  it('init in-place succeeds in an existing temp dir (no args)', () => {
    const { mkdtempSync, rmSync, existsSync, readFileSync } = require('fs');
    const { join } = require('path');
    const os = require('os');
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'shipgate-init-inplace-'));
    try {
      // Run init with no args from inside tmp dir (non-interactive in CI)
      const { exitCode, stdout, stderr } = exec('init -y', { cwd: tmpDir });
      if (exitCode !== 0) {
        throw new Error(`init failed (exit ${exitCode}): stdout=${stdout.slice(0, 500)} stderr=${stderr.slice(0, 500)}`);
      }
      expect(exitCode).toBe(0);
      expect(existsSync(join(tmpDir, 'package.json'))).toBe(true);
      expect(existsSync(join(tmpDir, 'isl.config.json'))).toBe(true);
      const basename = require('path').basename(tmpDir);
      const islPath = join(tmpDir, 'src', `${basename}.isl`);
      expect(existsSync(islPath)).toBe(true);
      const islContent = readFileSync(islPath, 'utf-8');
      expect(islContent).toContain('domain');
      expect(islContent).toContain('entity');
      expect(islContent).toContain('behavior');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('init my-app creates folder and succeeds', () => {
    const { mkdtempSync, rmSync, existsSync, readFileSync } = require('fs');
    const { join } = require('path');
    const os = require('os');
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'shipgate-init-new-'));
    const projectDir = join(tmpDir, 'my-app');
    try {
      const { exitCode, stdout, stderr } = exec(`init my-app --directory "${projectDir.replace(/\\/g, '/')}"`, { cwd: tmpDir });
      if (exitCode !== 0) {
        throw new Error(`init failed (exit ${exitCode}): stdout=${stdout.slice(0, 500)} stderr=${stderr.slice(0, 500)}`);
      }
      expect(exitCode).toBe(0);
      expect(existsSync(join(projectDir, 'package.json'))).toBe(true);
      expect(existsSync(join(projectDir, 'src', 'my-app.isl'))).toBe(true);
      expect(existsSync(join(projectDir, 'isl.config.json'))).toBe(true);
      const islContent = readFileSync(join(projectDir, 'src', 'my-app.isl'), 'utf-8');
      expect(islContent).toContain('domain');
      expect(islContent).toContain('entity');
      expect(islContent).toContain('behavior');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('init without --force does not clobber existing config', () => {
    const { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } = require('fs');
    const { join } = require('path');
    const os = require('os');
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'shipgate-init-no-clobber-'));
    const configPath = join(tmpDir, 'isl.config.json');
    const originalContent = '{"custom": "do not overwrite"}';
    try {
      writeFileSync(configPath, originalContent);
      const { exitCode, stderr } = exec('init -y', { cwd: tmpDir });
      expect(exitCode).not.toBe(0);
      expect(stderr || '').toContain('ShipGate files already exist');
      expect(stderr || '').toContain('--force');
      expect(readFileSync(configPath, 'utf-8')).toBe(originalContent);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('shipgate parse', () => {
  it('parse --help shows parse command help', () => {
    const { stdout, exitCode } = exec('parse --help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('parse');
  });

  it('parse handles non-existent file gracefully', () => {
    const { exitCode, stderr } = exec('parse ./nonexistent.isl');
    expect(exitCode).not.toBe(0);
    // Should show an error message
    expect(stderr || '').toBeTruthy();
  });
});
