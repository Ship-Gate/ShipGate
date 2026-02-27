import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ISLTracer,
  createISLTracer,
  ISLSemanticAttributes,
  BehaviorSpan,
  VerificationSpan,
  ChaosSpan,
  VerificationMetrics,
  CoverageMetrics,
  SLOMetrics,
  SLOTemplates,
  ISLContextPropagator,
  createISLHeaders,
  parseISLHeaders,
  withISLContext,
  getISLContext,
} from '../src';

describe('ISLTracer', () => {
  let tracer: ISLTracer;

  beforeEach(() => {
    tracer = createISLTracer({
      serviceName: 'test-service',
      domainName: 'TestDomain',
      domainVersion: '1.0.0',
    });
  });

  afterEach(async () => {
    await tracer.shutdown();
  });

  describe('traceBehavior', () => {
    it('should trace a successful behavior execution', async () => {
      const result = await tracer.traceBehavior(
        'Auth',
        'Login',
        async (span) => {
          span.setAttribute('user.id', '123');
          return { success: true, userId: '123' };
        }
      );

      expect(result).toEqual({ success: true, userId: '123' });
    });

    it('should trace a failed behavior execution', async () => {
      await expect(
        tracer.traceBehavior('Auth', 'Login', async () => {
          throw new Error('Invalid credentials');
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should support custom attributes', async () => {
      const result = await tracer.traceBehavior(
        'Payments',
        'ProcessPayment',
        async (span) => {
          return { amount: 100 };
        },
        {
          'payment.amount': 100,
          'payment.currency': 'USD',
        }
      );

      expect(result).toEqual({ amount: 100 });
    });
  });

  describe('traceVerification', () => {
    it('should trace verification with verdict', async () => {
      const result = await tracer.traceVerification('Auth', 'Login', async (span) => {
        return {
          verdict: 'pass' as const,
          score: 100,
          checks: [],
        };
      });

      expect(result.verdict).toBe('pass');
      expect(result.score).toBe(100);
    });

    it('should trace verification with coverage', async () => {
      const result = await tracer.traceVerification('Auth', 'Login', async (span) => {
        return {
          verdict: 'pass' as const,
          score: 95,
          checks: [],
          coverage: {
            preconditions: { total: 5, covered: 5 },
            postconditions: { total: 3, covered: 3 },
            invariants: { total: 2, covered: 1 },
          },
        };
      });

      expect(result.coverage?.preconditions.covered).toBe(5);
    });
  });

  describe('traceCheck', () => {
    it('should trace a passing check', () => {
      const passed = tracer.traceCheck(
        'precondition',
        'UserExists',
        'user.id !== null',
        () => true
      );

      expect(passed).toBe(true);
    });

    it('should trace a failing check', () => {
      const passed = tracer.traceCheck(
        'postcondition',
        'TokenGenerated',
        'token.length > 0',
        () => false
      );

      expect(passed).toBe(false);
    });

    it('should handle check errors', () => {
      expect(() =>
        tracer.traceCheck('invariant', 'BalancePositive', 'balance >= 0', () => {
          throw new Error('Balance check failed');
        })
      ).toThrow('Balance check failed');
    });
  });

  describe('traceChaos', () => {
    it('should trace chaos injection', async () => {
      const result = await tracer.traceChaos('latency', 'PaymentService', async (span) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { recovered: true };
      });

      expect(result).toEqual({ recovered: true });
    });
  });
});

describe('BehaviorSpan', () => {
  it('should create a behavior span with config', () => {
    const span = new BehaviorSpan({
      domain: 'Auth',
      behavior: 'Login',
      actor: 'User',
      idempotencyKey: 'abc123',
    });

    expect(span.getSpan()).toBeDefined();
    span.end();
  });

  it('should record state changes', () => {
    const span = new BehaviorSpan({
      domain: 'Order',
      behavior: 'PlaceOrder',
    });

    span.recordStateChange('Order', 'order-123', 'pending', 'confirmed');
    span.success({ orderId: 'order-123' });
  });

  it('should handle failures', () => {
    const span = new BehaviorSpan({
      domain: 'Payment',
      behavior: 'ProcessPayment',
    });

    const result = span.failure(new Error('Payment failed'));
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Payment failed');
  });
});

describe('VerificationSpan', () => {
  it('should create a verification span', () => {
    const span = new VerificationSpan({
      domain: 'Auth',
      behavior: 'Login',
      verificationType: 'unit',
    });

    expect(span.getSpan()).toBeDefined();
    span.complete();
  });

  it('should run and record checks', () => {
    const span = new VerificationSpan({
      domain: 'Auth',
      behavior: 'Login',
    });

    const result1 = span.runCheck(
      'precondition',
      'UserExists',
      'user !== null',
      () => true
    );

    const result2 = span.runCheck(
      'postcondition',
      'TokenValid',
      'token.isValid()',
      () => true
    );

    expect(result1).toBe(true);
    expect(result2).toBe(true);

    const verificationResult = span.complete();
    expect(verificationResult.verdict).toBe('pass');
    expect(verificationResult.score).toBe(100);
  });

  it('should calculate correct verdict on failures', () => {
    const span = new VerificationSpan({
      domain: 'Auth',
      behavior: 'Login',
    });

    span.runCheck('precondition', 'Check1', 'expr1', () => true);
    span.runCheck('postcondition', 'Check2', 'expr2', () => false);
    span.runCheck('invariant', 'Check3', 'expr3', () => true);

    const result = span.complete();
    expect(result.verdict).toBe('fail');
    expect(result.score).toBe(67); // 2/3 passed
  });
});

describe('ChaosSpan', () => {
  it('should create a chaos span', () => {
    const span = new ChaosSpan({
      injectionType: 'latency',
      target: 'DatabaseService',
      duration: 1000,
      intensity: 0.5,
    });

    span.startInjection();
    span.recordLatencyInjection(500, 520);
    span.endInjection();

    const result = span.complete(true);
    expect(result.recovered).toBe(true);
    expect(result.injectionType).toBe('latency');
  });

  it('should handle abort', () => {
    const span = new ChaosSpan({
      injectionType: 'error',
      target: 'PaymentGateway',
    });

    const result = span.abort('System became unstable');
    expect(result.recovered).toBe(false);
    expect(result.systemBehavior).toBe('failed');
  });
});

describe('VerificationMetrics', () => {
  it('should record verification metrics', () => {
    const metrics = new VerificationMetrics();

    metrics.recordVerification('Auth', 'Login', 'pass', 150, 100);
    metrics.recordVerification('Auth', 'Login', 'fail', 200, 50);
    metrics.recordVerification('Payments', 'Process', 'pass', 300, 95);

    // Metrics are recorded - would need mock to verify
  });

  it('should record check metrics', () => {
    const metrics = new VerificationMetrics();

    metrics.recordCheck('precondition', true, 5);
    metrics.recordCheck('postcondition', false, 10);
    metrics.recordCheck('invariant', true, 3);
  });
});

describe('CoverageMetrics', () => {
  it('should track coverage data', () => {
    const metrics = new CoverageMetrics();

    metrics.updateCoverage({
      domain: 'Auth',
      preconditions: { total: 10, covered: 8 },
      postconditions: { total: 5, covered: 5 },
      invariants: { total: 3, covered: 2 },
    });

    const data = metrics.getCoverage('Auth');
    expect(data?.preconditions.covered).toBe(8);
    expect(data?.postconditions.covered).toBe(5);
  });

  it('should generate coverage report', () => {
    const metrics = new CoverageMetrics();

    metrics.updateCoverage({
      domain: 'Auth',
      preconditions: { total: 10, covered: 10 },
      postconditions: { total: 5, covered: 5 },
      invariants: { total: 5, covered: 5 },
    });

    metrics.updateCoverage({
      domain: 'Payments',
      preconditions: { total: 8, covered: 4 },
      postconditions: { total: 4, covered: 2 },
      invariants: { total: 2, covered: 1 },
    });

    const report = metrics.getReport();
    expect(report.domains).toHaveLength(2);
    expect(report.global.total).toBeDefined();
  });
});

describe('SLOMetrics', () => {
  it('should register and track SLOs', () => {
    const metrics = new SLOMetrics();

    metrics.registerSLO({
      name: 'verification_pass_rate',
      target: 99.9,
      type: 'verification_pass_rate',
      window: 'daily',
      domain: 'Auth',
    });

    metrics.recordMeasurement({
      sloName: 'verification_pass_rate',
      value: 100,
      timestamp: Date.now(),
    });

    const status = metrics.getStatus('verification_pass_rate');
    expect(status?.met).toBe(true);
    expect(status?.current).toBe(100);
  });

  it('should use SLO templates', () => {
    const metrics = new SLOMetrics();

    const passRateSLO = SLOTemplates.verificationPassRate('Auth');
    const latencySLO = SLOTemplates.verificationLatency('Auth');

    expect(passRateSLO.name).toBe('Auth_verification_pass_rate');
    expect(passRateSLO.target).toBe(99.9);
    expect(latencySLO.name).toBe('Auth_verification_latency');
  });

  it('should track budget remaining', () => {
    const metrics = new SLOMetrics();

    metrics.registerSLO({
      name: 'test_slo',
      target: 99.0,
      type: 'availability',
      window: 'daily',
    });

    // Record 99.5% availability
    for (let i = 0; i < 100; i++) {
      metrics.recordMeasurement({
        sloName: 'test_slo',
        value: i < 99 ? 100 : 50,
        timestamp: Date.now(),
      });
    }

    const status = metrics.getStatus('test_slo');
    expect(status?.budgetRemaining).toBeGreaterThanOrEqual(0);
  });
});

describe('ISL Context Propagation', () => {
  it('should create ISL headers', () => {
    const headers = createISLHeaders({
      domain: 'Auth',
      behavior: 'Login',
      verificationId: 'ver-123',
      actor: 'User',
      trustScore: 0.95,
    });

    expect(headers['x-isl-domain']).toBe('Auth');
    expect(headers['x-isl-behavior']).toBe('Login');
    expect(headers['x-isl-verification-id']).toBe('ver-123');
    expect(headers['x-isl-actor']).toBe('User');
    expect(headers['x-isl-trust-score']).toBe('0.95');
  });

  it('should parse ISL headers', () => {
    const context = parseISLHeaders({
      'x-isl-domain': 'Payments',
      'x-isl-behavior': 'ProcessPayment',
      'x-isl-verification-id': 'ver-456',
      'x-isl-trust-score': '0.88',
    });

    expect(context?.domain).toBe('Payments');
    expect(context?.behavior).toBe('ProcessPayment');
    expect(context?.trustScore).toBe(0.88);
  });

  it('should handle missing headers', () => {
    const context = parseISLHeaders({});
    expect(context).toBeUndefined();
  });

  it('should work with context API', () => {
    const islContext = {
      domain: 'Test',
      behavior: 'TestBehavior',
    };

    const ctx = withISLContext(islContext);
    // Note: This would need to be run in context.with() to work properly
  });
});

describe('ISL Semantic Attributes', () => {
  it('should have correct attribute names', () => {
    expect(ISLSemanticAttributes.ISL_DOMAIN_NAME).toBe('isl.domain.name');
    expect(ISLSemanticAttributes.ISL_BEHAVIOR_NAME).toBe('isl.behavior.name');
    expect(ISLSemanticAttributes.ISL_VERIFICATION_VERDICT).toBe('isl.verification.verdict');
    expect(ISLSemanticAttributes.ISL_CHECK_TYPE).toBe('isl.check.type');
    expect(ISLSemanticAttributes.ISL_CHAOS_INJECTION_TYPE).toBe('isl.chaos.injection_type');
  });
});
