import { describe, it, expect } from 'vitest';
import {
  clarifySpec,
  createQuestion,
  createAnswer,
  wasApplied,
  isUnresolved,
  appliedCount,
  unresolvedCount,
} from '../clarify.js';
import {
  parseBoolean,
  parseDuration,
  normalizeAnswer,
  normalizeAnswers,
} from '../normalizeAnswers.js';
import {
  applyRateLimit,
  applySessionExpiry,
  applyAuditLogging,
  applyIdempotency,
} from '../clarifyRules.js';
import type {
  ClarifySpecInput,
  OpenQuestion,
  Answer,
  DurationValue,
} from '../clarifyTypes.js';
import {
  createDomain,
  createBehavior,
  createInputSpec,
  createOutputSpec,
  createField,
  createPrimitiveType,
} from '../../corpus-tests/corpusRunner.js';
import type { Domain, Behavior } from '../../corpus-tests/corpusRunner.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createTestDomain(): Domain {
  return createDomain('TestDomain', '1.0.0', {
    behaviors: [
      createBehavior('CreateUser', {
        description: 'Creates a new user account',
        input: createInputSpec([
          createField('email', createPrimitiveType('String')),
          createField('password', createPrimitiveType('String')),
        ]),
        output: createOutputSpec(createPrimitiveType('UUID')),
      }),
      createBehavior('Login', {
        description: 'User login behavior',
        input: createInputSpec([
          createField('email', createPrimitiveType('String')),
          createField('password', createPrimitiveType('String')),
        ]),
        output: createOutputSpec(createPrimitiveType('String')),
      }),
    ],
  });
}

// ============================================================================
// RATE LIMIT TESTS
// ============================================================================

describe('Rate Limit Clarification', () => {
  it('should apply numeric rate limit to all behaviors', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('rate-q1', 'rate_limit', 'Enable rate limiting?'),
    ];
    const answers: Answer[] = [
      createAnswer('rate-q1', 100),
    ];

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(appliedCount(result)).toBe(1);
    expect(wasApplied(result, 'rate-q1')).toBe(true);
    expect(unresolvedCount(result)).toBe(0);

    // Check both behaviors have rate_limit
    for (const behavior of result.ast.behaviors) {
      const rateLimit = behavior.security.find(s => s.type === 'rate_limit');
      expect(rateLimit).toBeDefined();
      expect((rateLimit?.details as any)?.value).toBe(100);
    }
  });

  it('should apply rate limit to specific behavior only', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('rate-q2', 'rate_limit', 'Rate limit Login?', {
        targetBehaviors: ['Login'],
      }),
    ];
    const answers: Answer[] = [
      createAnswer('rate-q2', 50),
    ];

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(wasApplied(result, 'rate-q2')).toBe(true);

    // Only Login should have rate_limit
    const createUser = result.ast.behaviors.find(b => b.name.name === 'CreateUser');
    const login = result.ast.behaviors.find(b => b.name.name === 'Login');

    expect(createUser?.security.find(s => s.type === 'rate_limit')).toBeUndefined();
    expect(login?.security.find(s => s.type === 'rate_limit')).toBeDefined();
  });

  it('should remove rate limit when answer is false', () => {
    // First add rate limit, then remove it
    let ast = createTestDomain();
    
    // Add rate limit
    const addResult = clarifySpec({
      ast,
      openQuestions: [createQuestion('add-rl', 'rate_limit', 'Add?')],
      answers: [createAnswer('add-rl', 100)],
    });

    // Now remove it
    const removeResult = clarifySpec({
      ast: addResult.ast,
      openQuestions: [createQuestion('remove-rl', 'rate_limit', 'Remove?')],
      answers: [createAnswer('remove-rl', false)],
    });

    for (const behavior of removeResult.ast.behaviors) {
      const rateLimit = behavior.security.find(s => s.type === 'rate_limit');
      expect(rateLimit).toBeUndefined();
    }
  });

  it('should parse string rate limit values', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('rate-str', 'rate_limit', 'Enable?'),
    ];
    const answers: Answer[] = [
      createAnswer('rate-str', 'yes' as any), // String that should be normalized
    ];

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(wasApplied(result, 'rate-str')).toBe(true);
    // Default rate limit (100) applied when "yes"
    const behavior = result.ast.behaviors[0];
    const rateLimit = behavior.security.find(s => s.type === 'rate_limit');
    expect((rateLimit?.details as any)?.value).toBe(100);
  });
});

