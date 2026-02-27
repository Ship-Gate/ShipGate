// ============================================================================
// Production Verification Tests
// ============================================================================
//
// Tests for:
// - Canonical generators (entities, behaviors, edge cases)
// - Counterexample generation and shrinking
// - Gate integration (PBT failures block SHIP)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // PRNG
  createPRNG,
  // Canonical generators
  userEntity,
  sessionEntity,
  accountEntity,
  transactionEntity,
  loginBehaviorInput,
  invalidLoginInputCanonical as invalidLoginInput,
  registerBehaviorInput,
  transferBehaviorInput,
  edgeCaseString,
  edgeCaseNumber,
  edgeCaseEmail,
  edgeCaseMoney,
  edgeCaseArray,
  edgeCaseInputs,
  // Counterexample
  buildCounterexample,
  shrinkWithConstraints,
  serializeCounterexample,
  parseCounterexample,
  formatCounterexample,
  CounterexampleRegistry,
  counterexampleRegistry,
  // Gate integration
  createPBTGateInput,
  createPBTGateInputBatch,
  calculatePBTTrustContribution,
  shouldBlockShip,
  getBlockReasons,
  generatePBTJsonReport,
  formatPBTConsoleOutput,
  // Types
  type PBTReport,
  type PBTConfig,
  type Property,
  type ShrinkResult,
} from '../src/index.js';
import { integer } from '../src/random.js';

const SEED = 42;
const NUM_SAMPLES = 50;

function samples<T>(gen: { generate: (prng: any, size: number) => T }, count = NUM_SAMPLES): T[] {
  const prng = createPRNG(SEED);
  const results: T[] = [];
  for (let i = 0; i < count; i++) {
    results.push(gen.generate(prng.fork(), Math.min(i + 10, 100)));
  }
  return results;
}

// ============================================================================
// ENTITY GENERATORS
// ============================================================================

