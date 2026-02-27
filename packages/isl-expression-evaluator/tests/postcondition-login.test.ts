// ============================================================================
// ISL Expression Evaluator - Login Postcondition Tests
// ============================================================================
//
// Tests for login-specific postcondition constructs:
// - "User.failed_attempts increased by 1"
// - "no Session created"
// - INVALID_CREDENTIALS path validation
//
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  // Postcondition types
  increasedBy,
  noneCreated,
  incremented,
  simplePath,
  methodCallField,
  literalDelta,
  
  // Type guards
  isIncreasedByPredicate,
  isNoneCreatedPredicate,
  
  // Lowering
  lowerFromString,
  isIncreasedByPattern,
  isNoneCreatedPattern,
  
  // Evaluation
  evaluatePostcondition,
  evaluatePostconditions,
  createPostconditionContext,
  summarizePostconditionResults,
} from '../src/v1/index.js';

import {
  createPostconditionTraceAdapter,
  createFromStateSnapshots,
  createFromFieldStates,
} from '../src/adapters/index.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Create a user fixture for testing
 */
function createUserFixture(overrides: Partial<{
  id: string;
  email: string;
  failed_attempts: number;
  status: string;
}> = {}) {
  return {
    id: overrides.id ?? 'user-123',
    email: overrides.email ?? 'test@example.com',
    failed_attempts: overrides.failed_attempts ?? 0,
    status: overrides.status ?? 'active',
  };
}

/**
 * Create before state for INVALID_CREDENTIALS test
 */
function createInvalidCredentialsBeforeState(failedAttempts: number = 0) {
  return {
    User: {
      'user-123': createUserFixture({ failed_attempts: failedAttempts }),
    },
    Session: {},
  };
}

/**
 * Create after state for INVALID_CREDENTIALS - passing case
 * (failed_attempts incremented by 1, no session created)
 */
function createInvalidCredentialsAfterState_Pass(failedAttempts: number = 1) {
  return {
    User: {
      'user-123': createUserFixture({ failed_attempts: failedAttempts }),
    },
    Session: {}, // No session created
  };
}

/**
 * Create after state for INVALID_CREDENTIALS - failing case
 * (session was created - violates "no Session created")
 */
function createInvalidCredentialsAfterState_FailSession(failedAttempts: number = 1) {
  return {
    User: {
      'user-123': createUserFixture({ failed_attempts: failedAttempts }),
    },
    Session: {
      'session-456': { id: 'session-456', userId: 'user-123', token: 'abc' },
    },
  };
}

/**
 * Create after state for INVALID_CREDENTIALS - failing case
 * (failed_attempts not incremented)
 */
function createInvalidCredentialsAfterState_FailCounter(failedAttempts: number = 0) {
  return {
    User: {
      'user-123': createUserFixture({ failed_attempts: failedAttempts }),
    },
    Session: {},
  };
}

// ============================================================================
// LOWERING TESTS
// ============================================================================