// ============================================================================
// SESSION EXPIRY TESTS
// ============================================================================

describe('Session Expiry Clarification', () => {
  it('should apply session expiry with duration value', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('session-q1', 'session_expiry', 'Session timeout?'),
    ];
    const answers: Answer[] = [
      createAnswer('session-q1', { value: 30, unit: 'minutes' } as DurationValue),
    ];

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(wasApplied(result, 'session-q1')).toBe(true);
    expect(unresolvedCount(result)).toBe(0);

    // Check temporal specs were added
    for (const behavior of result.ast.behaviors) {
      const sessionSpec = behavior.temporal.find(t => 
        t.operator === 'within' && t.duration?.value === 30
      );
      expect(sessionSpec).toBeDefined();
      expect(sessionSpec?.duration?.unit).toBe('minutes');
    }
  });

  it('should parse string duration values', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('session-str', 'session_expiry', 'Timeout?'),
    ];
    const answers: Answer[] = [
      createAnswer('session-str', '24h' as any),
    ];

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(wasApplied(result, 'session-str')).toBe(true);

    const behavior = result.ast.behaviors[0];
    const sessionSpec = behavior.temporal.find(t => t.operator === 'within');
    expect(sessionSpec?.duration?.value).toBe(24);
    expect(sessionSpec?.duration?.unit).toBe('hours');
  });

  it('should handle numeric duration as minutes', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('session-num', 'session_expiry', 'Timeout in minutes?'),
    ];
    const answers: Answer[] = [
      createAnswer('session-num', 60 as any),
    ];

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(wasApplied(result, 'session-num')).toBe(true);

    const behavior = result.ast.behaviors[0];
    const sessionSpec = behavior.temporal.find(t => t.operator === 'within');
    expect(sessionSpec?.duration?.value).toBe(60);
    expect(sessionSpec?.duration?.unit).toBe('minutes');
  });
});

// ============================================================================
// AUDIT LOGGING TESTS
// ============================================================================

describe('Audit Logging Clarification', () => {
  it('should enable audit logging when true', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('audit-q1', 'audit_logging', 'Enable audit logging?'),
    ];
    const answers: Answer[] = [
      createAnswer('audit-q1', true),
    ];

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(wasApplied(result, 'audit-q1')).toBe(true);

    for (const behavior of result.ast.behaviors) {
      expect(behavior.observability).toBeDefined();
      const auditLog = behavior.observability?.logs.find(l => 
        l.include.some(i => i.name === 'audit')
      );
      expect(auditLog).toBeDefined();
      expect(auditLog?.level).toBe('info');
      expect(auditLog?.condition).toBe('always');
    }
  });

  it('should disable audit logging when false', () => {
    // First enable
    const ast = createTestDomain();
    const enableResult = clarifySpec({
      ast,
      openQuestions: [createQuestion('enable-audit', 'audit_logging', 'Enable?')],
      answers: [createAnswer('enable-audit', true)],
    });

    // Then disable
    const disableResult = clarifySpec({
      ast: enableResult.ast,
      openQuestions: [createQuestion('disable-audit', 'audit_logging', 'Disable?')],
      answers: [createAnswer('disable-audit', false)],
    });

    for (const behavior of disableResult.ast.behaviors) {
      const auditLog = behavior.observability?.logs.find(l => 
        l.include.some(i => i.name === 'audit')
      );
      expect(auditLog).toBeUndefined();
    }
  });

  it('should parse string boolean values for audit', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('audit-str', 'audit_logging', 'Enable?'),
    ];
    const answers: Answer[] = [
      createAnswer('audit-str', 'on' as any),
    ];

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(wasApplied(result, 'audit-str')).toBe(true);
  });
});

// ============================================================================
// IDEMPOTENCY TESTS
// ============================================================================

