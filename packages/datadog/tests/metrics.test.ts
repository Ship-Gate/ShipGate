import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatadogClient } from '../src/client.js';
import { VerificationMetrics, createVerificationMetrics } from '../src/metrics/verification.js';
import { CoverageMetrics, createCoverageMetrics } from '../src/metrics/coverage.js';
import { SLOMetrics, createSLOMetrics } from '../src/metrics/slo.js';
import type { VerifyResult, CoverageInfo, Domain } from '../src/types.js';

describe('VerificationMetrics', () => {
  let client: DatadogClient;
  let metrics: VerificationMetrics;

  beforeEach(() => {
    client = new DatadogClient({ env: 'test' });
    metrics = createVerificationMetrics(client);
  });

  describe('recordVerification', () => {
    it('should record verification result', () => {
      const result: VerifyResult = {
        domain: 'auth',
        behavior: 'login',
        verdict: 'verified',
        score: 95,
        duration: 100,
        coverage: { preconditions: 1, postconditions: 0.9, invariants: 1 },
      };

      expect(() => metrics.recordVerification(result)).not.toThrow();
    });

    it('should track verdict distribution', () => {
      const results: VerifyResult[] = [
        { domain: 'auth', behavior: 'login', verdict: 'verified', score: 95, duration: 100, coverage: { preconditions: 1, postconditions: 1, invariants: 1 } },
        { domain: 'auth', behavior: 'login', verdict: 'verified', score: 98, duration: 90, coverage: { preconditions: 1, postconditions: 1, invariants: 1 } },
        { domain: 'auth', behavior: 'login', verdict: 'risky', score: 70, duration: 150, coverage: { preconditions: 1, postconditions: 0.5, invariants: 1 } },
      ];

      for (const result of results) {
        metrics.recordVerification(result);
      }

      const distribution = metrics.getVerdictDistribution('auth', 'login');
      expect(distribution.get('verified')).toBe(2);
      expect(distribution.get('risky')).toBe(1);
    });

    it('should track score trend', () => {
      const scores = [90, 92, 88, 95, 97];
      
      for (const score of scores) {
        metrics.recordVerification({
          domain: 'auth',
          behavior: 'login',
          verdict: 'verified',
          score,
          duration: 100,
          coverage: { preconditions: 1, postconditions: 1, invariants: 1 },
        });
      }

      const trend = metrics.getScoreTrend('auth', 'login');
      expect(trend).toEqual(scores);
    });
  });

  describe('recordBatch', () => {
    it('should record batch of verifications', () => {
      const results: VerifyResult[] = [
        { domain: 'auth', behavior: 'login', verdict: 'verified', score: 95, duration: 100, coverage: { preconditions: 1, postconditions: 1, invariants: 1 } },
        { domain: 'auth', behavior: 'logout', verdict: 'verified', score: 100, duration: 50, coverage: { preconditions: 1, postconditions: 1, invariants: 1 } },
      ];

      expect(() => metrics.recordBatch(results)).not.toThrow();
    });
  });

  describe('recordFailure', () => {
    it('should record verification failure', () => {
      expect(() => 
        metrics.recordFailure('auth', 'login', 'timeout', new Error('Timed out'))
      ).not.toThrow();
    });
  });
});

describe('CoverageMetrics', () => {
  let client: DatadogClient;
  let coverage: CoverageMetrics;

  beforeEach(() => {
    client = new DatadogClient({ env: 'test' });
    coverage = createCoverageMetrics(client);
  });

  describe('recordCoverage', () => {
    it('should record coverage metrics', () => {
      const info: CoverageInfo = {
        preconditions: 0.95,
        postconditions: 0.88,
        invariants: 1.0,
      };

      expect(() => coverage.recordCoverage('auth', 'login', info)).not.toThrow();
    });

    it('should track coverage history', () => {
      coverage.recordCoverage('auth', 'login', { preconditions: 0.9, postconditions: 0.8, invariants: 1 });
      coverage.recordCoverage('auth', 'login', { preconditions: 0.95, postconditions: 0.85, invariants: 1 });

      const trend = coverage.getCoverageTrend('auth', 'login', 'preconditions');
      expect(trend.length).toBe(2);
      expect(trend[1]!.percentage).toBe(95);
    });
  });

  describe('recordDetailedCoverage', () => {
    it('should record coverage with counts', () => {
      expect(() => 
        coverage.recordDetailedCoverage('auth', 'login', 'preconditions', 9, 10)
      ).not.toThrow();
    });
  });

  describe('setCoverageTarget', () => {
    it('should set and check coverage targets', () => {
      coverage.setCoverageTarget('auth', 'login', 90);
      coverage.recordCoverage('auth', 'login', { preconditions: 0.8, postconditions: 0.8, invariants: 0.8 });

      const gap = coverage.getCoverageGap('auth', 'login');
      expect(gap).toBeGreaterThan(0);
    });
  });
});

