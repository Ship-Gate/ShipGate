/**
 * Tests for sandbox runner
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSandboxRunner, SecretsMasker } from './index.js';
import type { SandboxOptions } from './types.js';

describe('Sandbox Runner', () => {
  describe('SecretsMasker', () => {
    it('should mask API keys', () => {
      const masker = new SecretsMasker();
      const text = 'API_KEY=sk_live_1234567890abcdef';
      const masked = masker.mask(text);
      expect(masked).toContain('***');
      expect(masked).not.toContain('sk_live_1234567890abcdef');
    });

    it('should mask passwords', () => {
      const masker = new SecretsMasker();
      const text = 'password=mySecretPassword123';
      const masked = masker.mask(text);
      expect(masked).toContain('***');
      expect(masked).not.toContain('mySecretPassword123');
    });

    it('should mask JWT tokens', () => {
      const masker = new SecretsMasker();
      const text = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjg';
      const masked = masker.mask(text);
      expect(masked).toContain('***');
      expect(masked).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should allow custom patterns', () => {
      const masker = new SecretsMasker({
        patterns: [/custom-secret-(\w+)/g],
      });
      const text = 'custom-secret-abc123';
      const masked = masker.mask(text);
      expect(masked).toContain('***');
    });
  });

  describe('WorkerSandbox', () => {
    it('should execute simple commands', async () => {
      const sandbox = createSandboxRunner({
        mode: 'worker',
        timeout: 5000,
        allowedEnvVars: ['PATH'],
      });

      const result = await sandbox.execute('node', ['--version'], {
        env: { PATH: process.env.PATH },
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('v');
      await sandbox.cleanup();
    }, 10000);

    it('should enforce timeout', async () => {
      const sandbox = createSandboxRunner({
        mode: 'worker',
        timeout: 1000, // 1 second timeout
      });

      // Create a script that sleeps
      const result = await sandbox.execute('node', [
        '-e',
        'setTimeout(() => {}, 5000)',
      ]);

      expect(result.timedOut).toBe(true);
      await sandbox.cleanup();
    }, 10000);

    it('should filter environment variables', async () => {
      const sandbox = createSandboxRunner({
        mode: 'worker',
        allowedEnvVars: ['NODE_ENV'],
      });

      const result = await sandbox.execute('node', [
        '-e',
        'console.log(process.env.SECRET_KEY || "not found")',
      ], {
        env: {
          NODE_ENV: 'test',
          SECRET_KEY: 'should-be-hidden',
        },
      });

      // The secret should not be accessible
      expect(result.stdout).toContain('not found');
      await sandbox.cleanup();
    }, 10000);
  });

  describe('NoOpSandbox', () => {
    it('should execute commands without sandboxing', async () => {
      const sandbox = createSandboxRunner({
        mode: 'off',
      });

      const result = await sandbox.execute('node', ['--version']);

      expect(result.success).toBe(true);
      await sandbox.cleanup();
    }, 10000);

    it('should still enforce timeout', async () => {
      const sandbox = createSandboxRunner({
        mode: 'off',
        timeout: 1000,
      });

      const result = await sandbox.execute('node', [
        '-e',
        'setTimeout(() => {}, 5000)',
      ]);

      expect(result.timedOut).toBe(true);
      await sandbox.cleanup();
    }, 10000);
  });

  describe('createSandboxRunner', () => {
    it('should default to auto mode', () => {
      const sandbox = createSandboxRunner();
      expect(sandbox).toBeDefined();
    });

    it('should create worker sandbox when mode is worker', () => {
      const sandbox = createSandboxRunner({ mode: 'worker' });
      expect(sandbox).toBeDefined();
    });

    it('should create no-op sandbox when mode is off', () => {
      const sandbox = createSandboxRunner({ mode: 'off' });
      expect(sandbox).toBeDefined();
    });
  });
});
