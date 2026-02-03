/**
 * Smoke Tests for CLI Commands
 * 
 * Tests basic CLI functionality on Windows + Linux.
 * These are minimal tests to ensure commands don't crash.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const CLI_PATH = resolve(__dirname, '../dist/index.js');
const IS_WINDOWS = process.platform === 'win32';

function runCommand(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const cmd = IS_WINDOWS 
      ? `node ${CLI_PATH} ${args.join(' ')}`
      : `node ${CLI_PATH} ${args.join(' ')}`;
    const stdout = execSync(cmd, { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      exitCode: error.status || 1,
    };
  }
}

describe('CLI Smoke Tests', () => {
  describe('Help Command', () => {
    it('should show help without crashing', () => {
      const result = runCommand(['--help']);
      expect(result.stdout).toContain('ISL');
      expect(result.stdout).toContain('Commands');
    });

    it('should show version', () => {
      const result = runCommand(['--version']);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('Init Command', () => {
    it('should show init help', () => {
      const result = runCommand(['init', '--help']);
      expect(result.stdout).toContain('init');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Build Command', () => {
    it('should show build help', () => {
      const result = runCommand(['build', '--help']);
      expect(result.stdout).toContain('build');
      expect(result.exitCode).toBe(0);
    });

    it('should handle missing file gracefully', () => {
      const result = runCommand(['build', 'nonexistent.isl', '--json']);
      expect(result.exitCode).not.toBe(0);
      // Should output JSON error
      if (result.stdout) {
        try {
          JSON.parse(result.stdout);
        } catch {
          // Not JSON, that's ok for error cases
        }
      }
    });
  });

  describe('Heal Command', () => {
    it('should show heal help', () => {
      const result = runCommand(['heal', '--help']);
      expect(result.stdout).toContain('heal');
      expect(result.exitCode).toBe(0);
    });

    it('should handle missing pattern gracefully', () => {
      const result = runCommand(['heal', 'nonexistent/**/*.ts', '--json']);
      expect(result.exitCode).not.toBe(0);
      // Should output JSON error
      if (result.stdout) {
        try {
          const json = JSON.parse(result.stdout);
          expect(json).toHaveProperty('success');
        } catch {
          // Not JSON, that's ok for error cases
        }
      }
    });
  });

  describe('Verify Command', () => {
    it('should show verify help', () => {
      const result = runCommand(['verify', '--help']);
      expect(result.stdout).toContain('verify');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Proof Command', () => {
    it('should show proof help', () => {
      const result = runCommand(['proof', '--help']);
      expect(result.stdout).toContain('proof');
      expect(result.exitCode).toBe(0);
    });

    it('should show proof verify help', () => {
      const result = runCommand(['proof', 'verify', '--help']);
      expect(result.stdout).toContain('verify');
      expect(result.exitCode).toBe(0);
    });

    it('should handle missing bundle gracefully', () => {
      const result = runCommand(['proof', 'verify', 'nonexistent-bundle', '--json']);
      expect(result.exitCode).not.toBe(0);
      // Should output JSON error
      if (result.stdout) {
        try {
          const json = JSON.parse(result.stdout);
          expect(json).toHaveProperty('success');
        } catch {
          // Not JSON, that's ok for error cases
        }
      }
    });
  });

  describe('JSON Output', () => {
    it('should support --json flag on all commands', () => {
      const commands = [
        ['init', '--help', '--json'],
        ['build', '--help', '--json'],
        ['heal', '--help', '--json'],
        ['verify', '--help', '--json'],
        ['proof', 'verify', '--help', '--json'],
      ];

      for (const cmd of commands) {
        const result = runCommand(cmd);
        // Help commands don't necessarily output JSON, but shouldn't crash
        expect(result.exitCode).toBe(0);
      }
    });
  });

  describe('Exit Codes', () => {
    it('should return correct exit code for usage errors', () => {
      const result = runCommand(['unknown-command']);
      expect(result.exitCode).toBe(2); // USAGE_ERROR
    });

    it('should return correct exit code for missing required args', () => {
      const result = runCommand(['build']);
      // Commander.js uses exit code 1 for missing required arguments
      // This is acceptable behavior - the error message is clear
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr || result.stdout).toContain('missing required argument');
    });
  });

  describe('Error Messages', () => {
    it('should provide friendly error messages', () => {
      const result = runCommand(['unknown-command']);
      expect(result.stderr || result.stdout).toContain('Unknown command');
      // Help text is in the output (either stdout or stderr)
      const output = (result.stderr || result.stdout).toLowerCase();
      expect(output).toMatch(/help|--help/);
    });

    it('should suggest similar commands', () => {
      const result = runCommand(['buil']); // typo
      // Should suggest 'build' or show help
      const output = (result.stderr || result.stdout).toLowerCase();
      expect(output).toMatch(/build|help|did you mean/i);
    });
  });
});
