/**
 * Login Harness Tests
 * 
 * Integration tests for the login test harness.
 * Verifies:
 * - SUCCESS path works correctly
 * - INVALID_CREDENTIALS path works correctly
 * - USER_LOCKED path works correctly
 * - Traces are emitted in correct format
 * - Test count > 0 always (no scaffold-only)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LoginTestHarness,
  createLoginTestHarness,
  runLoginTests,
  runLoginTestsWithTraces,
  FixtureStore,
  createLoginHandler,
  hashPassword,
  verifyPassword,
  LOGIN_TEST_CASES,
  formatForISLVerify,
  assertTestsExecuted,
} from '../src/index.js';

describe('LoginTestHarness', () => {
  let harness: LoginTestHarness;

  beforeEach(() => {
    harness = createLoginTestHarness({ verbose: false });
  });

  describe('Core Scenarios', () => {
    it('should run all core scenarios (SUCCESS, INVALID_CREDENTIALS, USER_LOCKED)', async () => {
      const summary = await harness.runCoreScenarios();

      // Ensure tests count > 0 (no scaffold-only)
      expect(summary.total).toBeGreaterThan(0);
      expect(summary.results.length).toBeGreaterThan(0);

      // Check that all scenarios are covered
      const scenarios = new Set(summary.results.map(r => r.scenario));
      expect(scenarios.has('success')).toBe(true);
      expect(scenarios.has('invalid_credentials')).toBe(true);
      expect(scenarios.has('user_locked')).toBe(true);
    });

    it('should generate traces for each test', async () => {
      const summary = await harness.runCoreScenarios();

      expect(summary.traces.length).toBe(summary.total);

      for (const trace of summary.traces) {
        expect(trace.id).toBeDefined();
        expect(trace.domain).toBe('Auth');
        expect(trace.events.length).toBeGreaterThan(0);
        expect(trace.metadata?.testName).toBeDefined();
        expect(trace.metadata?.scenario).toBeDefined();
      }
    });

    it('should have all tests pass when implementation is correct', async () => {
      const summary = await harness.runCoreScenarios();

      // All tests should pass with the correct implementation
      expect(summary.failed).toBe(0);
      expect(summary.passed).toBe(summary.total);
    });
  });

  describe('SUCCESS Path', () => {
    it('should create session on valid credentials', async () => {
      const successTests = LOGIN_TEST_CASES.filter(tc => tc.scenario === 'success');
      
      for (const testCase of successTests) {
        const result = await harness.runTest(testCase);
        expect(result.passed).toBe(true);
        expect(result.scenario).toBe('success');
        
        // Check trace has handler_call and handler_return
        const trace = result.trace;
        const hasCall = trace.events.some(e => e.kind === 'handler_call');
        const hasReturn = trace.events.some(e => e.kind === 'handler_return');
        expect(hasCall).toBe(true);
        expect(hasReturn).toBe(true);
      }
    });

    it('should reset failed_attempts on successful login', async () => {
      const store = harness.getStore();
      store.clear();
      store.seedUser({
        id: 'user_reset',
        email: 'reset@example.com',
        password_hash: hashPassword('ValidPass1!'),
        status: 'ACTIVE',
        failed_attempts: 3,
      });

      const handler = createLoginHandler(store);
      const result = await handler({ email: 'reset@example.com', password: 'ValidPass1!' });

      expect(result.status).toBe(200);
      
      const user = store.getUser('reset@example.com');
      expect(user?.failed_attempts).toBe(0);
    });
  });

  describe('INVALID_CREDENTIALS Path', () => {
    it('should return 401 for wrong password', async () => {
      const wrongPasswordTest = LOGIN_TEST_CASES.find(tc => tc.name === 'invalid_credentials_wrong_password');
      expect(wrongPasswordTest).toBeDefined();
      
      const result = await harness.runTest(wrongPasswordTest!);
      expect(result.passed).toBe(true);
      
      // Verify trace contains the check
      const checkEvents = result.trace.events.filter(e => e.kind === 'check');
      expect(checkEvents.length).toBeGreaterThan(0);
    });

    it('should return 401 for non-existent user (no enumeration)', async () => {
      const userNotFoundTest = LOGIN_TEST_CASES.find(tc => tc.name === 'invalid_credentials_user_not_found');
      expect(userNotFoundTest).toBeDefined();
      
      const result = await harness.runTest(userNotFoundTest!);
      expect(result.passed).toBe(true);
    });

    it('should increment failed_attempts on wrong password', async () => {
      const store = harness.getStore();
      store.clear();
      store.seedUser({
        id: 'user_fail',
        email: 'fail@example.com',
        password_hash: hashPassword('CorrectPass!'),
        status: 'ACTIVE',
        failed_attempts: 0,
      });

      const handler = createLoginHandler(store);
      await handler({ email: 'fail@example.com', password: 'WrongPassword!' });

      const user = store.getUser('fail@example.com');
      expect(user?.failed_attempts).toBe(1);
    });
  });

  describe('USER_LOCKED Path', () => {
    it('should return ACCOUNT_LOCKED for locked user', async () => {
      const lockedTest = LOGIN_TEST_CASES.find(tc => tc.name === 'user_locked_already_locked');
      expect(lockedTest).toBeDefined();
      
      const result = await harness.runTest(lockedTest!);
      expect(result.passed).toBe(true);
    });

    it('should lock account after threshold failures', async () => {
      const store = harness.getStore();
      store.clear();
      store.seedUser({
        id: 'user_threshold',
        email: 'threshold@example.com',
        password_hash: hashPassword('CorrectPass!'),
        status: 'ACTIVE',
        failed_attempts: 4, // One more failure will lock
      });

      const handler = createLoginHandler(store, { lockoutThreshold: 5 });
      await handler({ email: 'threshold@example.com', password: 'WrongPassword!' });

      const user = store.getUser('threshold@example.com');
      expect(user?.status).toBe('LOCKED');
      expect(user?.failed_attempts).toBe(5);
    });

    it('should include retry_after in locked response', async () => {
      const store = harness.getStore();
      store.clear();
      store.seedUser({
        id: 'user_locked_retry',
        email: 'lockedretry@example.com',
        password_hash: hashPassword('ValidPass1!'),
        status: 'LOCKED',
        failed_attempts: 5,
        locked_until: Date.now() + 10 * 60 * 1000,
      });

      const handler = createLoginHandler(store);
      const result = await handler({ email: 'lockedretry@example.com', password: 'ValidPass1!' });

      expect(result.status).toBe(401);
      expect(result.body.success).toBe(false);
      if (!result.body.success) {
        expect(result.body.error.code).toBe('ACCOUNT_LOCKED');
        expect(result.body.error.retry_after).toBeGreaterThan(0);
      }
    });
  });

  describe('Trace Format', () => {
    it('should emit traces in isl-trace-format', async () => {
      const summary = await harness.runCoreScenarios();

      for (const trace of summary.traces) {
        // Required fields
        expect(trace.id).toBeDefined();
        expect(trace.name).toBeDefined();
        expect(trace.domain).toBe('Auth');
        expect(trace.startTime).toBeDefined();
        expect(trace.correlationId).toBeDefined();
        expect(Array.isArray(trace.events)).toBe(true);

        // Metadata
        expect(trace.metadata).toBeDefined();
        expect(trace.metadata?.testName).toBeDefined();
        expect(trace.metadata?.scenario).toBeDefined();
        expect(typeof trace.metadata?.passed).toBe('boolean');
        expect(typeof trace.metadata?.duration).toBe('number');
      }
    });

    it('should include handler_call and handler_return events', async () => {
      const summary = await harness.runCoreScenarios();

      for (const trace of summary.traces) {
        const handlerCallEvents = trace.events.filter(e => e.kind === 'handler_call');
        const handlerReturnEvents = trace.events.filter(e => e.kind === 'handler_return');

        expect(handlerCallEvents.length).toBeGreaterThan(0);
        expect(handlerReturnEvents.length).toBeGreaterThan(0);
      }
    });

    it('should include check events for postconditions', async () => {
      const summary = await harness.runCoreScenarios();

      for (const trace of summary.traces) {
        const checkEvents = trace.events.filter(e => e.kind === 'check');
        expect(checkEvents.length).toBeGreaterThan(0);

        for (const checkEvent of checkEvents) {
          expect(checkEvent.inputs).toBeDefined();
          expect(checkEvent.outputs).toBeDefined();
          expect(typeof (checkEvent.outputs as { passed?: boolean }).passed).toBe('boolean');
        }
      }
    });

    it('should sanitize PII in traces', async () => {
      const summary = await harness.runCoreScenarios();
      const tracesJson = harness.exportTraces();

      // Should not contain plain passwords
      expect(tracesJson).not.toContain('ValidPass123!');
      expect(tracesJson).not.toContain('WrongPassword!');
      expect(tracesJson).not.toContain('CorrectPassword!');
    });
  });

  describe('Export and Integration', () => {
    it('should export traces as JSON', async () => {
      await harness.runCoreScenarios();
      const tracesJson = harness.exportTraces();

      const parsed = JSON.parse(tracesJson);
      expect(parsed.generated).toBeDefined();
      expect(parsed.spec).toBe('login.isl');
      expect(parsed.domain).toBe('Auth');
      expect(parsed.version).toBe('1.0.0');
      expect(Array.isArray(parsed.traces)).toBe(true);
      expect(parsed.summary).toBeDefined();
      expect(parsed.summary.total).toBeGreaterThan(0);
    });

    it('should format results for isl verify', async () => {
      const summary = await harness.runCoreScenarios();
      const verifyOutput = formatForISLVerify('login.isl', 'Auth', '1.0.0', summary);

      expect(verifyOutput.passed).toBe(true);
      expect(verifyOutput.testsRun).toBeGreaterThan(0);
      expect(verifyOutput.testsPassed).toBe(verifyOutput.testsRun);
      expect(verifyOutput.testsFailed).toBe(0);
      expect(verifyOutput.proofBundle).toBeDefined();
      expect(verifyOutput.proofBundle.verdict).toBe('PROVEN');
      expect(verifyOutput.summary).toMatch(/\d+ passed, \d+ failed/);
    });
  });
});

describe('Utility Functions', () => {
  describe('hashPassword', () => {
    it('should hash passwords deterministically', () => {
      const hash1 = hashPassword('test123');
      const hash2 = hashPassword('test123');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different passwords', () => {
      const hash1 = hashPassword('password1');
      const hash2 = hashPassword('password2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', () => {
      const hash = hashPassword('correctpass');
      expect(verifyPassword('correctpass', hash)).toBe(true);
    });

    it('should return false for incorrect password', () => {
      const hash = hashPassword('correctpass');
      expect(verifyPassword('wrongpass', hash)).toBe(false);
    });
  });

  describe('assertTestsExecuted', () => {
    it('should throw if no tests executed', () => {
      const emptySummary = {
        total: 0,
        passed: 0,
        failed: 0,
        traces: [],
        results: [],
      };

      expect(() => assertTestsExecuted(emptySummary)).toThrow('No tests executed');
    });

    it('should not throw if tests executed', async () => {
      const summary = await runLoginTests();
      expect(() => assertTestsExecuted(summary)).not.toThrow();
    });
  });
});

describe('runLoginTests convenience function', () => {
  it('should run tests and return summary', async () => {
    const summary = await runLoginTests();

    expect(summary.total).toBeGreaterThan(0);
    expect(summary.passed).toBeGreaterThan(0);
    expect(summary.traces.length).toBe(summary.total);
  });

  it('should support verbose mode', async () => {
    const summary = await runLoginTests({ verbose: false });
    expect(summary.total).toBeGreaterThan(0);
  });
});

describe('runLoginTestsWithTraces', () => {
  it('should return both summary and traces JSON', async () => {
    const { summary, tracesJson } = await runLoginTestsWithTraces();

    expect(summary.total).toBeGreaterThan(0);
    expect(tracesJson).toBeDefined();

    const parsed = JSON.parse(tracesJson);
    expect(parsed.traces.length).toBe(summary.total);
  });
});

describe('FixtureStore', () => {
  let store: FixtureStore;

  beforeEach(() => {
    store = new FixtureStore();
  });

  describe('User operations', () => {
    it('should seed and retrieve users', () => {
      store.seedUser({
        id: 'user_1',
        email: 'Test@Example.com',
        password_hash: 'hash',
        status: 'ACTIVE',
        failed_attempts: 0,
      });

      // Should be case-insensitive
      const user = store.getUser('test@example.com');
      expect(user).toBeDefined();
      expect(user?.id).toBe('user_1');
    });

    it('should update users', () => {
      store.seedUser({
        id: 'user_2',
        email: 'update@example.com',
        password_hash: 'hash',
        status: 'ACTIVE',
        failed_attempts: 0,
      });

      store.updateUser('update@example.com', { failed_attempts: 3, status: 'LOCKED' });

      const user = store.getUser('update@example.com');
      expect(user?.failed_attempts).toBe(3);
      expect(user?.status).toBe('LOCKED');
    });
  });

  describe('Session operations', () => {
    it('should create sessions', () => {
      const session = store.createSession('user_123');

      expect(session.id).toBeDefined();
      expect(session.user_id).toBe('user_123');
      expect(session.access_token.length).toBeGreaterThanOrEqual(64);
      expect(session.expires_at).toBeDefined();
    });
  });

  describe('Rate limiting', () => {
    it('should allow requests within limit', () => {
      for (let i = 0; i < 5; i++) {
        const result = store.checkRateLimit('test', 10, 60000);
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests exceeding limit', () => {
      for (let i = 0; i < 10; i++) {
        store.checkRateLimit('block', 10, 60000);
      }

      const result = store.checkRateLimit('block', 10, 60000);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });
  });

  describe('Audit logging', () => {
    it('should record audit events', () => {
      store.recordAudit('LOGIN_SUCCESS', { userId: 'user_1', email: 'test@example.com' });
      store.recordAudit('LOGIN_FAILED', { email: 'test@example.com', ip: '127.0.0.1' });

      const log = store.getAuditLog();
      expect(log.length).toBe(2);
      expect(log[0].action).toBe('LOGIN_SUCCESS');
      expect(log[1].action).toBe('LOGIN_FAILED');
    });
  });

  describe('Snapshot', () => {
    it('should return state snapshot', () => {
      store.seedUser({
        id: 'user_1',
        email: 'snapshot@example.com',
        password_hash: 'hash',
        status: 'ACTIVE',
        failed_attempts: 0,
      });

      const snapshot = store.snapshot();
      expect(snapshot.users).toBeDefined();
      expect(snapshot.sessions).toBeDefined();
      expect(snapshot.auditLog).toBeDefined();
    });
  });

  describe('Clear', () => {
    it('should clear all data', () => {
      store.seedUser({
        id: 'user_1',
        email: 'clear@example.com',
        password_hash: 'hash',
        status: 'ACTIVE',
        failed_attempts: 0,
      });
      store.createSession('user_1');
      store.recordAudit('TEST', {});

      store.clear();

      expect(store.getUser('clear@example.com')).toBeUndefined();
      expect(store.getAuditLog().length).toBe(0);
    });
  });
});
