// ============================================================================
// Postcondition Evaluator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  evaluatePostcondition,
  evaluateInvariant,
  evaluateAllProperties,
} from '../src/postcondition-evaluator.js';
import type { EvalContext } from '../src/postcondition-evaluator.js';
import type { Property, LogCapture } from '../src/types.js';

// Helper to create a minimal Property
function makeProperty(
  name: string,
  type: 'precondition' | 'postcondition' | 'invariant',
  expr: any,
  guard?: string,
): Property {
  return {
    name,
    type,
    expression: expr,
    guard,
    location: { line: 1, column: 1, offset: 0 },
  };
}

// Helper to create EvalContext
function makeCtx(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    input: {},
    result: { success: true },
    ...overrides,
  };
}

describe('evaluatePostcondition', () => {
  it('passes for boolean true literal', () => {
    const prop = makeProperty('true', 'postcondition', {
      kind: 'BooleanLiteral',
      value: true,
      location: { line: 1, column: 1, offset: 0 },
    });
    const result = evaluatePostcondition(prop, makeCtx());
    expect(result.passed).toBe(true);
  });

  it('fails for boolean false literal', () => {
    const prop = makeProperty('false', 'postcondition', {
      kind: 'BooleanLiteral',
      value: false,
      location: { line: 1, column: 1, offset: 0 },
    });
    const result = evaluatePostcondition(prop, makeCtx());
    expect(result.passed).toBe(false);
  });

  it('respects success guard', () => {
    const prop = makeProperty('result.success', 'postcondition', {
      kind: 'BooleanLiteral',
      value: false,
      location: { line: 1, column: 1, offset: 0 },
    }, 'success');

    // When result is NOT success, guard doesn't match → vacuously true
    const ctx = makeCtx({ result: { success: false } });
    const result = evaluatePostcondition(prop, ctx);
    expect(result.passed).toBe(true);
  });

  it('evaluates binary comparison: result.field == value', () => {
    const prop = makeProperty('result.count == 5', 'postcondition', {
      kind: 'BinaryExpr',
      operator: '==',
      left: {
        kind: 'MemberExpr',
        object: { kind: 'Identifier', name: 'result', location: { line: 1, column: 1, offset: 0 } },
        property: { name: 'count' },
        location: { line: 1, column: 1, offset: 0 },
      },
      right: { kind: 'NumberLiteral', value: 5, location: { line: 1, column: 1, offset: 0 } },
      location: { line: 1, column: 1, offset: 0 },
    });

    const ctx = makeCtx({ result: { success: true, result: { count: 5 } } });
    expect(evaluatePostcondition(prop, ctx).passed).toBe(true);

    const ctx2 = makeCtx({ result: { success: true, result: { count: 3 } } });
    expect(evaluatePostcondition(prop, ctx2).passed).toBe(false);
  });

  it('evaluates logical and', () => {
    const prop = makeProperty('a and b', 'postcondition', {
      kind: 'BinaryExpr',
      operator: 'and',
      left: { kind: 'BooleanLiteral', value: true, location: { line: 1, column: 1, offset: 0 } },
      right: { kind: 'BooleanLiteral', value: true, location: { line: 1, column: 1, offset: 0 } },
      location: { line: 1, column: 1, offset: 0 },
    });
    expect(evaluatePostcondition(prop, makeCtx()).passed).toBe(true);
  });

  it('evaluates implies (false implies anything = true)', () => {
    const prop = makeProperty('false implies crash', 'postcondition', {
      kind: 'BinaryExpr',
      operator: 'implies',
      left: { kind: 'BooleanLiteral', value: false, location: { line: 1, column: 1, offset: 0 } },
      right: { kind: 'BooleanLiteral', value: false, location: { line: 1, column: 1, offset: 0 } },
      location: { line: 1, column: 1, offset: 0 },
    });
    expect(evaluatePostcondition(prop, makeCtx()).passed).toBe(true);
  });
});

describe('evaluateInvariant', () => {
  it('detects password in logs (never_logged)', () => {
    const prop = makeProperty('password never_logged', 'invariant', {
      kind: 'BooleanLiteral',
      value: true,
      location: { line: 1, column: 1, offset: 0 },
    });

    const logs: LogCapture[] = [
      {
        level: 'log',
        message: 'User logged in with password: secret123',
        args: [],
        timestamp: Date.now(),
      },
    ];

    const ctx = makeCtx({
      input: { password: 'secret123' },
      result: { success: true },
      logs,
    });

    const result = evaluateInvariant(prop, ctx);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('found in log');
  });

  it('passes when password is not in logs', () => {
    const prop = makeProperty('password never_logged', 'invariant', {
      kind: 'BooleanLiteral',
      value: true,
      location: { line: 1, column: 1, offset: 0 },
    });

    const logs: LogCapture[] = [
      {
        level: 'log',
        message: 'User logged in successfully',
        args: [],
        timestamp: Date.now(),
      },
    ];

    const ctx = makeCtx({
      input: { password: 'secret123' },
      result: { success: true },
      logs,
    });

    expect(evaluateInvariant(prop, ctx).passed).toBe(true);
  });

  it('detects never_stored_plaintext', () => {
    const prop = makeProperty('password never_stored_plaintext', 'invariant', {
      kind: 'BooleanLiteral',
      value: true,
      location: { line: 1, column: 1, offset: 0 },
    });

    const ctx = makeCtx({
      input: { password: 'mypassword' },
      result: { success: true, result: { stored: 'mypassword' } },
    });

    expect(evaluateInvariant(prop, ctx).passed).toBe(false);
  });

  it('detects never_exposed in result', () => {
    const prop = makeProperty('secret never_exposed', 'invariant', {
      kind: 'BooleanLiteral',
      value: true,
      location: { line: 1, column: 1, offset: 0 },
    });

    const ctx = makeCtx({
      input: { secret: 'api_key_xyz' },
      result: { success: true, result: { data: 'contains api_key_xyz value' } },
    });

    expect(evaluateInvariant(prop, ctx).passed).toBe(false);
  });
});

describe('evaluateAllProperties', () => {
  it('returns all results and stops on first failure', () => {
    const post1 = makeProperty('ok', 'postcondition', {
      kind: 'BooleanLiteral', value: true, location: { line: 1, column: 1, offset: 0 },
    });
    const post2 = makeProperty('fail', 'postcondition', {
      kind: 'BooleanLiteral', value: false, location: { line: 1, column: 1, offset: 0 },
    });
    const post3 = makeProperty('never reached', 'postcondition', {
      kind: 'BooleanLiteral', value: true, location: { line: 1, column: 1, offset: 0 },
    });

    const { passed, results } = evaluateAllProperties(
      [post1, post2, post3],
      [],
      makeCtx()
    );

    expect(passed).toBe(false);
    expect(results).toHaveLength(2); // Stopped after post2
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  it('passes when all properties hold', () => {
    const post = makeProperty('ok', 'postcondition', {
      kind: 'BooleanLiteral', value: true, location: { line: 1, column: 1, offset: 0 },
    });
    const inv = makeProperty('ok inv', 'invariant', {
      kind: 'BooleanLiteral', value: true, location: { line: 1, column: 1, offset: 0 },
    });

    const { passed } = evaluateAllProperties([post], [inv], makeCtx());
    expect(passed).toBe(true);
  });
});