describe('Postcondition Lowering', () => {
  describe('Pattern Detection', () => {
    it('should detect "increased by" patterns', () => {
      expect(isIncreasedByPattern('User.failed_attempts increased by 1')).toBe(true);
      expect(isIncreasedByPattern('Payment.refunded_amount increased by refund_amount')).toBe(true);
      expect(isIncreasedByPattern('counter decreased by 5')).toBe(true);
      
      expect(isIncreasedByPattern('no Session created')).toBe(false);
      expect(isIncreasedByPattern('Session.created == false')).toBe(false);
    });

    it('should detect "no X created" patterns', () => {
      expect(isNoneCreatedPattern('no Session created')).toBe(true);
      expect(isNoneCreatedPattern('no token generated')).toBe(true);
      expect(isNoneCreatedPattern('Session.created == false')).toBe(true);
      
      expect(isNoneCreatedPattern('User.failed_attempts increased by 1')).toBe(false);
    });
  });

  describe('String Lowering - "increased by"', () => {
    it('should lower "User.failed_attempts increased by 1"', () => {
      const result = lowerFromString('User.failed_attempts increased by 1');
      
      expect(result.success).toBe(true);
      expect(isIncreasedByPredicate(result.predicate)).toBe(true);
      
      const pred = result.predicate as ReturnType<typeof increasedBy>;
      expect(pred.direction).toBe('increased');
      expect(pred.delta).toEqual({ kind: 'literal', value: 1 });
      expect(pred.field.kind).toBe('simple_path');
      expect((pred.field as { path: string[] }).path).toEqual(['User', 'failed_attempts']);
    });

    it('should lower "Payment.refunded_amount increased by refund_amount"', () => {
      const result = lowerFromString('Payment.refunded_amount increased by refund_amount');
      
      expect(result.success).toBe(true);
      expect(isIncreasedByPredicate(result.predicate)).toBe(true);
      
      const pred = result.predicate as ReturnType<typeof increasedBy>;
      expect(pred.delta).toEqual({ kind: 'variable', name: 'refund_amount' });
    });

    it('should lower method call fields', () => {
      const result = lowerFromString('User.lookup_by_email(input.email).failed_attempts increased by 1');
      
      expect(result.success).toBe(true);
      const pred = result.predicate as ReturnType<typeof increasedBy>;
      expect(pred.field.kind).toBe('method_call');
    });
  });

  describe('String Lowering - "no X created"', () => {
    it('should lower "no Session created"', () => {
      const result = lowerFromString('no Session created');
      
      expect(result.success).toBe(true);
      expect(isNoneCreatedPredicate(result.predicate)).toBe(true);
      
      const pred = result.predicate as ReturnType<typeof noneCreated>;
      expect(pred.entityType).toBe('Session');
    });

    it('should lower "no token generated" with alias', () => {
      const result = lowerFromString('no token generated');
      
      expect(result.success).toBe(true);
      expect(isNoneCreatedPredicate(result.predicate)).toBe(true);
      
      const pred = result.predicate as ReturnType<typeof noneCreated>;
      expect(pred.entityType).toBe('token');
      expect(pred.alias).toBe('token');
    });

    it('should lower "Session.created == false"', () => {
      const result = lowerFromString('Session.created == false');
      
      expect(result.success).toBe(true);
      expect(isNoneCreatedPredicate(result.predicate)).toBe(true);
    });
  });
});

// ============================================================================
// EVALUATION TESTS - INCREASED_BY
// ============================================================================

describe('IncreasedBy Evaluation', () => {
  describe('Simple Field Path', () => {
    it('should pass when field increased by expected amount', () => {
      const adapter = createFromFieldStates({
        'User.failed_attempts': { before: 0, after: 1 },
      });
      
      const ctx = createPostconditionContext({ adapter });
      const predicate = increasedBy(
        simplePath('User', 'failed_attempts'),
        literalDelta(1)
      );
      
      const result = evaluatePostcondition(predicate, ctx);
      
      expect(result.kind).toBe('true');
      expect(result.postconditionDetails?.computedDelta).toBe(1);
      expect(result.postconditionDetails?.expectedDelta).toBe(1);
    });

    it('should fail when field did not increase', () => {
      const adapter = createFromFieldStates({
        'User.failed_attempts': { before: 0, after: 0 },
      });
      
      const ctx = createPostconditionContext({ adapter });
      const predicate = increasedBy(
        simplePath('User', 'failed_attempts'),
        literalDelta(1)
      );
      
      const result = evaluatePostcondition(predicate, ctx);
      
      expect(result.kind).toBe('false');
      expect(result.postconditionDetails?.computedDelta).toBe(0);
    });

    it('should fail when field increased by wrong amount', () => {
      const adapter = createFromFieldStates({
        'User.failed_attempts': { before: 0, after: 2 },
      });
      
      const ctx = createPostconditionContext({ adapter });
      const predicate = increasedBy(
        simplePath('User', 'failed_attempts'),
        literalDelta(1)
      );
      
      const result = evaluatePostcondition(predicate, ctx);
      
      expect(result.kind).toBe('false');
      expect(result.postconditionDetails?.computedDelta).toBe(2);
      expect(result.postconditionDetails?.expectedDelta).toBe(1);
    });
  });

  describe('Variable Delta', () => {
    it('should resolve delta from context variables', () => {
      const adapter = createFromFieldStates({
        'Payment.refunded_amount': { before: 100, after: 150 },
      });
      
      const ctx = createPostconditionContext({
        adapter,
        input: { refund_amount: 50 },
      });
      
      const predicate = increasedBy(
        simplePath('Payment', 'refunded_amount'),
        { kind: 'variable', name: 'refund_amount' }
      );
      
      const result = evaluatePostcondition(predicate, ctx);
      
      expect(result.kind).toBe('true');
    });
  });

  describe('State Snapshots', () => {
    it('should work with nested state snapshots', () => {
      const adapter = createFromStateSnapshots(
        { User: { 'user-123': { failed_attempts: 2 } } },
        { User: { 'user-123': { failed_attempts: 3 } } }
      );
      
      const ctx = createPostconditionContext({ adapter });
      const predicate = increasedBy(
        simplePath('User', 'user-123', 'failed_attempts'),
        literalDelta(1)
      );
      
      const result = evaluatePostcondition(predicate, ctx);
      
      expect(result.kind).toBe('true');
    });
  });
});