describe('Idempotency Clarification', () => {
  it('should enable idempotency when true', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('idem-q1', 'idempotency', 'Enable idempotency?'),
    ];
    const answers: Answer[] = [
      createAnswer('idem-q1', true),
    ];

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(wasApplied(result, 'idem-q1')).toBe(true);

    for (const behavior of result.ast.behaviors) {
      const idempotencyCheck = behavior.preconditions.find(p => 
        p.kind === 'CallExpr' && (p as any).callee?.name === 'idempotent'
      );
      expect(idempotencyCheck).toBeDefined();
    }
  });

  it('should disable idempotency when false', () => {
    const ast = createTestDomain();
    
    // First enable
    const enableResult = clarifySpec({
      ast,
      openQuestions: [createQuestion('enable-idem', 'idempotency', 'Enable?')],
      answers: [createAnswer('enable-idem', true)],
    });

    // Then disable
    const disableResult = clarifySpec({
      ast: enableResult.ast,
      openQuestions: [createQuestion('disable-idem', 'idempotency', 'Disable?')],
      answers: [createAnswer('disable-idem', false)],
    });

    for (const behavior of disableResult.ast.behaviors) {
      const idempotencyCheck = behavior.preconditions.find(p => 
        p.kind === 'CallExpr' && (p as any).callee?.name === 'idempotent'
      );
      expect(idempotencyCheck).toBeUndefined();
    }
  });
});

// ============================================================================
// MIXED QUESTION TYPES
// ============================================================================

describe('Mixed Clarifications', () => {
  it('should handle multiple question types at once', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('mix-rate', 'rate_limit', 'Rate limit?'),
      createQuestion('mix-session', 'session_expiry', 'Session timeout?'),
      createQuestion('mix-audit', 'audit_logging', 'Audit?'),
      createQuestion('mix-idem', 'idempotency', 'Idempotent?'),
    ];
    const answers: Answer[] = [
      createAnswer('mix-rate', 200),
      createAnswer('mix-session', { value: 1, unit: 'hours' } as DurationValue),
      createAnswer('mix-audit', true),
      createAnswer('mix-idem', true),
    ];

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(appliedCount(result)).toBe(4);
    expect(unresolvedCount(result)).toBe(0);

    const behavior = result.ast.behaviors[0];

    // Rate limit
    expect(behavior.security.find(s => s.type === 'rate_limit')).toBeDefined();

    // Session expiry
    expect(behavior.temporal.find(t => t.operator === 'within')).toBeDefined();

    // Audit logging
    expect(behavior.observability?.logs.find(l => 
      l.include.some(i => i.name === 'audit')
    )).toBeDefined();

    // Idempotency
    expect(behavior.preconditions.find(p => 
      p.kind === 'CallExpr' && (p as any).callee?.name === 'idempotent'
    )).toBeDefined();
  });
});

// ============================================================================
// UNRESOLVED QUESTIONS
// ============================================================================

describe('Unresolved Questions', () => {
  it('should track unanswered questions as unresolved', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('answered', 'rate_limit', 'Answered?'),
      createQuestion('unanswered', 'audit_logging', 'Not answered?'),
    ];
    const answers: Answer[] = [
      createAnswer('answered', 100),
      // No answer for 'unanswered'
    ];

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(wasApplied(result, 'answered')).toBe(true);
    expect(isUnresolved(result, 'unanswered')).toBe(true);
    expect(unresolvedCount(result)).toBe(1);
    
    const unresolved = result.unresolved.find(u => u.questionId === 'unanswered');
    expect(unresolved?.reason).toBe('no_answer');
  });

  it('should use default value when no answer provided', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('with-default', 'rate_limit', 'Rate limit?', {
        defaultValue: 50,
      }),
    ];
    const answers: Answer[] = []; // No answers

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(wasApplied(result, 'with-default')).toBe(true);
    expect(unresolvedCount(result)).toBe(0);

    const behavior = result.ast.behaviors[0];
    const rateLimit = behavior.security.find(s => s.type === 'rate_limit');
    expect((rateLimit?.details as any)?.value).toBe(50);
  });

  it('should track invalid answers as unresolved', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('invalid-q', 'audit_logging', 'Audit?'),
    ];
    const answers: Answer[] = [
      createAnswer('invalid-q', 'maybe' as any), // Invalid boolean
    ];

    const result = clarifySpec({ ast, openQuestions: questions, answers });

    expect(isUnresolved(result, 'invalid-q')).toBe(true);
    
    const unresolved = result.unresolved.find(u => u.questionId === 'invalid-q');
    expect(unresolved?.reason).toBe('invalid_answer');
  });
});

