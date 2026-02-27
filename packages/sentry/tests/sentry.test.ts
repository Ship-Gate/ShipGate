// ============================================================================
// ISL Sentry Integration Tests
// ============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  ISLSentry,
  initSentry,
  isInitialized,
  createISLContext,
  pushContext,
  popContext,
  getCurrentContext,
  getContextDepth,
  clearAllContexts,
  ISLContextManager,
  contextManager,
  addBehaviorBreadcrumb,
  addVerificationBreadcrumb,
  addPreconditionBreadcrumb,
  addPostconditionBreadcrumb,
  addInvariantBreadcrumb,
  PreconditionError,
  PostconditionError,
  InvariantError,
  TemporalError,
  VerificationError,
  isISLError,
  isPreconditionError,
  isPostconditionError,
  isInvariantError,
  isTemporalError,
  isVerificationError,
  sanitizeInput,
  sanitizeOutput,
  generateExecutionId,
  createFingerprint,
  formatDuration,
} from '../src';

import type { VerifyResult, ISLContext } from '../src';

// Mock Sentry
vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  setContext: vi.fn(),
  setTags: vi.fn(),
  setTag: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((callback) => callback({ setContext: vi.fn(), setTag: vi.fn(), clearBreadcrumbs: vi.fn() })),
  startSpan: vi.fn((opts, callback) => callback({ setStatus: vi.fn(), setAttribute: vi.fn(), addEvent: vi.fn() })),
  flush: vi.fn(() => Promise.resolve(true)),
  close: vi.fn(() => Promise.resolve(true)),
  setUser: vi.fn(),
  setMeasurement: vi.fn(),
}));

vi.mock('@sentry/profiling-node', () => ({
  ProfilingIntegration: vi.fn(),
}));

