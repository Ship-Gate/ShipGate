// ============================================================================
// Prometheus Exporter Tests
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createExporter,
  PrometheusExporter,
  createCollector,
  createBatchCollector,
  type Exporter,
  type VerifyMetricResult,
  type ChaosMetricResult,
} from '../src';

describe('PrometheusExporter', () => {
  let exporter: PrometheusExporter;

  beforeEach(() => {
    exporter = new PrometheusExporter({
      collectDefaultMetrics: false, // Disable for faster tests
      prefix: 'test_',
    });
  });

  afterEach(async () => {
    exporter.reset();
    await exporter.close().catch(() => {});
  });

  describe('createExporter', () => {
    it('should create an exporter with default options', () => {
      const exp = createExporter({ collectDefaultMetrics: false });
      expect(exp).toBeDefined();
      expect(typeof exp.recordVerification).toBe('function');
      expect(typeof exp.recordChaos).toBe('function');
      expect(typeof exp.recordLatency).toBe('function');
      expect(typeof exp.metrics).toBe('function');
    });

    it('should create an exporter with custom options', () => {
      const exp = createExporter({
        port: 9999,
        path: '/custom-metrics',
        prefix: 'custom_',
        collectDefaultMetrics: false,
      });
      expect(exp).toBeDefined();
    });
  });

  describe('recordVerification', () => {
    it('should record a verification result', async () => {
      const result: VerifyMetricResult = {
        domain: 'auth',
        behavior: 'Login',
        verdict: 'verified',
        score: 94,
        duration: 2.5,
        coverage: {
          preconditions: 1.0,
          postconditions: 0.92,
          invariants: 1.0,
        },
      };

      exporter.recordVerification(result);

      const metrics = await exporter.metrics();
      
      expect(metrics).toContain('test_verification_total');
      expect(metrics).toContain('domain="auth"');
      expect(metrics).toContain('behavior="Login"');
      expect(metrics).toContain('verdict="verified"');
    });

    it('should record multiple verdicts', async () => {
      exporter.recordVerification({
        domain: 'auth',
        behavior: 'Login',
        verdict: 'verified',
        score: 95,
        duration: 1.0,
        coverage: { preconditions: 1.0, postconditions: 1.0, invariants: 1.0 },
      });

      exporter.recordVerification({
        domain: 'auth',
        behavior: 'Login',
        verdict: 'risky',
        score: 75,
        duration: 1.5,
        coverage: { preconditions: 1.0, postconditions: 0.8, invariants: 1.0 },
      });

      exporter.recordVerification({
        domain: 'auth',
        behavior: 'Login',
        verdict: 'unsafe',
        score: 45,
        duration: 0.5,
        coverage: { preconditions: 0.5, postconditions: 0.5, invariants: 0.5 },
      });

      const metrics = await exporter.metrics();
      
      expect(metrics).toContain('verdict="verified"');
      expect(metrics).toContain('verdict="risky"');
      expect(metrics).toContain('verdict="unsafe"');
    });

    it('should update verification score gauge', async () => {
      exporter.recordVerification({
        domain: 'auth',
        behavior: 'Login',
        verdict: 'verified',
        score: 94,
        duration: 1.0,
        coverage: { preconditions: 1.0, postconditions: 1.0, invariants: 1.0 },
      });

      const metrics = await exporter.metrics();
      
      expect(metrics).toContain('test_verification_score');
      expect(metrics).toContain('94');
    });

    it('should record coverage metrics', async () => {
      exporter.recordVerification({
        domain: 'auth',
        behavior: 'Login',
        verdict: 'verified',
        score: 94,
        duration: 1.0,
        coverage: {
          preconditions: 1.0,
          postconditions: 0.92,
          invariants: 0.85,
        },
      });

      const metrics = await exporter.metrics();
      
      expect(metrics).toContain('test_coverage_ratio');
      expect(metrics).toContain('category="preconditions"');
      expect(metrics).toContain('category="postconditions"');
      expect(metrics).toContain('category="invariants"');
    });
  });

  describe('recordChaos', () => {
    it('should record a chaos test result', async () => {
      const result: ChaosMetricResult = {
        domain: 'auth',
        scenario: 'db_failure',
        result: 'pass',
        duration: 5.0,
      };

      exporter.recordChaos(result);

      const metrics = await exporter.metrics();
      
      expect(metrics).toContain('test_chaos_test_total');
      expect(metrics).toContain('scenario="db_failure"');
      expect(metrics).toContain('result="pass"');
    });

    it('should track pass and fail results', async () => {
      exporter.recordChaos({
        domain: 'auth',
        scenario: 'db_failure',
        result: 'pass',
      });

      exporter.recordChaos({
        domain: 'auth',
        scenario: 'db_failure',
        result: 'pass',
      });

      exporter.recordChaos({
        domain: 'auth',
        scenario: 'db_failure',
        result: 'fail',
      });

      const metrics = await exporter.metrics();
      
      expect(metrics).toContain('result="pass"');
      expect(metrics).toContain('result="fail"');
    });

    it('should calculate chaos success rate', async () => {
      for (let i = 0; i < 8; i++) {
        exporter.recordChaos({
          domain: 'auth',
          scenario: 'network_latency',
          result: 'pass',
        });
      }

      for (let i = 0; i < 2; i++) {
        exporter.recordChaos({
          domain: 'auth',
          scenario: 'network_latency',
          result: 'fail',
        });
      }

      const metrics = await exporter.metrics();
      
      expect(metrics).toContain('test_chaos_test_success_rate');
    });
  });

  describe('recordLatency', () => {
    it('should record latency measurements', async () => {
      exporter.recordLatency('auth', 'Login', 0.15);
      exporter.recordLatency('auth', 'Login', 0.18);
      exporter.recordLatency('auth', 'Login', 0.12);

      const metrics = await exporter.metrics();
      
      expect(metrics).toContain('test_implementation_latency_seconds');
      expect(metrics).toContain('domain="auth"');
      expect(metrics).toContain('behavior="Login"');
    });

    it('should record latency histogram buckets', async () => {
      // Record various latencies
      for (let i = 0; i < 10; i++) {
        exporter.recordLatency('auth', 'Login', 0.05 + i * 0.02);
      }

      const metrics = await exporter.metrics();
      
      expect(metrics).toContain('test_implementation_latency_seconds_bucket');
      expect(metrics).toContain('le="0.1"');
      expect(metrics).toContain('le="0.2"');
    });
  });

  describe('recordTrustScore', () => {
    it('should record domain trust score', async () => {
      exporter.recordTrustScore({
        domain: 'auth',
        score: 97.5,
      });

      const metrics = await exporter.metrics();
      
      expect(metrics).toContain('test_trust_score');
      expect(metrics).toContain('domain="auth"');
    });

    it('should record behavior trust score', async () => {
      exporter.recordTrustScore({
        domain: 'auth',
        behavior: 'Login',
        score: 94,
      });

      const metrics = await exporter.metrics();
      
      expect(metrics).toContain('test_trust_score_behavior');
      expect(metrics).toContain('behavior="Login"');
    });
  });

  describe('metrics output', () => {
    it('should return Prometheus text format', async () => {
      exporter.recordVerification({
        domain: 'test',
        behavior: 'TestBehavior',
        verdict: 'verified',
        score: 100,
        duration: 1.0,
        coverage: { preconditions: 1.0, postconditions: 1.0, invariants: 1.0 },
      });

      const metrics = await exporter.metrics();
      
      // Check Prometheus format
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
    });

    it('should return correct content type', () => {
      const contentType = exporter.contentType();
      expect(contentType).toContain('text/plain');
    });
  });

  describe('reset', () => {
    it('should reset all metrics', async () => {
      exporter.recordVerification({
        domain: 'auth',
        behavior: 'Login',
        verdict: 'verified',
        score: 94,
        duration: 1.0,
        coverage: { preconditions: 1.0, postconditions: 1.0, invariants: 1.0 },
      });

      let metrics = await exporter.metrics();
      expect(metrics).toContain('test_verification_total');

      exporter.reset();

      metrics = await exporter.metrics();
      // After reset, counters should be at 0
      expect(metrics).not.toContain('verdict="verified"} 1');
    });
  });
});

