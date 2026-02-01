/**
 * Health Check Aggregator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HealthAggregator,
  createHealthAggregator,
  quickHealthCheck,
  areCriticalServicesHealthy,
} from '../src/aggregator.js';
import type { HealthCheckConfig, CheckResult, HealthStatus } from '../src/types.js';

// Helper to create mock health checks
const createMockCheck = (
  name: string,
  result: CheckResult,
  critical: boolean = false,
  timeout?: number
): HealthCheckConfig => ({
  name,
  critical,
  timeout,
  check: vi.fn().mockResolvedValue(result),
});

const healthyResult: CheckResult = {
  status: 'healthy',
  latency: 10,
  timestamp: Date.now(),
};

const unhealthyResult: CheckResult = {
  status: 'unhealthy',
  message: 'Connection failed',
  timestamp: Date.now(),
};

const degradedResult: CheckResult = {
  status: 'degraded',
  latency: 500,
  message: 'High latency',
  timestamp: Date.now(),
};

describe('HealthAggregator', () => {
  let aggregator: HealthAggregator;

  beforeEach(() => {
    aggregator = new HealthAggregator([]);
  });

  describe('constructor', () => {
    it('should create aggregator with checks', () => {
      const checks = [
        createMockCheck('db', healthyResult, true),
        createMockCheck('cache', healthyResult, false),
      ];

      const agg = new HealthAggregator(checks);
      expect(agg.getChecks()).toHaveLength(2);
    });

    it('should accept custom config', () => {
      const agg = new HealthAggregator([], {
        timeout: 5000,
        parallel: false,
        cacheResults: true,
      });
      expect(agg).toBeInstanceOf(HealthAggregator);
    });
  });

  describe('checkAll', () => {
    it('should return healthy when all checks pass', async () => {
      const agg = new HealthAggregator([
        createMockCheck('db', healthyResult, true),
        createMockCheck('cache', healthyResult, false),
      ]);

      const result = await agg.checkAll();

      expect(result.status).toBe('healthy');
      expect(result.criticalFailures).toHaveLength(0);
      expect(result.nonCriticalFailures).toHaveLength(0);
    });

    it('should return unhealthy when critical check fails', async () => {
      const agg = new HealthAggregator([
        createMockCheck('db', unhealthyResult, true),
        createMockCheck('cache', healthyResult, false),
      ]);

      const result = await agg.checkAll();

      expect(result.status).toBe('unhealthy');
      expect(result.criticalFailures).toContain('db');
    });

    it('should return degraded when non-critical check fails', async () => {
      const agg = new HealthAggregator([
        createMockCheck('db', healthyResult, true),
        createMockCheck('cache', unhealthyResult, false),
      ]);

      const result = await agg.checkAll();

      expect(result.status).toBe('degraded');
      expect(result.nonCriticalFailures).toContain('cache');
    });

    it('should return degraded when check has degraded status', async () => {
      const agg = new HealthAggregator([
        createMockCheck('db', healthyResult, true),
        createMockCheck('api', degradedResult, false),
      ]);

      const result = await agg.checkAll();

      expect(result.status).toBe('degraded');
    });

    it('should run checks in parallel by default', async () => {
      const checks = [
        createMockCheck('db', healthyResult),
        createMockCheck('cache', healthyResult),
        createMockCheck('api', healthyResult),
      ];

      const agg = new HealthAggregator(checks, { parallel: true });
      await agg.checkAll();

      // All checks should have been called
      for (const check of checks) {
        expect(check.check).toHaveBeenCalled();
      }
    });

    it('should run checks sequentially when configured', async () => {
      const order: string[] = [];
      const createOrderedCheck = (name: string): HealthCheckConfig => ({
        name,
        critical: false,
        check: vi.fn().mockImplementation(async () => {
          order.push(name);
          return healthyResult;
        }),
      });

      const agg = new HealthAggregator(
        [
          createOrderedCheck('first'),
          createOrderedCheck('second'),
          createOrderedCheck('third'),
        ],
        { parallel: false }
      );

      await agg.checkAll();

      expect(order).toEqual(['first', 'second', 'third']);
    });

    it('should stop on critical failure in fail-fast mode', async () => {
      const checks = [
        createMockCheck('db', unhealthyResult, true),
        createMockCheck('cache', healthyResult, false),
      ];

      const agg = new HealthAggregator(checks, {
        parallel: false,
        failFast: true,
      });

      await agg.checkAll();

      expect(checks[0].check).toHaveBeenCalled();
      expect(checks[1].check).not.toHaveBeenCalled();
    });

    it('should cache results when configured', async () => {
      const check = createMockCheck('db', healthyResult);
      const agg = new HealthAggregator([check], {
        cacheResults: true,
        cacheTtl: 5000,
      });

      await agg.checkAll();
      await agg.checkAll();

      expect(check.check).toHaveBeenCalledTimes(1);
    });

    it('should include duration in result', async () => {
      const agg = new HealthAggregator([
        createMockCheck('db', healthyResult),
      ]);

      const result = await agg.checkAll();

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle check timeout', async () => {
      const slowCheck: HealthCheckConfig = {
        name: 'slow',
        critical: false,
        timeout: 100,
        check: vi.fn().mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve(healthyResult), 200))
        ),
      };

      const agg = new HealthAggregator([slowCheck], { timeout: 100 });
      const result = await agg.checkAll();

      expect(result.checks.get('slow')?.status).toBe('unhealthy');
      expect(result.checks.get('slow')?.message).toContain('timed out');
    });

    it('should handle check errors', async () => {
      const errorCheck: HealthCheckConfig = {
        name: 'error',
        critical: false,
        check: vi.fn().mockRejectedValue(new Error('Check failed')),
      };

      const agg = new HealthAggregator([errorCheck]);
      const result = await agg.checkAll();

      expect(result.checks.get('error')?.status).toBe('unhealthy');
      expect(result.checks.get('error')?.message).toBe('Check failed');
    });
  });

  describe('addCheck / removeCheck', () => {
    it('should add a check', () => {
      aggregator.addCheck(createMockCheck('new', healthyResult));
      expect(aggregator.hasCheck('new')).toBe(true);
    });

    it('should remove a check', () => {
      aggregator.addCheck(createMockCheck('temp', healthyResult));
      const removed = aggregator.removeCheck('temp');
      
      expect(removed).toBe(true);
      expect(aggregator.hasCheck('temp')).toBe(false);
    });

    it('should return false when removing non-existent check', () => {
      const removed = aggregator.removeCheck('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('getCheck / getChecks', () => {
    it('should get a specific check', () => {
      const check = createMockCheck('db', healthyResult);
      aggregator.addCheck(check);
      
      const retrieved = aggregator.getCheck('db');
      expect(retrieved?.name).toBe('db');
    });

    it('should return undefined for non-existent check', () => {
      const retrieved = aggregator.getCheck('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    it('should get all checks', () => {
      aggregator.addCheck(createMockCheck('a', healthyResult));
      aggregator.addCheck(createMockCheck('b', healthyResult));
      
      const checks = aggregator.getChecks();
      expect(checks).toHaveLength(2);
    });
  });

  describe('checkOne', () => {
    it('should run a specific check', async () => {
      aggregator.addCheck(createMockCheck('db', healthyResult));
      
      const result = await aggregator.checkOne('db');
      expect(result?.status).toBe('healthy');
    });

    it('should return undefined for non-existent check', async () => {
      const result = await aggregator.checkOne('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('event handling', () => {
    it('should emit check-started event', async () => {
      const handler = vi.fn();
      aggregator.addCheck(createMockCheck('db', healthyResult));
      aggregator.onEvent(handler);
      
      await aggregator.checkAll();
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'check-started',
          checkName: 'db',
        })
      );
    });

    it('should emit check-completed event', async () => {
      const handler = vi.fn();
      aggregator.addCheck(createMockCheck('db', healthyResult));
      aggregator.onEvent(handler);
      
      await aggregator.checkAll();
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'check-completed',
          checkName: 'db',
        })
      );
    });

    it('should emit status-changed event', async () => {
      const handler = vi.fn();
      const check: HealthCheckConfig = {
        name: 'db',
        critical: true,
        check: vi.fn()
          .mockResolvedValueOnce(healthyResult)
          .mockResolvedValueOnce(unhealthyResult),
      };
      
      aggregator.addCheck(check);
      aggregator.onEvent(handler);
      
      await aggregator.checkAll();
      aggregator.clearCache();
      await aggregator.checkAll();
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status-changed',
          checkName: 'db',
          previousStatus: 'healthy',
          currentStatus: 'unhealthy',
        })
      );
    });

    it('should allow unsubscribing from events', async () => {
      const handler = vi.fn();
      aggregator.addCheck(createMockCheck('db', healthyResult));
      
      const unsubscribe = aggregator.onEvent(handler);
      unsubscribe();
      
      await aggregator.checkAll();
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const check = createMockCheck('db', healthyResult);
      const agg = new HealthAggregator([check], { cacheResults: true });
      
      await agg.checkAll();
      agg.clearCache();
      await agg.checkAll();
      
      expect(check.check).toHaveBeenCalledTimes(2);
    });

    it('should return last cached results', async () => {
      const agg = new HealthAggregator(
        [createMockCheck('db', healthyResult)],
        { cacheResults: true }
      );
      
      await agg.checkAll();
      const cached = agg.getLastResults();
      
      expect(cached).toBeDefined();
      expect(cached?.get('db')?.status).toBe('healthy');
    });
  });

  describe('getCriticalChecks / getNonCriticalChecks', () => {
    it('should get critical checks', () => {
      aggregator.addCheck(createMockCheck('db', healthyResult, true));
      aggregator.addCheck(createMockCheck('cache', healthyResult, false));
      
      const critical = aggregator.getCriticalChecks();
      expect(critical).toHaveLength(1);
      expect(critical[0].name).toBe('db');
    });

    it('should get non-critical checks', () => {
      aggregator.addCheck(createMockCheck('db', healthyResult, true));
      aggregator.addCheck(createMockCheck('cache', healthyResult, false));
      
      const nonCritical = aggregator.getNonCriticalChecks();
      expect(nonCritical).toHaveLength(1);
      expect(nonCritical[0].name).toBe('cache');
    });
  });
});

describe('createHealthAggregator', () => {
  it('should create an aggregator', () => {
    const agg = createHealthAggregator([]);
    expect(agg).toBeInstanceOf(HealthAggregator);
  });
});

describe('quickHealthCheck', () => {
  it('should return overall health status', async () => {
    const status = await quickHealthCheck([
      createMockCheck('db', healthyResult, true),
      createMockCheck('cache', healthyResult, false),
    ]);
    
    expect(status).toBe('healthy');
  });
});

describe('areCriticalServicesHealthy', () => {
  it('should return true when all critical services are healthy', async () => {
    const isHealthy = await areCriticalServicesHealthy([
      createMockCheck('db', healthyResult, true),
      createMockCheck('cache', unhealthyResult, false),
    ]);
    
    expect(isHealthy).toBe(true);
  });

  it('should return false when critical service is unhealthy', async () => {
    const isHealthy = await areCriticalServicesHealthy([
      createMockCheck('db', unhealthyResult, true),
    ]);
    
    expect(isHealthy).toBe(false);
  });
});