describe('ISLSentry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllContexts();
  });

  describe('Error Classes', () => {
    describe('PreconditionError', () => {
      it('should create precondition error with correct properties', () => {
        const error = new PreconditionError(
          'input.length > 0',
          'UserDomain',
          'createUser',
          { name: '' }
        );

        expect(error.code).toBe('ISL_PRECONDITION_FAILED');
        expect(error.checkType).toBe('precondition');
        expect(error.expression).toBe('input.length > 0');
        expect(error.domain).toBe('UserDomain');
        expect(error.behavior).toBe('createUser');
        expect(error.message).toBe('Precondition failed: input.length > 0');
      });

      it('should serialize to JSON correctly', () => {
        const error = new PreconditionError(
          'x > 0',
          'TestDomain',
          'testBehavior'
        );
        const json = error.toJSON();

        expect(json.name).toBe('PreconditionError');
        expect(json.code).toBe('ISL_PRECONDITION_FAILED');
        expect(json.checkType).toBe('precondition');
        expect(json.expression).toBe('x > 0');
      });
    });

    describe('PostconditionError', () => {
      it('should create postcondition error with correct properties', () => {
        const error = new PostconditionError(
          'result.success === true',
          'OrderDomain',
          'placeOrder',
          { items: [] },
          { success: false }
        );

        expect(error.code).toBe('ISL_POSTCONDITION_FAILED');
        expect(error.checkType).toBe('postcondition');
        expect(error.expression).toBe('result.success === true');
        expect(error.domain).toBe('OrderDomain');
        expect(error.behavior).toBe('placeOrder');
      });
    });

    describe('InvariantError', () => {
      it('should create invariant error with correct properties', () => {
        const error = new InvariantError(
          'balance >= 0',
          'AccountDomain',
          { balance: -100 }
        );

        expect(error.code).toBe('ISL_INVARIANT_VIOLATED');
        expect(error.checkType).toBe('invariant');
        expect(error.expression).toBe('balance >= 0');
        expect(error.domain).toBe('AccountDomain');
        expect(error.behavior).toBeUndefined();
      });
    });

    describe('TemporalError', () => {
      it('should create temporal error with correct properties', () => {
        const error = new TemporalError(
          'state transitions to complete',
          'eventually',
          'OrderDomain',
          'processOrder',
          [{ state: 'pending' }, { state: 'processing' }]
        );

        expect(error.code).toBe('ISL_TEMPORAL_VIOLATED');
        expect(error.checkType).toBe('temporal');
        expect(error.property).toBe('eventually');
      });
    });

    describe('VerificationError', () => {
      it('should create verification error with correct properties', () => {
        const error = new VerificationError(
          'PaymentDomain',
          'processPayment',
          'unsafe',
          45,
          ['amount_positive', 'card_valid']
        );

        expect(error.code).toBe('ISL_VERIFICATION_FAILED');
        expect(error.verdict).toBe('unsafe');
        expect(error.score).toBe(45);
        expect(error.failedChecks).toEqual(['amount_positive', 'card_valid']);
      });
    });

    describe('Type Guards', () => {
      it('should correctly identify ISL errors', () => {
        const preconditionError = new PreconditionError('x', 'D', 'B');
        const regularError = new Error('regular');

        expect(isISLError(preconditionError)).toBe(true);
        expect(isISLError(regularError)).toBe(false);
        expect(isPreconditionError(preconditionError)).toBe(true);
        expect(isPostconditionError(preconditionError)).toBe(false);
      });
    });
  });

  describe('Context Management', () => {
    describe('createISLContext', () => {
      it('should create context with required fields', () => {
        const context = createISLContext('TestDomain', 'testBehavior');

        expect(context.domain).toBe('TestDomain');
        expect(context.behavior).toBe('testBehavior');
        expect(context.timestamp).toBeDefined();
        expect(context.executionId).toBeDefined();
      });

      it('should create context with custom options', () => {
        const context = createISLContext('TestDomain', 'testBehavior', {
          checkType: 'precondition',
          expression: 'x > 0',
          executionId: 'custom-id',
        });

        expect(context.checkType).toBe('precondition');
        expect(context.expression).toBe('x > 0');
        expect(context.executionId).toBe('custom-id');
      });
    });

    describe('Context Stack', () => {
      it('should push and pop contexts correctly', () => {
        const context1 = createISLContext('Domain1');
        const context2 = createISLContext('Domain2');

        pushContext(context1);
        expect(getCurrentContext()?.domain).toBe('Domain1');
        expect(getContextDepth()).toBe(1);

        pushContext(context2);
        expect(getCurrentContext()?.domain).toBe('Domain2');
        expect(getContextDepth()).toBe(2);
        expect(getCurrentContext()?.parentExecutionId).toBe(context1.executionId);

        popContext();
        expect(getCurrentContext()?.domain).toBe('Domain1');
        expect(getContextDepth()).toBe(1);

        popContext();
        expect(getCurrentContext()).toBeUndefined();
        expect(getContextDepth()).toBe(0);
      });

      it('should clear all contexts', () => {
        pushContext(createISLContext('D1'));
        pushContext(createISLContext('D2'));
        pushContext(createISLContext('D3'));

        expect(getContextDepth()).toBe(3);

        clearAllContexts();

        expect(getContextDepth()).toBe(0);
        expect(getCurrentContext()).toBeUndefined();
      });
    });

    describe('ISLContextManager', () => {
      it('should manage context lifecycle', () => {
        const manager = contextManager('TestDomain', 'testBehavior');

        manager.enter();
        expect(getCurrentContext()?.domain).toBe('TestDomain');

        manager.exit();
        expect(getCurrentContext()).toBeUndefined();
      });

      it('should run function within context', () => {
        const manager = contextManager('TestDomain', 'testBehavior');
        let capturedDomain: string | undefined;

        manager.run(() => {
          capturedDomain = getCurrentContext()?.domain;
        });

        expect(capturedDomain).toBe('TestDomain');
        expect(getCurrentContext()).toBeUndefined();
      });

      it('should set metadata', () => {
        const manager = contextManager('TestDomain');
        manager.setMetadata('key', 'value');

        expect(manager.getContext().metadata?.key).toBe('value');
      });
    });
  });

  describe('Utilities', () => {
    describe('sanitizeInput', () => {
      it('should redact sensitive fields', () => {
        const input = {
          username: 'john',
          password: 'secret123',
          apiKey: 'key-123',
        };

        const sanitized = sanitizeInput(input) as Record<string, unknown>;

        expect(sanitized.username).toBe('john');
        expect(sanitized.password).toBe('[REDACTED]');
        expect(sanitized.apiKey).toBe('[REDACTED]');
      });

      it('should handle nested objects', () => {
        const input = {
          user: {
            name: 'john',
            credentials: {
              password: 'secret',
            },
          },
        };

        const sanitized = sanitizeInput(input) as Record<string, unknown>;
        const user = sanitized.user as Record<string, unknown>;
        const credentials = user.credentials as Record<string, unknown>;

        expect(user.name).toBe('john');
        expect(credentials.password).toBe('[REDACTED]');
      });

      it('should truncate long strings', () => {
        const input = { data: 'a'.repeat(2000) };
        const sanitized = sanitizeInput(input, [], 5, 100) as Record<string, unknown>;

        expect((sanitized.data as string).length).toBeLessThan(200);
        expect(sanitized.data).toContain('[truncated');
      });

      it('should respect max depth', () => {
        const input = {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    level6: 'deep',
                  },
                },
              },
            },
          },
        };

        const sanitized = sanitizeInput(input, [], 3) as Record<string, unknown>;
        const level1 = sanitized.level1 as Record<string, unknown>;
        const level2 = level1.level2 as Record<string, unknown>;

        expect(level2.level3).toBe('[Max depth exceeded]');
      });
    });

    describe('generateExecutionId', () => {
      it('should generate unique IDs', () => {
        const id1 = generateExecutionId();
        const id2 = generateExecutionId();

        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^exec_[a-z0-9]+_[a-z0-9]+$/);
      });
    });

    describe('createFingerprint', () => {
      it('should create fingerprint array', () => {
        const fingerprint = createFingerprint(
          'UserDomain',
          'createUser',
          'precondition',
          'email.includes("@")'
        );

        expect(fingerprint).toEqual([
          'UserDomain',
          'createUser',
          'precondition',
          'email.includes(@)',
        ]);
      });

      it('should handle missing optional parts', () => {
        const fingerprint = createFingerprint('UserDomain', undefined, undefined);

        expect(fingerprint).toEqual(['UserDomain']);
      });
    });

    describe('formatDuration', () => {
      it('should format microseconds', () => {
        expect(formatDuration(0.5)).toBe('500.00µs');
      });

      it('should format milliseconds', () => {
        expect(formatDuration(150)).toBe('150.00ms');
      });

      it('should format seconds', () => {
        expect(formatDuration(2500)).toBe('2.50s');
      });

      it('should format minutes', () => {
        expect(formatDuration(90000)).toBe('1.50m');
      });
    });
  });

  describe('ISLSentry Tracker', () => {
    describe('trackBehavior', () => {
      it('should wrap behavior execution', async () => {
        const result = await ISLSentry.trackBehavior(
          'TestDomain',
          'testBehavior',
          async () => 'result'
        );

        expect(result).toBe('result');
      });

      it('should handle errors', async () => {
        await expect(
          ISLSentry.trackBehavior('TestDomain', 'testBehavior', async () => {
            throw new Error('Test error');
          })
        ).rejects.toThrow('Test error');
      });
    });

    describe('trackVerification', () => {
      it('should track verification result', () => {
        const result: VerifyResult = {
          domain: 'TestDomain',
          behavior: 'testBehavior',
          verdict: 'verified',
          score: 100,
          coverage: {
            preconditions: 1.0,
            postconditions: 1.0,
            invariants: 1.0,
            total: 1.0,
          },
          failed: [],
          passed: [
            {
              name: 'input_valid',
              category: 'precondition',
              expression: 'input !== null',
            },
          ],
        };

        expect(() => ISLSentry.trackVerification(result)).not.toThrow();
      });

      it('should capture error for unsafe verdict', () => {
        const Sentry = require('@sentry/node');
        
        const result: VerifyResult = {
          domain: 'TestDomain',
          behavior: 'testBehavior',
          verdict: 'unsafe',
          score: 30,
          coverage: {
            preconditions: 0.5,
            postconditions: 0.3,
            invariants: 0,
            total: 0.3,
          },
          failed: [
            {
              name: 'output_valid',
              category: 'postcondition',
              expression: 'output.success',
              error: 'Expected true, got false',
            },
          ],
          passed: [],
        };

        ISLSentry.trackVerification(result);

        expect(Sentry.captureException).toHaveBeenCalled();
      });
    });

    describe('trackPreconditionFailure', () => {
      it('should capture precondition failure', () => {
        const Sentry = require('@sentry/node');

        ISLSentry.trackPreconditionFailure(
          'UserDomain',
          'createUser',
          'email.includes("@")',
          { email: 'invalid' }
        );

        expect(Sentry.captureException).toHaveBeenCalled();
        expect(Sentry.addBreadcrumb).toHaveBeenCalled();
      });
    });

    describe('trackPostconditionFailure', () => {
      it('should capture postcondition failure', () => {
        const Sentry = require('@sentry/node');

        ISLSentry.trackPostconditionFailure(
          'OrderDomain',
          'placeOrder',
          'result.orderId !== undefined',
          { items: [] },
          { success: false }
        );

        expect(Sentry.captureException).toHaveBeenCalled();
      });
    });

    describe('trackInvariantViolation', () => {
      it('should capture invariant violation', () => {
        const Sentry = require('@sentry/node');

        ISLSentry.trackInvariantViolation(
          'AccountDomain',
          'balance >= 0',
          { balance: -100 }
        );

        expect(Sentry.captureException).toHaveBeenCalled();
      });
    });

    describe('trackTemporalViolation', () => {
      it('should capture temporal violation', () => {
        const Sentry = require('@sentry/node');

        ISLSentry.trackTemporalViolation(
          'OrderDomain',
          'processOrder',
          'eventually',
          'status becomes "complete"',
          [{ status: 'pending' }]
        );

        expect(Sentry.captureException).toHaveBeenCalled();
      });
    });

    describe('withContext', () => {
      it('should run function within context', async () => {
        let capturedDomain: string | undefined;

        await ISLSentry.withContext('TestDomain', 'testBehavior', async () => {
          capturedDomain = getCurrentContext()?.domain;
        });

        expect(capturedDomain).toBe('TestDomain');
      });
    });

    describe('createBehaviorExecutor', () => {
      it('should create tracked executor', async () => {
        const executor = ISLSentry.createBehaviorExecutor(
          'TestDomain',
          'testBehavior',
          async (input: number) => input * 2
        );

        const result = await executor(5);

        expect(result).toBe(10);
      });
    });
  });

  describe('Breadcrumbs', () => {
    it('should add behavior breadcrumb', () => {
      const Sentry = require('@sentry/node');

      addBehaviorBreadcrumb('TestDomain', 'testBehavior', 'start');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'isl.behavior',
          level: 'info',
        })
      );
    });

    it('should add precondition breadcrumb', () => {
      const Sentry = require('@sentry/node');

      addPreconditionBreadcrumb('TestDomain', 'testBehavior', 'x > 0', false);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'isl.precondition',
          level: 'warning',
        })
      );
    });

    it('should add postcondition breadcrumb', () => {
      const Sentry = require('@sentry/node');

      addPostconditionBreadcrumb('TestDomain', 'testBehavior', 'result.ok', true);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'isl.postcondition',
          level: 'info',
        })
      );
    });

    it('should add invariant breadcrumb', () => {
      const Sentry = require('@sentry/node');

      addInvariantBreadcrumb('TestDomain', 'balance >= 0', false);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'isl.invariant',
          level: 'fatal',
        })
      );
    });
  });
});