// ============================================================================
// EVALUATION TESTS - NONE_CREATED
// ============================================================================

describe('NoneCreated Evaluation', () => {
  it('should pass when no entity was created', () => {
    const adapter = createFromStateSnapshots(
      { Session: {} },
      { Session: {} }
    );
    
    const ctx = createPostconditionContext({ adapter });
    const predicate = noneCreated('Session');
    
    const result = evaluatePostcondition(predicate, ctx);
    
    expect(result.kind).toBe('true');
  });

  it('should fail when entity was created', () => {
    const adapter = createFromStateSnapshots(
      { Session: {} },
      { Session: { 'session-1': { id: 'session-1' } } }
    );
    
    const ctx = createPostconditionContext({ adapter });
    const predicate = noneCreated('Session');
    
    const result = evaluatePostcondition(predicate, ctx);
    
    expect(result.kind).toBe('false');
    expect(result.reason).toContain('created');
  });

  it('should handle multiple entities being created', () => {
    const adapter = createFromStateSnapshots(
      { Session: {} },
      {
        Session: {
          'session-1': { id: 'session-1' },
          'session-2': { id: 'session-2' },
        },
      }
    );
    
    const ctx = createPostconditionContext({ adapter });
    const predicate = noneCreated('Session');
    
    const result = evaluatePostcondition(predicate, ctx);
    
    expect(result.kind).toBe('false');
  });
});

// ============================================================================
// INTEGRATION TESTS - INVALID_CREDENTIALS PATH
// ============================================================================

