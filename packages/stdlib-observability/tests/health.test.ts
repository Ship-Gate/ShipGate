// ============================================================================
// Observability Standard Library - Health Checks Tests
// @isl-lang/stdlib-observability
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HealthCheckRegistry,
  HealthStatus,
  HealthCheckType,
  createHttpHealthCheck,
  createTcpHealthCheck,
  createCustomHealthCheck,
  getDefaultHealthRegistry,
  setDefaultHealthRegistry,
} from '../implementations/typescript/health';

describe('Health Checks', () => {
  let registry: HealthCheckRegistry;

  beforeEach(() => {
    registry = new HealthCheckRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Registry', () => {
    it('should register and check health', async () => {
      registry.register('database', {
        type: HealthCheckType.CUSTOM,
        description: 'Database connectivity',
        timeout: 5000,
        interval: 30000,
        checkFn: async () => ({
          status: HealthStatus.HEALTHY,
          message: 'Connected',
          durationMs: 10,
        }),
      });

      const result = await registry.checkHealth();
      
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.checks).toHaveProperty('database');
      expect(result.checks.database.status).toBe(HealthStatus.HEALTHY);
      expect(result.checks.database.message).toBe('Connected');
      expect(result.checks.database.durationMs).toBe(10);
    });

    it('should handle multiple health checks', async () => {
      registry.register('database', {
        type: HealthCheckType.CUSTOM,
        checkFn: async () => ({
          status: HealthStatus.HEALTHY,
          durationMs: 5,
        }),
      });

      registry.register('cache', {
        type: HealthCheckType.CUSTOM,
        checkFn: async () => ({
          status: HealthStatus.HEALTHY,
          durationMs: 3,
        }),
      });

      registry.register('external-api', {
        type: HealthCheckType.CUSTOM,
        checkFn: async () => ({
          status: HealthStatus.UNHEALTHY,
          message: 'Timeout',
          durationMs: 5000,
        }),
      });

      const result = await registry.checkHealth();
      
      expect(result.status).toBe(HealthStatus.UNHEALTHY); // Overall status is unhealthy
      expect(Object.keys(result.checks)).toHaveLength(3);
      expect(result.checks.database.status).toBe(HealthStatus.HEALTHY);
      expect(result.checks.cache.status).toBe(HealthStatus.HEALTHY);
      expect(result.checks['external-api'].status).toBe(HealthStatus.UNHEALTHY);
    });

    it('should check specific health checks', async () => {
      registry.register('check1', {
        type: HealthCheckType.CUSTOM,
        checkFn: async () => ({
          status: HealthStatus.HEALTHY,
          durationMs: 1,
        }),
      });

      registry.register('check2', {
        type: HealthCheckType.CUSTOM,
        checkFn: async () => ({
          status: HealthStatus.UNHEALTHY,
          durationMs: 1,
        }),
      });

      const result = await registry.checkHealth(['check1']);
      
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(Object.keys(result.checks)).toHaveLength(1);
      expect(result.checks.check1.status).toBe(HealthStatus.HEALTHY);
    });

    it('should handle check timeouts', async () => {
      registry.register('slow-check', {
        type: HealthCheckType.CUSTOM,
        timeout: 100,
        checkFn: async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return { status: HealthStatus.HEALTHY, durationMs: 200 };
        },
      });

      const result = await registry.checkHealth();
      
      expect(result.checks['slow-check'].status).toBe(HealthStatus.UNHEALTHY);
      expect(result.checks['slow-check'].message).toContain('timeout');
    });

    it('should aggregate health status correctly', async () => {
      // All healthy -> healthy
      registry.register('h1', {
        type: HealthCheckType.CUSTOM,
        checkFn: async () => ({ status: HealthStatus.HEALTHY, durationMs: 1 }),
      });
      registry.register('h2', {
        type: HealthCheckType.CUSTOM,
        checkFn: async () => ({ status: HealthStatus.HEALTHY, durationMs: 1 }),
      });
      
      let result = await registry.checkHealth();
      expect(result.status).toBe(HealthStatus.HEALTHY);
      
      registry.clear();
      
      // Some unhealthy -> unhealthy
      registry.register('h1', {
        type: HealthCheckType.CUSTOM,
        checkFn: async () => ({ status: HealthStatus.HEALTHY, durationMs: 1 }),
      });
      registry.register('u1', {
        type: HealthCheckType.CUSTOM,
        checkFn: async () => ({ status: HealthStatus.UNHEALTHY, durationMs: 1 }),
      });
      
      result = await registry.checkHealth();
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      
      registry.clear();
      
      // Some degraded -> degraded
      registry.register('h1', {
        type: HealthCheckType.CUSTOM,
        checkFn: async () => ({ status: HealthStatus.HEALTHY, durationMs: 1 }),
      });
      registry.register('d1', {
        type: HealthCheckType.CUSTOM,
        checkFn: async () => ({ status: HealthStatus.DEGRADED, durationMs: 1 }),
      });
      
      result = await registry.checkHealth();
      expect(result.status).toBe(HealthStatus.DEGRADED);
    });
  });

  describe('HTTP Health Check', () => {
    beforeEach(() => {
      // Mock fetch
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create successful HTTP health check', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        status: 200,
      } as Response);

      const checkFn = createHttpHealthCheck('http://localhost:8080/health');
      registry.register('api', {
        type: HealthCheckType.HTTP,
        checkFn,
      });

      const result = await registry.checkHealth();
      
      expect(result.checks.api.status).toBe(HealthStatus.HEALTHY);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/health',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle HTTP error status', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        status: 500,
      } as Response);

      const checkFn = createHttpHealthCheck('http://localhost:8080/health');
      registry.register('api', {
        type: HealthCheckType.HTTP,
        checkFn,
      });

      const result = await registry.checkHealth();
      
      expect(result.checks.api.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.checks.api.message).toContain('500');
    });

    it('should handle custom expected status', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        status: 201,
      } as Response);

      const checkFn = createHttpHealthCheck('http://localhost:8080', {
        expectedStatus: 201,
      });
      registry.register('api', {
        type: HealthCheckType.HTTP,
        checkFn,
      });

      const result = await registry.checkHealth();
      
      expect(result.checks.api.status).toBe(HealthStatus.HEALTHY);
    });

    it('should handle fetch errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const checkFn = createHttpHealthCheck('http://localhost:8080');
      registry.register('api', {
        type: HealthCheckType.HTTP,
        checkFn,
      });

      const result = await registry.checkHealth();
      
      expect(result.checks.api.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.checks.api.message).toContain('Network error');
    });
  });

  describe('TCP Health Check', () => {
    beforeEach(() => {
      // Mock net for Node.js environment
      vi.mock('net', () => ({
        createConnection: vi.fn(),
      }));
    });

    it('should create TCP health check', async () => {
      // This test would require actual TCP connection mocking
      // For now, we'll test the factory function
      const checkFn = createTcpHealthCheck('localhost', 5432);
      expect(typeof checkFn).toBe('function');
    });
  });

  describe('Custom Health Check', () => {
    it('should create custom health check', async () => {
      const checkFn = createCustomHealthCheck(async () => {
        // Simulate some check
        return {
          status: HealthStatus.HEALTHY,
          message: 'All good',
          durationMs: 42,
        };
      });

      registry.register('custom', {
        type: HealthCheckType.CUSTOM,
        checkFn,
      });

      const result = await registry.checkHealth();
      
      expect(result.checks.custom.status).toBe(HealthStatus.HEALTHY);
      expect(result.checks.custom.message).toBe('All good');
      expect(result.checks.custom.durationMs).toBe(42);
    });

    it('should handle custom check errors', async () => {
      const checkFn = createCustomHealthCheck(async () => {
        throw new Error('Check failed');
      });

      registry.register('custom', {
        type: HealthCheckType.CUSTOM,
        checkFn,
      });

      const result = await registry.checkHealth();
      
      expect(result.checks.custom.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.checks.custom.message).toContain('Check failed');
    });
  });

  describe('Default Registry', () => {
    it('should manage default registry instance', () => {
      const originalRegistry = getDefaultHealthRegistry();
      
      const newRegistry = new HealthCheckRegistry();
      setDefaultHealthRegistry(newRegistry);
      
      expect(getDefaultHealthRegistry()).toBe(newRegistry);
      
      // Restore original
      setDefaultHealthRegistry(originalRegistry);
    });
  });

  describe('Health Aggregation', () => {
    it('should calculate overall health correctly', async () => {
      const testCases = [
        {
          checks: [HealthStatus.HEALTHY, HealthStatus.HEALTHY],
          expected: HealthStatus.HEALTHY,
        },
        {
          checks: [HealthStatus.HEALTHY, HealthStatus.DEGRADED],
          expected: HealthStatus.DEGRADED,
        },
        {
          checks: [HealthStatus.HEALTHY, HealthStatus.UNHEALTHY],
          expected: HealthStatus.UNHEALTHY,
        },
        {
          checks: [HealthStatus.DEGRADED, HealthStatus.DEGRADED],
          expected: HealthStatus.DEGRADED,
        },
        {
          checks: [HealthStatus.DEGRADED, HealthStatus.UNHEALTHY],
          expected: HealthStatus.UNHEALTHY,
        },
        {
          checks: [HealthStatus.UNHEALTHY, HealthStatus.UNHEALTHY],
          expected: HealthStatus.UNHEALTHY,
        },
        {
          checks: [HealthStatus.UNKNOWN, HealthStatus.HEALTHY],
          expected: HealthStatus.UNKNOWN,
        },
      ];

      for (const testCase of testCases) {
        registry.clear();
        
        testCase.checks.forEach((status, index) => {
          registry.register(`check${index}`, {
            type: HealthCheckType.CUSTOM,
            checkFn: async () => ({ status, durationMs: 1 }),
          });
        });

        const result = await registry.checkHealth();
        expect(result.status).toBe(testCase.expected);
      }
    });
  });
});
