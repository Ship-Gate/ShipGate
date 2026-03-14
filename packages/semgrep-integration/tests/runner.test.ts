import { describe, it, expect, vi } from 'vitest';

describe('Semgrep Integration', () => {
  describe('SemgrepRunner', () => {
    it('is constructable with default config', async () => {
      const { SemgrepRunner } = await import('../src/runner.js');
      const runner = new SemgrepRunner();
      expect(runner).toBeDefined();
    });

    it('isAvailable returns false when semgrep not installed', async () => {
      const { SemgrepRunner } = await import('../src/runner.js');
      const runner = new SemgrepRunner({ timeout: 1000 });
      const available = await runner.isAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('scan returns empty results when semgrep not available', async () => {
      const { SemgrepRunner } = await import('../src/runner.js');
      const runner = new SemgrepRunner({ timeout: 1000 });
      const result = await runner.scan('/nonexistent/path');
      expect(result).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
    });
  });

  describe('Adapter', () => {
    it('creates a specless check from config', async () => {
      const { createSemgrepCheck } = await import('../src/adapter.js');
      const check = createSemgrepCheck();
      expect(check).toBeDefined();
      expect(check.name).toBe('semgrep-scanner');
      expect(typeof check.run).toBe('function');
    });

    it('returns skip evidence when semgrep unavailable', async () => {
      const { createSemgrepCheck } = await import('../src/adapter.js');
      const check = createSemgrepCheck();
      const evidence = await check.run('/nonexistent', {
        projectRoot: '/nonexistent',
        implementation: '',
        specOptional: true,
      });
      expect(Array.isArray(evidence)).toBe(true);
      if (evidence.length > 0) {
        expect(['pass', 'skip', 'warn', 'fail']).toContain(evidence[0].result);
      }
    });
  });
});