describe('INVALID_CREDENTIALS Path', () => {
  /**
   * The INVALID_CREDENTIALS postcondition from login.isl:
   * 
   * post INVALID_CREDENTIALS {
   *   - User.failed_attempts == old(User.failed_attempts) + 1
   *   - no Session created
   * }
   * 
   * Lowered to:
   * - increased_by(User.failed_attempts, 1)
   * - none_created(Session)
   */
  
  describe('Passing Case - Correct Implementation', () => {
    it('should pass when failed_attempts incremented and no session created', () => {
      const beforeState = createInvalidCredentialsBeforeState(0);
      const afterState = createInvalidCredentialsAfterState_Pass(1);
      
      const adapter = createFromStateSnapshots(beforeState, afterState);
      const ctx = createPostconditionContext({ adapter });
      
      const predicates = [
        increasedBy(
          simplePath('User', 'user-123', 'failed_attempts'),
          literalDelta(1)
        ),
        noneCreated('Session'),
      ];
      
      const { overall, results } = evaluatePostconditions(predicates, ctx);
      
      expect(overall).toBe('true');
      expect(results[0].kind).toBe('true');
      expect(results[1].kind).toBe('true');
    });

    it('should pass with multiple failed attempts', () => {
      const beforeState = createInvalidCredentialsBeforeState(3);
      const afterState = createInvalidCredentialsAfterState_Pass(4);
      
      const adapter = createFromStateSnapshots(beforeState, afterState);
      const ctx = createPostconditionContext({ adapter });
      
      const predicates = [
        increasedBy(
          simplePath('User', 'user-123', 'failed_attempts'),
          literalDelta(1)
        ),
        noneCreated('Session'),
      ];
      
      const { overall, results } = evaluatePostconditions(predicates, ctx);
      
      expect(overall).toBe('true');
    });
  });

  describe('Failing Case - Session Created', () => {
    it('should fail when session was created on invalid credentials', () => {
      const beforeState = createInvalidCredentialsBeforeState(0);
      const afterState = createInvalidCredentialsAfterState_FailSession(1);
      
      const adapter = createFromStateSnapshots(beforeState, afterState);
      const ctx = createPostconditionContext({ adapter });
      
      const predicates = [
        increasedBy(
          simplePath('User', 'user-123', 'failed_attempts'),
          literalDelta(1)
        ),
        noneCreated('Session'),
      ];
      
      const { overall, results } = evaluatePostconditions(predicates, ctx);
      
      expect(overall).toBe('false');
      expect(results[0].kind).toBe('true'); // Counter was incremented
      expect(results[1].kind).toBe('false'); // But session was created!
    });
  });

  describe('Failing Case - Counter Not Incremented', () => {
    it('should fail when failed_attempts was not incremented', () => {
      const beforeState = createInvalidCredentialsBeforeState(0);
      const afterState = createInvalidCredentialsAfterState_FailCounter(0);
      
      const adapter = createFromStateSnapshots(beforeState, afterState);
      const ctx = createPostconditionContext({ adapter });
      
      const predicates = [
        increasedBy(
          simplePath('User', 'user-123', 'failed_attempts'),
          literalDelta(1)
        ),
        noneCreated('Session'),
      ];
      
      const { overall, results } = evaluatePostconditions(predicates, ctx);
      
      expect(overall).toBe('false');
      expect(results[0].kind).toBe('false'); // Counter not incremented
      expect(results[0].postconditionDetails?.computedDelta).toBe(0);
      expect(results[1].kind).toBe('true'); // No session (correct)
    });

    it('should fail when counter incremented by wrong amount', () => {
      const beforeState = createInvalidCredentialsBeforeState(0);
      const afterState = {
        User: {
          'user-123': createUserFixture({ failed_attempts: 5 }), // Jumped by 5!
        },
        Session: {},
      };
      
      const adapter = createFromStateSnapshots(beforeState, afterState);
      const ctx = createPostconditionContext({ adapter });
      
      const predicates = [
        increasedBy(
          simplePath('User', 'user-123', 'failed_attempts'),
          literalDelta(1)
        ),
        noneCreated('Session'),
      ];
      
      const { overall, results } = evaluatePostconditions(predicates, ctx);
      
      expect(overall).toBe('false');
      expect(results[0].kind).toBe('false');
      expect(results[0].postconditionDetails?.computedDelta).toBe(5);
      expect(results[0].postconditionDetails?.expectedDelta).toBe(1);
    });
  });

  describe('End-to-End: String Lowering to Evaluation', () => {
    it('should handle full lowering and evaluation pipeline', () => {
      // 1. Lower from ISL string syntax
      const loweredIncreasedBy = lowerFromString('User.user-123.failed_attempts increased by 1');
      const loweredNoneCreated = lowerFromString('no Session created');
      
      expect(loweredIncreasedBy.success).toBe(true);
      expect(loweredNoneCreated.success).toBe(true);
      
      // 2. Create adapter with state snapshots
      const beforeState = createInvalidCredentialsBeforeState(0);
      const afterState = createInvalidCredentialsAfterState_Pass(1);
      const adapter = createFromStateSnapshots(beforeState, afterState);
      
      // 3. Create context
      const ctx = createPostconditionContext({ adapter });
      
      // 4. Evaluate predicates
      const predicates = [
        loweredIncreasedBy.predicate!,
        loweredNoneCreated.predicate!,
      ];
      
      const { overall, results } = evaluatePostconditions(predicates, ctx);
      
      expect(overall).toBe('true');
    });
  });
});

