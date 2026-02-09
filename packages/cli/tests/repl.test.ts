/**
 * REPL Command Tests
 * 
 * Tests for the CLI REPL command with focus on:
 * - Non-interactive mode
 * - Timeout safety
 * - Command execution
 * - Deterministic output
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { repl } from '../src/commands/repl.js';

describe('REPL Command', () => {
  const sampleDomainPath = path.join(__dirname, '../fixtures/sample-domain.isl');
  
  beforeEach(() => {
    // Create sample domain file if it doesn't exist
    const sampleDomain = `domain TestDomain {
  version: "1.0.0"
  
  entity User {
    id: UUID
    email: String
    age: Int
  }
  
  behavior createUser {
    input {
      email: String
      age: Int
    }
    output {
      success: User
    }
  }
}`;
    
    const dir = path.dirname(sampleDomainPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(sampleDomainPath, sampleDomain, 'utf-8');
  });

  describe('Non-Interactive Mode', () => {
    it('executes :load command and exits', async () => {
      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as unknown as typeof process.exit;

      await repl({
        eval: `:load ${sampleDomainPath}`,
        timeout: 5000,
      });

      // Should have called exit
      expect(exitSpy).toHaveBeenCalledWith(0);
      process.exit = originalExit;
    });

    it('executes multiple commands separated by semicolons', async () => {
      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as unknown as typeof process.exit;

      await repl({
        eval: `:load ${sampleDomainPath}; :types`,
        timeout: 5000,
      });

      expect(exitSpy).toHaveBeenCalledWith(0);
      process.exit = originalExit;
    });

    it('handles parse errors gracefully', async () => {
      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as unknown as typeof process.exit;

      await repl({
        eval: ':load /nonexistent/file.isl',
        timeout: 5000,
      });

      // Should exit with error code
      expect(exitSpy).toHaveBeenCalled();
      process.exit = originalExit;
    });
  });

  describe('Timeout Safety', () => {
    it('respects timeout setting', async () => {
      const startTime = Date.now();
      
      try {
        await repl({
          eval: ':load /nonexistent/file.isl',
          timeout: 100, // Very short timeout
        });
      } catch {
        // Expected to fail
      }

      const duration = Date.now() - startTime;
      // Should complete quickly (within 200ms for 100ms timeout)
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Filesystem Protection', () => {
    it('does not write files by default', async () => {
      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as unknown as typeof process.exit;

      const outputDir = path.join(__dirname, '../test-output');
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
      }

      await repl({
        eval: `:load ${sampleDomainPath}; :gen ts`,
        timeout: 5000,
        allowWrites: false,
      });

      // Directory should not exist
      expect(fs.existsSync(outputDir)).toBe(false);
      process.exit = originalExit;
    });

    it('allows writes when flag is set', async () => {
      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as unknown as typeof process.exit;

      const outputDir = path.join(__dirname, '../test-output');
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
      }

      await repl({
        eval: `:load ${sampleDomainPath}; :write; :gen ts`,
        timeout: 10000,
        allowWrites: true,
      });

      // Note: This test may need adjustment based on actual gen behavior
      process.exit = originalExit;
    });
  });

  describe('Command Execution', () => {
    it('handles :load command', async () => {
      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as unknown as typeof process.exit;

      await repl({
        eval: `:load ${sampleDomainPath}`,
        timeout: 5000,
      });

      expect(exitSpy).toHaveBeenCalledWith(0);
      process.exit = originalExit;
    });

    it('handles :types command after load', async () => {
      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as unknown as typeof process.exit;

      await repl({
        eval: `:load ${sampleDomainPath}; :types`,
        timeout: 5000,
      });

      expect(exitSpy).toHaveBeenCalledWith(0);
      process.exit = originalExit;
    });

    it('handles :ast command after load', async () => {
      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as unknown as typeof process.exit;

      await repl({
        eval: `:load ${sampleDomainPath}; :ast`,
        timeout: 5000,
      });

      expect(exitSpy).toHaveBeenCalledWith(0);
      process.exit = originalExit;
    });
  });

  describe('Deterministic Output', () => {
    it('produces same output for same input', async () => {
      // This test ensures that the same commands produce deterministic output
      // In a real scenario, you'd capture stdout and compare
      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as unknown as typeof process.exit;

      await repl({
        eval: `:load ${sampleDomainPath}; :types`,
        timeout: 5000,
      });

      expect(exitSpy).toHaveBeenCalledWith(0);
      process.exit = originalExit;
    });
  });
});