describe('MetricsCollector', () => {
  describe('createCollector', () => {
    it('should create a collector for a domain', () => {
      const collector = createCollector({ domain: 'auth' });
      expect(collector).toBeDefined();
    });

    it('should transform verifier results', () => {
      const results: VerifyMetricResult[] = [];
      
      const collector = createCollector({
        domain: 'auth',
        onVerification: (result) => results.push(result),
      });

      collector.collect({
        success: true,
        verdict: 'verified',
        score: 95,
        behaviorName: 'Login',
        inputUsed: { category: 'valid', name: 'basic' },
        execution: { duration: 150 },
        coverage: {
          preconditions: { passed: 3, total: 3 },
          postconditions: { passed: 4, total: 5 },
          invariants: { passed: 2, total: 2 },
          overall: 90,
        },
        timing: { total: 200, execution: 150 },
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.domain).toBe('auth');
      expect(results[0]?.behavior).toBe('Login');
      expect(results[0]?.verdict).toBe('verified');
      expect(results[0]?.coverage.preconditions).toBe(1);
      expect(results[0]?.coverage.postconditions).toBe(0.8);
    });

    it('should calculate trust score', () => {
      const collector = createCollector({ domain: 'auth' });

      collector.collect({
        success: true,
        verdict: 'verified',
        score: 95,
        behaviorName: 'Login',
        inputUsed: { category: 'valid', name: 'basic' },
        execution: { duration: 150 },
        coverage: {
          preconditions: { passed: 3, total: 3 },
          postconditions: { passed: 4, total: 4 },
          invariants: { passed: 2, total: 2 },
          overall: 100,
        },
        timing: { total: 200, execution: 150 },
      });

      collector.collect({
        success: true,
        verdict: 'risky',
        score: 75,
        behaviorName: 'Logout',
        inputUsed: { category: 'valid', name: 'basic' },
        execution: { duration: 100 },
        coverage: {
          preconditions: { passed: 2, total: 2 },
          postconditions: { passed: 3, total: 4 },
          invariants: { passed: 1, total: 1 },
          overall: 85,
        },
        timing: { total: 150, execution: 100 },
      });

      const trustScore = collector.calculateTrustScore();
      expect(trustScore).toBe(85); // Average of 95 and 75
    });
  });

  describe('createBatchCollector', () => {
    it('should create collectors for multiple domains', () => {
      const batch = createBatchCollector();
      
      const authCollector = batch.forDomain('auth');
      const paymentCollector = batch.forDomain('payment');
      
      expect(authCollector).toBeDefined();
      expect(paymentCollector).toBeDefined();
      expect(authCollector).not.toBe(paymentCollector);
    });

    it('should collect from multiple domains', () => {
      const results: VerifyMetricResult[] = [];
      
      const batch = createBatchCollector();
      batch.onVerification((result) => results.push(result));

      batch.collect('auth', {
        success: true,
        verdict: 'verified',
        score: 95,
        behaviorName: 'Login',
        inputUsed: { category: 'valid', name: 'basic' },
        execution: { duration: 150 },
        coverage: {
          preconditions: { passed: 3, total: 3 },
          postconditions: { passed: 4, total: 4 },
          invariants: { passed: 2, total: 2 },
          overall: 100,
        },
        timing: { total: 200, execution: 150 },
      });

      batch.collect('payment', {
        success: true,
        verdict: 'verified',
        score: 90,
        behaviorName: 'ProcessPayment',
        inputUsed: { category: 'valid', name: 'basic' },
        execution: { duration: 250 },
        coverage: {
          preconditions: { passed: 5, total: 5 },
          postconditions: { passed: 6, total: 6 },
          invariants: { passed: 3, total: 3 },
          overall: 100,
        },
        timing: { total: 300, execution: 250 },
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.domain).toBe('auth');
      expect(results[1]?.domain).toBe('payment');
    });

    it('should get all trust scores', () => {
      const batch = createBatchCollector();

      batch.collect('auth', {
        success: true,
        verdict: 'verified',
        score: 95,
        behaviorName: 'Login',
        inputUsed: { category: 'valid', name: 'basic' },
        execution: { duration: 150 },
        coverage: {
          preconditions: { passed: 3, total: 3 },
          postconditions: { passed: 4, total: 4 },
          invariants: { passed: 2, total: 2 },
          overall: 100,
        },
        timing: { total: 200, execution: 150 },
      });

      batch.collect('payment', {
        success: true,
        verdict: 'risky',
        score: 75,
        behaviorName: 'ProcessPayment',
        inputUsed: { category: 'valid', name: 'basic' },
        execution: { duration: 250 },
        coverage: {
          preconditions: { passed: 4, total: 5 },
          postconditions: { passed: 5, total: 6 },
          invariants: { passed: 2, total: 3 },
          overall: 80,
        },
        timing: { total: 300, execution: 250 },
      });

      const scores = batch.getAllTrustScores();
      
      expect(scores.get('auth')).toBe(95);
      expect(scores.get('payment')).toBe(75);
    });
  });
});

describe('HTTP Server', () => {
  let exporter: PrometheusExporter;

  beforeEach(() => {
    exporter = new PrometheusExporter({
      port: 19090, // Use non-standard port for tests
      collectDefaultMetrics: false,
    });
  });

  afterEach(async () => {
    await exporter.close().catch(() => {});
  });

  it('should start and stop server', async () => {
    await exporter.listen();
    // Server should be running
    await exporter.close();
    // Server should be stopped
  });

  it('should serve metrics', async () => {
    exporter.recordVerification({
      domain: 'test',
      behavior: 'Test',
      verdict: 'verified',
      score: 100,
      duration: 1.0,
      coverage: { preconditions: 1.0, postconditions: 1.0, invariants: 1.0 },
    });

    await exporter.listen();

    // Fetch metrics
    const response = await fetch('http://localhost:19090/metrics');
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain('isl_verification_total');
  });

  it('should serve health check', async () => {
    await exporter.listen();

    const response = await fetch('http://localhost:19090/health');
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe('OK');
  });
});