describe('SLOMetrics', () => {
  let client: DatadogClient;
  let slo: SLOMetrics;

  beforeEach(() => {
    client = new DatadogClient({ env: 'test' });
    slo = createSLOMetrics(client);
  });

  describe('defineVerificationSLO', () => {
    it('should define an SLO', () => {
      expect(() => 
        slo.defineVerificationSLO('auth', 'login', {
          name: 'login-success',
          target: 99.9,
          windowDays: 30,
          type: 'availability',
        })
      ).not.toThrow();
    });
  });

  describe('recordEvent', () => {
    it('should record SLO events', () => {
      slo.defineVerificationSLO('auth', 'login', {
        name: 'login-success',
        target: 99.9,
        windowDays: 30,
        type: 'availability',
      });

      // Record some events
      for (let i = 0; i < 100; i++) {
        slo.recordEvent('auth', 'login', 'login-success', i < 99);
      }

      const status = slo.getStatus('auth', 'login', 'login-success');
      expect(status).toBeDefined();
      expect(status!.current).toBe(99);
      expect(status!.target).toBe(99.9);
    });

    it('should calculate error budget', () => {
      slo.defineVerificationSLO('auth', 'login', {
        name: 'login-success',
        target: 99,
        windowDays: 30,
        type: 'availability',
      });

      // Record 100 events, 98 good
      for (let i = 0; i < 100; i++) {
        slo.recordEvent('auth', 'login', 'login-success', i < 98);
      }

      const status = slo.getStatus('auth', 'login', 'login-success');
      expect(status!.errorBudget).toBe(1); // 100 - 99 = 1%
    });
  });

  describe('generateFromDomain', () => {
    it('should generate SLOs from domain', () => {
      const domain: Domain = {
        name: 'auth',
        behaviors: [
          {
            name: 'login',
            temporal: [
              { operator: 'within', duration: '500ms', percentile: 99 },
            ],
          },
        ],
      };

      const slos = slo.generateFromDomain(domain);
      expect(slos.length).toBeGreaterThan(0);
    });
  });

  describe('getStatus', () => {
    it('should return null for unknown SLO', () => {
      const status = slo.getStatus('unknown', 'unknown', 'unknown');
      expect(status).toBeNull();
    });

    it('should calculate status correctly', () => {
      slo.defineVerificationSLO('auth', 'login', {
        name: 'test-slo',
        target: 99,
        windowDays: 30,
        type: 'availability',
      });

      // Record all good events
      for (let i = 0; i < 100; i++) {
        slo.recordEvent('auth', 'login', 'test-slo', true);
      }

      const status = slo.getStatus('auth', 'login', 'test-slo');
      expect(status!.status).toBe('healthy');
      expect(status!.current).toBe(100);
    });
  });

  describe('resetWindow', () => {
    it('should reset SLO window', () => {
      slo.defineVerificationSLO('auth', 'login', {
        name: 'test-slo',
        target: 99,
        windowDays: 30,
        type: 'availability',
      });

      slo.recordEvent('auth', 'login', 'test-slo', false);
      slo.resetWindow('auth', 'login', 'test-slo');
      
      const status = slo.getStatus('auth', 'login', 'test-slo');
      expect(status!.current).toBe(100); // Reset to 100% (no events)
    });
  });
});