// ============================================================================
// DETERMINISM TESTS
// ============================================================================

describe('Determinism', () => {
  it('should produce identical results for same inputs', () => {
    const ast = createTestDomain();
    const questions: OpenQuestion[] = [
      createQuestion('det-rate', 'rate_limit', 'Rate?'),
      createQuestion('det-audit', 'audit_logging', 'Audit?'),
    ];
    const answers: Answer[] = [
      createAnswer('det-rate', 150),
      createAnswer('det-audit', true),
    ];

    const input: ClarifySpecInput = { ast, openQuestions: questions, answers };

    const result1 = clarifySpec(input);
    const result2 = clarifySpec(input);
    const result3 = clarifySpec(input);

    // Compare serialized ASTs
    const json1 = JSON.stringify(result1.ast);
    const json2 = JSON.stringify(result2.ast);
    const json3 = JSON.stringify(result3.ast);

    expect(json1).toBe(json2);
    expect(json2).toBe(json3);

    // Compare applied counts
    expect(appliedCount(result1)).toBe(appliedCount(result2));
    expect(appliedCount(result2)).toBe(appliedCount(result3));
  });

  it('should process questions in consistent order regardless of input order', () => {
    const ast = createTestDomain();
    
    // Questions in different orders
    const questions1: OpenQuestion[] = [
      createQuestion('a-q', 'rate_limit', 'A?'),
      createQuestion('b-q', 'audit_logging', 'B?'),
    ];
    const questions2: OpenQuestion[] = [
      createQuestion('b-q', 'audit_logging', 'B?'),
      createQuestion('a-q', 'rate_limit', 'A?'),
    ];

    const answers: Answer[] = [
      createAnswer('a-q', 100),
      createAnswer('b-q', true),
    ];

    const result1 = clarifySpec({ ast, openQuestions: questions1, answers });
    const result2 = clarifySpec({ ast, openQuestions: questions2, answers });

    // Results should be identical
    expect(JSON.stringify(result1.ast)).toBe(JSON.stringify(result2.ast));
  });
});

// ============================================================================
// NORMALIZATION TESTS
// ============================================================================

describe('Answer Normalization', () => {
  describe('parseBoolean', () => {
    it('should parse various true values', () => {
      expect(parseBoolean('yes')).toBe(true);
      expect(parseBoolean('YES')).toBe(true);
      expect(parseBoolean('true')).toBe(true);
      expect(parseBoolean('on')).toBe(true);
      expect(parseBoolean('1')).toBe(true);
      expect(parseBoolean('enabled')).toBe(true);
    });

    it('should parse various false values', () => {
      expect(parseBoolean('no')).toBe(false);
      expect(parseBoolean('NO')).toBe(false);
      expect(parseBoolean('false')).toBe(false);
      expect(parseBoolean('off')).toBe(false);
      expect(parseBoolean('0')).toBe(false);
      expect(parseBoolean('disabled')).toBe(false);
    });

    it('should return null for invalid values', () => {
      expect(parseBoolean('maybe')).toBe(null);
      expect(parseBoolean('abc')).toBe(null);
    });
  });

  describe('parseDuration', () => {
    it('should parse various duration formats', () => {
      expect(parseDuration('30m')).toEqual({ value: 30, unit: 'minutes' });
      expect(parseDuration('1h')).toEqual({ value: 1, unit: 'hours' });
      expect(parseDuration('24 hours')).toEqual({ value: 24, unit: 'hours' });
      expect(parseDuration('7d')).toEqual({ value: 7, unit: 'days' });
      expect(parseDuration('500ms')).toEqual({ value: 500, unit: 'ms' });
      expect(parseDuration('60 seconds')).toEqual({ value: 60, unit: 'seconds' });
    });

    it('should return null for invalid formats', () => {
      expect(parseDuration('abc')).toBe(null);
      expect(parseDuration('30x')).toBe(null);
    });
  });
});