// ============================================================================
// SUMMARY OUTPUT TESTS
// ============================================================================

describe('Result Summary', () => {
  it('should generate readable summary for passing tests', () => {
    const adapter = createFromStateSnapshots(
      createInvalidCredentialsBeforeState(0),
      createInvalidCredentialsAfterState_Pass(1)
    );
    
    const ctx = createPostconditionContext({ adapter });
    const predicates = [
      increasedBy(simplePath('User', 'user-123', 'failed_attempts'), literalDelta(1)),
      noneCreated('Session'),
    ];
    
    const { results } = evaluatePostconditions(predicates, ctx);
    const summary = summarizePostconditionResults(results);
    
    expect(summary).toContain('2 passed');
    expect(summary).toContain('0 failed');
    expect(summary).toContain('increased_by');
    expect(summary).toContain('none_created');
  });

  it('should generate readable summary for failing tests', () => {
    const adapter = createFromStateSnapshots(
      createInvalidCredentialsBeforeState(0),
      createInvalidCredentialsAfterState_FailCounter(0)
    );
    
    const ctx = createPostconditionContext({ adapter });
    const predicates = [
      increasedBy(simplePath('User', 'user-123', 'failed_attempts'), literalDelta(1)),
      noneCreated('Session'),
    ];
    
    const { results } = evaluatePostconditions(predicates, ctx);
    const summary = summarizePostconditionResults(results);
    
    expect(summary).toContain('1 passed');
    expect(summary).toContain('1 failed');
    expect(summary).toContain('before:');
    expect(summary).toContain('after:');
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle unknown before state', () => {
    const adapter = createFromStateSnapshots(
      {}, // Empty before state
      { User: { 'user-123': { failed_attempts: 1 } } }
    );
    
    const ctx = createPostconditionContext({ adapter });
    const predicate = increasedBy(
      simplePath('User', 'user-123', 'failed_attempts'),
      literalDelta(1)
    );
    
    const result = evaluatePostcondition(predicate, ctx);
    
    // Should return unknown since we don't have before state
    expect(result.kind).toBe('unknown');
  });

  it('should handle unknown after state', () => {
    const adapter = createFromStateSnapshots(
      { User: { 'user-123': { failed_attempts: 0 } } },
      {} // Empty after state
    );
    
    const ctx = createPostconditionContext({ adapter });
    const predicate = increasedBy(
      simplePath('User', 'user-123', 'failed_attempts'),
      literalDelta(1)
    );
    
    const result = evaluatePostcondition(predicate, ctx);
    
    expect(result.kind).toBe('unknown');
  });

  it('should handle non-numeric field values', () => {
    const adapter = createFromStateSnapshots(
      { User: { 'user-123': { name: 'alice' } } },
      { User: { 'user-123': { name: 'bob' } } }
    );
    
    const ctx = createPostconditionContext({ adapter });
    const predicate = increasedBy(
      simplePath('User', 'user-123', 'name'),
      literalDelta(1)
    );
    
    const result = evaluatePostcondition(predicate, ctx);
    
    expect(result.kind).toBe('false');
    expect(result.reason).toContain('numeric');
  });

  it('should handle decremented predicate', () => {
    const adapter = createFromFieldStates({
      'User.balance': { before: 100, after: 50 },
    });
    
    const ctx = createPostconditionContext({ adapter });
    const predicate = increasedBy(
      simplePath('User', 'balance'),
      literalDelta(50),
      'decreased'
    );
    
    const result = evaluatePostcondition(predicate, ctx);
    
    expect(result.kind).toBe('true');
  });

  it('should handle incremented predicate (any positive amount)', () => {
    const adapter = createFromFieldStates({
      'User.failed_attempts': { before: 0, after: 5 },
    });
    
    const ctx = createPostconditionContext({ adapter });
    const predicate = incremented(simplePath('User', 'failed_attempts'));
    
    const result = evaluatePostcondition(predicate, ctx);
    
    expect(result.kind).toBe('true');
    expect(result.postconditionDetails?.computedDelta).toBe(5);
  });
});
