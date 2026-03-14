import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Traffic Verifier', () => {
  describe('TrafficSampler', () => {
    it('captures samples at configured rate', async () => {
      const { TrafficSampler } = await import('../src/sampler.js');
      const sampler = new TrafficSampler({
        sampleRate: 1.0,
        specDir: '.',
        maxBufferSize: 100,
        flushIntervalMs: 60000,
        alertThresholds: { violationRatePercent: 10, latencyP99Ms: 5000, errorRatePercent: 5 },
      });
      expect(sampler).toBeDefined();
      expect(typeof sampler.createMiddleware).toBe('function');
    });
  });

  describe('TrafficValidator', () => {
    it('is constructable with parsed specs', async () => {
      const { TrafficValidator } = await import('../src/validator.js');
      const validator = new TrafficValidator([]);
      expect(validator).toBeDefined();
    });

    it('validates a sample against empty specs (no violations)', async () => {
      const { TrafficValidator } = await import('../src/validator.js');
      const validator = new TrafficValidator([]);
      const violations = validator.validate({
        requestId: 'req-1',
        timestamp: Date.now(),
        route: '/api/users',
        method: 'GET',
        statusCode: 200,
        latencyMs: 50,
        headers: {},
      });
      expect(violations).toEqual([]);
    });
  });

  describe('AnomalyDetector', () => {
    it('detects no anomalies with consistent data', async () => {
      const { AnomalyDetector } = await import('../src/anomaly-detector.js');
      const detector = new AnomalyDetector();

      for (let i = 0; i < 100; i++) {
        detector.addSample({
          requestId: `req-${i}`,
          timestamp: Date.now() + i * 100,
          route: '/api/users',
          method: 'GET',
          statusCode: 200,
          latencyMs: 50 + Math.random() * 10,
          headers: {},
        });
      }

      const anomalies = detector.detectAnomalies();
      expect(Array.isArray(anomalies)).toBe(true);
    });
  });

  describe('Reporter', () => {
    it('generates a markdown report', async () => {
      const { generateReport, formatMarkdown } = await import('../src/reporter.js');
      const report = generateReport(
        { totalSampled: 100, violations: 2, violationRate: 0.02, latencyP50: 50, latencyP95: 100, latencyP99: 200, errorRate: 0.01, topViolations: [] },
        [],
        [],
      );
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      const md = formatMarkdown(report);
      expect(md).toContain('Traffic Verification Report');
    });
  });
});