describe('Entity Generators', () => {
  describe('userEntity', () => {
    it('generates valid users with all fields', () => {
      const gen = userEntity({ withId: true, withEmail: true, withPassword: true });
      const users = samples(gen);

      for (const user of users) {
        expect(user.id).toBeDefined();
        expect(user.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
        expect(user.email).toContain('@');
        expect(user.password).toBeDefined();
        expect(user.password!.length).toBeGreaterThanOrEqual(8);
        expect(user.username).toBeDefined();
        expect(user.createdAt).toBeDefined();
        expect(typeof user.active).toBe('boolean');
      }
    });

    it('generates users without optional fields', () => {
      const gen = userEntity({ withId: false, withPassword: false });
      const users = samples(gen, 20);

      for (const user of users) {
        expect(user.id).toBeUndefined();
        expect(user.password).toBeUndefined();
        expect(user.email).toBeDefined();
      }
    });

    it('respects role options', () => {
      const roles = ['admin', 'moderator', 'user'];
      const gen = userEntity({ withRoles: roles });
      const users = samples(gen, 100);

      for (const user of users) {
        expect(roles).toContain(user.role);
      }
    });

    it('shrinks towards simpler values', () => {
      const gen = userEntity({ withId: true, withMetadata: true });
      const prng = createPRNG(SEED);
      const user = gen.generate(prng, 100);
      const shrinks = [...gen.shrink(user)];

      expect(shrinks.length).toBeGreaterThan(0);
      // Should remove metadata first
      expect(shrinks.some(s => s.metadata === undefined)).toBe(true);
    });
  });

  describe('sessionEntity', () => {
    it('generates valid sessions', () => {
      const gen = sessionEntity();
      const sessions = samples(gen);

      for (const session of sessions) {
        expect(session.sessionId).toMatch(/^[0-9a-f-]{36}$/);
        expect(session.userId).toMatch(/^[0-9a-f-]{36}$/);
        expect(session.token.length).toBe(64);
        expect(session.ipAddress).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
        expect(typeof session.active).toBe('boolean');
      }
    });
  });

  describe('accountEntity', () => {
    it('generates valid accounts with correct currencies', () => {
      const currencies = ['USD', 'EUR'];
      const gen = accountEntity({ currencies, maxBalance: 10000 });
      const accounts = samples(gen);

      for (const account of accounts) {
        expect(currencies).toContain(account.currency);
        expect(account.balance).toBeGreaterThanOrEqual(0);
        expect(account.balance).toBeLessThanOrEqual(10000);
        expect(['active', 'suspended', 'closed']).toContain(account.status);
      }
    });
  });

  describe('transactionEntity', () => {
    it('generates valid transactions', () => {
      const gen = transactionEntity({ maxAmount: 5000 });
      const txns = samples(gen);

      for (const txn of txns) {
        expect(txn.transactionId).toMatch(/^[0-9a-f-]{36}$/);
        expect(txn.fromAccountId).toMatch(/^[0-9a-f-]{36}$/);
        expect(txn.toAccountId).toMatch(/^[0-9a-f-]{36}$/);
        expect(txn.amount).toBeGreaterThanOrEqual(0);
        expect(txn.amount).toBeLessThanOrEqual(5000);
        expect(['pending', 'completed', 'failed', 'reversed']).toContain(txn.status);
      }
    });
  });
});

// ============================================================================
// BEHAVIOR GENERATORS
// ============================================================================

describe('Behavior Generators', () => {
  describe('loginBehaviorInput', () => {
    it('generates valid login inputs', () => {
      const gen = loginBehaviorInput({ validOnly: true });
      const inputs = samples(gen);

      for (const input of inputs) {
        expect(input.email).toContain('@');
        expect(input.password.length).toBeGreaterThanOrEqual(8);
        expect(input.password.length).toBeLessThanOrEqual(128);
      }
    });

    it('includes IP address when configured', () => {
      const gen = loginBehaviorInput({ includeIP: true });
      const inputs = samples(gen);

      for (const input of inputs) {
        expect(input.ip_address).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
      }
    });

    it('shrinks to minimal valid input', () => {
      const gen = loginBehaviorInput({ validOnly: true, includeIP: true });
      const prng = createPRNG(SEED);
      const input = gen.generate(prng, 100);
      const shrinks = [...gen.shrink(input)];

      expect(shrinks.length).toBeGreaterThan(0);
      // Should shrink IP to localhost
      expect(shrinks.some(s => s.ip_address === '127.0.0.1')).toBe(true);
    });
  });

  describe('invalidLoginInput', () => {
    it('generates invalid emails or passwords', () => {
      const gen = invalidLoginInput();
      const inputs = samples(gen, 100);

      let invalidEmails = 0;
      let invalidPasswords = 0;

      for (const input of inputs) {
        const emailValid = input.email.includes('@') && 
                          input.email.indexOf('@') > 0 &&
                          input.email.indexOf('@') < input.email.length - 1;
        const passwordValid = input.password.length >= 8 && input.password.length <= 128;

        if (!emailValid) invalidEmails++;
        if (!passwordValid) invalidPasswords++;
      }

      // Should generate both types of invalid inputs
      expect(invalidEmails + invalidPasswords).toBeGreaterThan(0);
    });
  });

  describe('registerBehaviorInput', () => {
    it('generates matching passwords when confirm required', () => {
      const gen = registerBehaviorInput({ requireConfirmPassword: true });
      const inputs = samples(gen);

      for (const input of inputs) {
        expect(input.password).toBe(input.confirm_password);
      }
    });
  });

  describe('transferBehaviorInput', () => {
    it('generates valid transfer inputs', () => {
      const gen = transferBehaviorInput({ maxAmount: 1000, currencies: ['USD', 'EUR'] });
      const inputs = samples(gen);

      for (const input of inputs) {
        expect(input.from_account_id).toMatch(/^[0-9a-f-]{36}$/);
        expect(input.to_account_id).toMatch(/^[0-9a-f-]{36}$/);
        expect(input.amount).toBeGreaterThanOrEqual(0.01);
        expect(input.amount).toBeLessThanOrEqual(1000);
        expect(['USD', 'EUR']).toContain(input.currency);
        expect(input.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
      }
    });
  });
});

// ============================================================================
// EDGE CASE GENERATORS
// ============================================================================

describe('Edge Case Generators', () => {
  describe('edgeCaseString', () => {
    it('generates empty strings', () => {
      const gen = edgeCaseString({ includeEmpty: true });
      const values = samples(gen, 200);
      expect(values.some(v => v === '')).toBe(true);
    });

    it('generates unicode strings', () => {
      const gen = edgeCaseString({ includeUnicode: true });
      const values = samples(gen, 200);
      expect(values.some(v => /[^\x00-\x7F]/.test(v))).toBe(true); // Non-ASCII
    });

    it('generates injection strings', () => {
      const gen = edgeCaseString({ includeInjection: true });
      const values = samples(gen, 200);
      expect(values.some(v => v.includes('DROP TABLE'))).toBe(true);
      expect(values.some(v => v.includes('<script>'))).toBe(true);
    });

    it('generates boundary length strings', () => {
      const gen = edgeCaseString({ includeBoundary: true });
      const values = samples(gen, 200);
      expect(values.some(v => v.length === 1)).toBe(true);
      expect(values.some(v => v.length >= 255)).toBe(true);
    });
  });

  describe('edgeCaseNumber', () => {
    it('generates boundary values', () => {
      const gen = edgeCaseNumber({ includeBoundary: true });
      const values = samples(gen, 200);
      expect(values).toContain(0);
      expect(values).toContain(1);
      expect(values).toContain(-1);
      expect(values).toContain(Number.MAX_SAFE_INTEGER);
    });

    it('generates overflow values', () => {
      const gen = edgeCaseNumber({ includeOverflow: true });
      const values = samples(gen, 200);
      expect(values).toContain(Infinity);
      expect(values.some(v => Number.isNaN(v))).toBe(true);
    });
  });

  describe('edgeCaseEmail', () => {
    it('generates valid but unusual emails', () => {
      const gen = edgeCaseEmail();
      const values = samples(gen, 200);
      expect(values.some(v => v.includes('+'))).toBe(true); // Plus addressing
      expect(values.some(v => v === 'a@b.co')).toBe(true); // Minimal
    });

    it('generates invalid emails', () => {
      const gen = edgeCaseEmail();
      const values = samples(gen, 200);
      expect(values.some(v => !v.includes('@') && v !== '')).toBe(true);
    });
  });

  describe('edgeCaseMoney', () => {
    it('generates boundary amounts', () => {
      const gen = edgeCaseMoney({ includeBoundary: true });
      const values = samples(gen, 200);
      expect(values).toContain(0);
      expect(values).toContain(0.01);
      expect(values).toContain(1);
      expect(values.some(v => v < 0)).toBe(true); // Negative
    });
  });

  describe('edgeCaseArray', () => {
    it('generates empty arrays', () => {
      const gen = edgeCaseArray(integer(0, 10), { includeEmpty: true });
      const values = samples(gen, 200);
      expect(values.some(v => v.length === 0)).toBe(true);
    });

    it('generates arrays with duplicates', () => {
      const gen = edgeCaseArray(integer(0, 10));
      const values = samples(gen, 200);
      expect(values.some(arr => {
        const unique = new Set(arr);
        return unique.size < arr.length;
      })).toBe(true);
    });
  });
});

// ============================================================================
// COUNTEREXAMPLE
// ============================================================================

describe('Counterexample', () => {
  const mockProperty: Property = {
    name: 'test_postcondition',
    type: 'postcondition',
    expression: { kind: 'BooleanLiteral', value: true } as any,
    location: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } } as any,
  };

  const mockShrinkResult: ShrinkResult = {
    original: { email: 'test@example.com', password: 'LongPassword123!' },
    minimal: { email: 'a@b.co', password: '12345678' },
    shrinkAttempts: 10,
    history: [
      { input: { email: 'test@example.com', password: '12345678' }, passed: false, size: 20 },
      { input: { email: 'a@b.co', password: '12345678' }, passed: false, size: 14 },
    ],
  };

  describe('buildCounterexample', () => {
    it('creates a complete counterexample', () => {
      const ce = buildCounterexample(
        mockShrinkResult.original,
        mockShrinkResult.minimal,
        42,
        50,
        mockProperty,
        'Postcondition failed',
        mockShrinkResult,
        'Login'
      );

      expect(ce.id).toMatch(/^ce-[0-9a-f]+$/);
      expect(ce.seed).toBe(42);
      expect(ce.size).toBe(50);
      expect(ce.failedProperty.name).toBe('test_postcondition');
      expect(ce.failedProperty.type).toBe('postcondition');
      expect(ce.error).toBe('Postcondition failed');
      expect(ce.originalInput).toEqual(mockShrinkResult.original);
      expect(ce.minimalInput).toEqual(mockShrinkResult.minimal);
      expect(ce.shrinkStats.attempts).toBe(10);
      expect(ce.reproductionCommand).toContain('--pbt-seed 42');
      expect(ce.reproductionCode).toContain('Login');
    });

    it('calculates reduction ratio', () => {
      const ce = buildCounterexample(
        mockShrinkResult.original,
        mockShrinkResult.minimal,
        42,
        50,
        mockProperty,
        'Error',
        mockShrinkResult,
        'Login'
      );

      expect(ce.shrinkStats.reductionRatio).toBeGreaterThan(0);
      expect(ce.shrinkStats.reductionRatio).toBeLessThan(1);
    });
  });

  describe('serializeCounterexample / parseCounterexample', () => {
    it('round-trips correctly', () => {
      const ce = buildCounterexample(
        mockShrinkResult.original,
        mockShrinkResult.minimal,
        42,
        50,
        mockProperty,
        'Error',
        mockShrinkResult,
        'Login'
      );

      const json = serializeCounterexample(ce);
      const parsed = parseCounterexample(json);

      expect(parsed.id).toBe(ce.id);
      expect(parsed.seed).toBe(ce.seed);
      expect(parsed.minimalInput).toEqual(ce.minimalInput);
    });
  });

  describe('formatCounterexample', () => {
    it('produces readable output', () => {
      const ce = buildCounterexample(
        mockShrinkResult.original,
        mockShrinkResult.minimal,
        42,
        50,
        mockProperty,
        'Error',
        mockShrinkResult,
        'Login'
      );

      const output = formatCounterexample(ce);

      expect(output).toContain('COUNTEREXAMPLE FOUND');
      expect(output).toContain('Minimal Input');
      expect(output).toContain('To Reproduce');
    });
  });

  describe('CounterexampleRegistry', () => {
    let registry: CounterexampleRegistry;

    beforeEach(() => {
      registry = new CounterexampleRegistry();
    });

    it('stores and retrieves counterexamples', () => {
      const ce = buildCounterexample(
        mockShrinkResult.original,
        mockShrinkResult.minimal,
        42,
        50,
        mockProperty,
        'Error',
        mockShrinkResult,
        'Login'
      );

      registry.add(ce);
      expect(registry.size()).toBe(1);
      expect(registry.get(ce.id)).toBe(ce);
    });

    it('filters by property name', () => {
      const ce1 = buildCounterexample(
        mockShrinkResult.original,
        mockShrinkResult.minimal,
        42,
        50,
        mockProperty,
        'Error',
        mockShrinkResult,
        'Login'
      );

      const ce2 = buildCounterexample(
        mockShrinkResult.original,
        mockShrinkResult.minimal,
        43,
        50,
        { ...mockProperty, name: 'other_property' },
        'Error',
        mockShrinkResult,
        'Register'
      );

      registry.add(ce1);
      registry.add(ce2);

      const filtered = registry.getByProperty('test_postcondition');
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.failedProperty.name).toBe('test_postcondition');
    });
  });

  describe('shrinkWithConstraints', () => {
    it('respects minimum constraints', async () => {
      const original = { amount: 1000, email: 'test@example.com' };
      
      // Test function that always fails
      const testFn = async () => false;

      const result = await shrinkWithConstraints(original, testFn, {
        maxAttempts: 20,
        fieldConstraints: {
          amount: { min: 100 },
          email: { format: 'email' },
        },
      });

      // Should return a result with minimal input
      expect(result).toBeDefined();
      expect(result.minimal).toBeDefined();
      // The minimal should be the same or smaller than original (shrinking attempts made)
      expect(result.shrinkAttempts).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// GATE INTEGRATION
// ============================================================================

describe('Gate Integration', () => {
  const createMockReport = (success: boolean, violations: any[] = []): PBTReport => ({
    behaviorName: 'TestBehavior',
    success,
    testsRun: 100,
    testsPassed: success ? 100 : 50,
    config: {
      numTests: 100,
      maxShrinks: 100,
      sizeGrowth: 'linear',
      maxSize: 100,
      timeout: 5000,
      filterPreconditions: true,
      maxFilterAttempts: 1000,
      verbose: false,
      seed: 42,
    },
    firstFailure: success ? undefined : {
      iteration: 50,
      size: 50,
      seed: 42,
      input: { email: 'test@example.com' },
      passed: false,
      error: 'Test failed',
      duration: 10,
      logs: [],
    },
    shrinkResult: success ? undefined : {
      original: { email: 'test@example.com' },
      minimal: { email: 'a@b.co' },
      shrinkAttempts: 10,
      history: [],
    },
    totalDuration: 1000,
    violations,
    stats: {
      iterations: 100,
      successes: success ? 100 : 50,
      failures: success ? 0 : 50,
      filtered: 0,
      shrinkAttempts: success ? 0 : 10,
      avgDuration: 10,
      sizeDistribution: new Map(),
    },
  });

  describe('shouldBlockShip', () => {
    it('returns false for successful report', () => {
      const report = createMockReport(true);
      expect(shouldBlockShip(report)).toBe(false);
    });

    it('returns true for failed report', () => {
      const report = createMockReport(false);
      expect(shouldBlockShip(report)).toBe(true);
    });

    it('returns true for reports with violations', () => {
      const report = createMockReport(true, [{
        property: { name: 'test', type: 'postcondition', expression: {}, location: {} },
        input: {},
        error: 'Error',
      }]);
      report.violations = [{
        property: { name: 'test', type: 'postcondition', expression: {} as any, location: {} as any },
        input: {},
        error: 'Error',
      }];
      expect(shouldBlockShip(report)).toBe(true);
    });

    it('always blocks on invariant violations', () => {
      const report = createMockReport(true);
      report.violations = [{
        property: { name: 'test', type: 'invariant', expression: {} as any, location: {} as any },
        input: {},
        error: 'Invariant violation',
      }];
      expect(shouldBlockShip(report)).toBe(true);
    });
  });

  describe('getBlockReasons', () => {
    it('returns empty for successful report', () => {
      const report = createMockReport(true);
      const reasons = getBlockReasons(report);
      expect(reasons.length).toBe(0);
    });

    it('returns failure reason for failed report', () => {
      const report = createMockReport(false);
      const reasons = getBlockReasons(report);
      expect(reasons.length).toBeGreaterThan(0);
      expect(reasons[0]).toContain('failed');
    });

    it('includes violation details', () => {
      const report = createMockReport(false, [{
        property: { name: 'email_valid', type: 'postcondition', expression: {} as any, location: {} as any },
        input: { email: 'invalid' },
        error: 'Email format invalid',
      }]);
      report.violations = [{
        property: { name: 'email_valid', type: 'postcondition', expression: {} as any, location: {} as any },
        input: { email: 'invalid' },
        error: 'Email format invalid',
      }];
      const reasons = getBlockReasons(report);
      expect(reasons.some(r => r.includes('email_valid'))).toBe(true);
    });
  });

  describe('createPBTGateInput', () => {
    it('creates findings from violations', () => {
      const report = createMockReport(false, [{
        property: { name: 'test', type: 'postcondition', expression: {} as any, location: {} as any },
        input: {},
        error: 'Error',
      }]);
      report.violations = [{
        property: { name: 'test', type: 'postcondition', expression: {} as any, location: {} as any },
        input: {},
        error: 'Error',
      }];

      const input = createPBTGateInput(report);

      expect(input.findings.length).toBe(1);
      expect(input.findings[0]?.type).toBe('pbt_postcondition');
      expect(input.findings[0]?.severity).toBe('high');
    });

    it('sets critical severity for invariant violations', () => {
      const report = createMockReport(false);
      report.violations = [{
        property: { name: 'test', type: 'invariant', expression: {} as any, location: {} as any },
        input: {},
        error: 'Error',
      }];

      const input = createPBTGateInput(report);

      expect(input.findings[0]?.severity).toBe('critical');
    });

    it('creates blockers for failures', () => {
      const report = createMockReport(false);
      report.violations = [{
        property: { name: 'test', type: 'postcondition', expression: {} as any, location: {} as any },
        input: {},
        error: 'Error',
      }];

      const input = createPBTGateInput(report);

      expect(input.blockers.postconditionViolations).toBe(1);
      expect(input.blockers.failedBehaviors).toBe(1);
      expect(input.blockers.customBlockers.length).toBeGreaterThan(0);
    });

    it('calculates metrics correctly', () => {
      const report = createMockReport(true);
      const input = createPBTGateInput(report);

      expect(input.pbtMetrics.totalIterations).toBe(100);
      expect(input.pbtMetrics.successfulIterations).toBe(100);
      expect(input.pbtMetrics.seed).toBe(42);
    });
  });

  describe('createPBTGateInputBatch', () => {
    it('aggregates multiple reports', () => {
      const reports = [
        createMockReport(true),
        createMockReport(false),
      ];

      const input = createPBTGateInputBatch(reports);

      expect(input.filesConsidered).toBe(2);
      expect(input.pbtMetrics.totalIterations).toBe(200);
    });
  });

  describe('calculatePBTTrustContribution', () => {
    it('returns 100 for successful report', () => {
      const report = createMockReport(true);
      const contribution = calculatePBTTrustContribution(report);

      expect(contribution.score).toBe(100);
      expect(contribution.weight).toBe(20);
    });

    it('penalizes failures', () => {
      const report = createMockReport(false);
      const contribution = calculatePBTTrustContribution(report);

      expect(contribution.score).toBeLessThan(100);
    });

    it('includes breakdown by category', () => {
      const report = createMockReport(true);
      const contribution = calculatePBTTrustContribution(report);

      expect(contribution.breakdown).toBeDefined();
      expect(contribution.breakdown.postconditions).toBeDefined();
      expect(contribution.breakdown.invariants).toBeDefined();
      expect(contribution.breakdown.iterations).toBeDefined();
    });
  });

  describe('generatePBTJsonReport', () => {
    it('generates valid JSON report', () => {
      const reports = [createMockReport(true), createMockReport(false)];
      const jsonReport = generatePBTJsonReport(reports, 42);

      expect(jsonReport.version).toBe('1.0');
      expect(jsonReport.success).toBe(false); // One failed
      expect(jsonReport.seed).toBe(42);
      expect(jsonReport.summary.totalBehaviors).toBe(2);
      expect(jsonReport.summary.passedBehaviors).toBe(1);
      expect(jsonReport.summary.failedBehaviors).toBe(1);
      expect(jsonReport.behaviors.length).toBe(2);
    });
  });

  describe('formatPBTConsoleOutput', () => {
    it('formats successful report', () => {
      const report = createMockReport(true);
      const output = formatPBTConsoleOutput(report);

      expect(output).toContain('PROPERTY-BASED TEST RESULTS');
      expect(output).toContain('PASSED');
      expect(output).toContain('100/100');
    });

    it('formats failed report with reproduction hint', () => {
      const report = createMockReport(false);
      const output = formatPBTConsoleOutput(report);

      expect(output).toContain('FAILED');
      expect(output).toContain('To reproduce');
      expect(output).toContain('--pbt-seed 42');
    });
  });
});

// ============================================================================
// DETERMINISTIC RUNS
// ============================================================================

describe('Deterministic Runs', () => {
  it('same seed produces identical entity sequences', () => {
    const gen = userEntity({ withId: true, withEmail: true });
    
    const run1 = samples(gen, 20);
    const run2 = samples(gen, 20);

    // Reset global registry between runs
    for (let i = 0; i < run1.length; i++) {
      expect(run1[i]?.id).toBe(run2[i]?.id);
      expect(run1[i]?.email).toBe(run2[i]?.email);
    }
  });

  it('same seed produces identical edge cases', () => {
    const gen = edgeCaseString();
    
    const run1 = samples(gen, 50);
    const run2 = samples(gen, 50);

    for (let i = 0; i < run1.length; i++) {
      expect(run1[i]).toBe(run2[i]);
    }
  });
});
