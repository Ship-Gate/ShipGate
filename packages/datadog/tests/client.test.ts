import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatadogClient, createDatadogClient } from '../src/client.js';
import type { VerifyResult, CheckResult } from '../src/types.js';

describe('DatadogClient', () => {
  let client: DatadogClient;

  beforeEach(() => {
    client = createDatadogClient({
      serviceName: 'test-service',
      env: 'test',
      metricPrefix: 'test.',
    });
  });

  describe('configuration', () => {
    it('should create client with default config', () => {
      const defaultClient = new DatadogClient();
      const config = defaultClient.getConfig();
      
      expect(config.serviceName).toBe('isl-verification');
      expect(config.env).toBe('development');
      expect(config.metricPrefix).toBe('isl.');
    });

    it('should merge custom config with defaults', () => {
      const config = client.getConfig();
      
      expect(config.serviceName).toBe('test-service');
      expect(config.env).toBe('test');
      expect(config.metricPrefix).toBe('test.');
    });

    it('should use environment variables when available', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DD_ENV: 'staging',
        DD_AGENT_HOST: '10.0.0.1',
      };

      const envClient = new DatadogClient();
      const config = envClient.getConfig();

      expect(config.env).toBe('staging');
      expect(config.agentHost).toBe('10.0.0.1');

      process.env = originalEnv;
    });
  });

  describe('initialization', () => {
    it('should report uninitialized before initialize()', () => {
      expect(client.isInitialized()).toBe(false);
    });

    it('should not throw when recording metrics before initialization', () => {
      const result: VerifyResult = {
        domain: 'test',
        behavior: 'testBehavior',
        verdict: 'verified',
        score: 95,
        duration: 100,
        coverage: {
          preconditions: 1,
          postconditions: 0.9,
          invariants: 1,
        },
      };

      expect(() => client.recordVerification(result)).not.toThrow();
    });
  });

  describe('verification metrics', () => {
    it('should record verification with all fields', () => {
      const result: VerifyResult = {
        domain: 'auth',
        behavior: 'login',
        verdict: 'verified',
        score: 98,
        duration: 45,
        coverage: {
          preconditions: 1,
          postconditions: 0.95,
          invariants: 1,
        },
        checkCount: 10,
        labels: {
          version: '1.0.0',
        },
      };

      // Should not throw even when not initialized
      expect(() => client.recordVerification(result)).not.toThrow();
    });

    it('should handle different verdicts', () => {
      const verdicts: Array<'verified' | 'risky' | 'unsafe'> = ['verified', 'risky', 'unsafe'];

      for (const verdict of verdicts) {
        const result: VerifyResult = {
          domain: 'test',
          behavior: 'testBehavior',
          verdict,
          score: verdict === 'verified' ? 95 : verdict === 'risky' ? 70 : 30,
          duration: 100,
          coverage: { preconditions: 1, postconditions: 1, invariants: 1 },
        };

        expect(() => client.recordVerification(result)).not.toThrow();
      }
    });
  });

  describe('check metrics', () => {
    it('should record individual checks', () => {
      const check: CheckResult = {
        type: 'precondition',
        domain: 'auth',
        behavior: 'login',
        passed: true,
        duration: 5,
        expression: 'input.email != null',
      };

      expect(() => client.recordCheck(check)).not.toThrow();
    });

    it('should handle failed checks', () => {
      const check: CheckResult = {
        type: 'postcondition',
        domain: 'auth',
        behavior: 'login',
        passed: false,
        duration: 10,
        error: 'Expected token to be returned',
      };

      expect(() => client.recordCheck(check)).not.toThrow();
    });
  });

  describe('tracing', () => {
    it('should create spans', () => {
      const span = client.startSpan({
        domain: 'auth',
        behavior: 'login',
      });

      expect(span).toBeDefined();
      expect(span.traceId).toBeDefined();
      expect(span.spanId).toBeDefined();

      span.setTag('test', 'value');
      span.finish();
    });

    it('should trace behavior execution', async () => {
      const result = await client.traceBehavior(
        'auth',
        'login',
        async () => {
          return { success: true, token: 'abc123' };
        }
      );

      expect(result.success).toBe(true);
      expect(result.token).toBe('abc123');
    });

    it('should handle errors in traced behavior', async () => {
      await expect(
        client.traceBehavior('auth', 'login', async () => {
          throw new Error('Authentication failed');
        })
      ).rejects.toThrow('Authentication failed');
    });
  });

  describe('logging', () => {
    it('should log structured entries', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      client.log({
        level: 'info',
        message: 'Test message',
        domain: 'auth',
        behavior: 'login',
        attributes: { userId: '123' },
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('custom metrics', () => {
    it('should support increment', () => {
      expect(() => client.increment('custom.counter', 1, ['tag:value'])).not.toThrow();
    });

    it('should support gauge', () => {
      expect(() => client.gauge('custom.gauge', 42, ['tag:value'])).not.toThrow();
    });

    it('should support histogram', () => {
      expect(() => client.histogram('custom.histogram', 100, ['tag:value'])).not.toThrow();
    });

    it('should support distribution', () => {
      expect(() => client.distribution('custom.distribution', 50, ['tag:value'])).not.toThrow();
    });
  });
});
