// ============================================================================
// Evaluator Diagnostics Tests - Verification Failure Coverage
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Evaluator,
  expressionToString,
} from '../src/evaluator.js';
import {
  InMemoryEntityStore,
  createEntityStore,
} from '../src/environment.js';
import {
  DiagnosticError,
  EvalDiagnosticCode,
} from '../src/types.js';
import type { EvaluationContext } from '../src/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    input: {},
    result: undefined,
    error: undefined,
    store: createEntityStore(),
    oldState: undefined,
    domain: undefined,
    now: new Date(),
    variables: new Map<string, unknown>(),
    ...overrides,
  };
}

const loc = {
  file: '<test>',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 10,
};

const AST = {
  identifier: (name: string) => ({
    kind: 'Identifier' as const,
    name,
    location: loc,
  }),
  string: (value: string) => ({
    kind: 'StringLiteral' as const,
    value,
    location: loc,
  }),
  number: (value: number, isFloat = false) => ({
    kind: 'NumberLiteral' as const,
    value,
    isFloat,
    location: loc,
  }),
  boolean: (value: boolean) => ({
    kind: 'BooleanLiteral' as const,
    value,
    location: loc,
  }),
  null: () => ({
    kind: 'NullLiteral' as const,
    location: loc,
  }),
  member: (object: unknown, property: string) => ({
    kind: 'MemberExpr' as const,
    object,
    property: AST.identifier(property),
    location: loc,
  }),
  optionalMember: (object: unknown, property: string) => ({
    kind: 'OptionalMemberExpr' as const,
    object,
    property: AST.identifier(property),
    location: loc,
  }),
  index: (object: unknown, idx: unknown) => ({
    kind: 'IndexExpr' as const,
    object,
    index: idx,
    location: loc,
  }),
  qualified: (parts: string[]) => ({
    kind: 'QualifiedName' as const,
    parts: parts.map(name => AST.identifier(name)),
    location: loc,
  }),
  old: (expression: unknown) => ({
    kind: 'OldExpr' as const,
    expression,
    location: loc,
  }),
  call: (callee: unknown, args: unknown[]) => ({
    kind: 'CallExpr' as const,
    callee,
    arguments: args,
    location: loc,
  }),
  binary: (operator: string, left: unknown, right: unknown) => ({
    kind: 'BinaryExpr' as const,
    operator,
    left,
    right,
    location: loc,
  }),
  result: (property?: string) => ({
    kind: 'ResultExpr' as const,
    property: property ? AST.identifier(property) : undefined,
    location: loc,
  }),
};

/**
 * Assert that `fn` throws a DiagnosticError with the expected code,
 * and that all required payload fields are present.
 */
function expectDiagnostic(
  fn: () => unknown,
  expectedCode: EvalDiagnosticCode,
): DiagnosticError {
  let caught: unknown;
  try {
    fn();
    throw new Error('Expected DiagnosticError but no error was thrown');
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(DiagnosticError);
  const diag = caught as DiagnosticError;
  expect(diag.diagnostic.code).toBe(expectedCode);
  expect(diag.diagnostic.span).toBeDefined();
  expect(diag.diagnostic.subExpression).toBeDefined();
  expect(diag.diagnostic.message).toBeTruthy();
  return diag;
}

// ============================================================================
// Tests
// ============================================================================

describe('Verification Diagnostics', () => {
  let evaluator: Evaluator;
  let store: InMemoryEntityStore;
  let ctx: EvaluationContext;

  beforeEach(() => {
    store = createEntityStore();
    ctx = createContext({ store });
    evaluator = new Evaluator({ strict: true });
  });

  // -----------------------------------------------------------------
  // EVAL_NULL_DEREF
  // -----------------------------------------------------------------
  describe('EVAL_NULL_DEREF', () => {
    it('member access on null throws with diagnostic code', () => {
      ctx.variables.set('x', null);
      const expr = AST.member(AST.identifier('x'), 'foo');
      const diag = expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_NULL_DEREF,
      );
      expect(diag.diagnostic.message).toContain('null');
      expect(diag.diagnostic.subExpression).toBe('x.foo');
    });

    it('member access on undefined throws with diagnostic code', () => {
      ctx.variables.set('x', undefined);
      const expr = AST.member(AST.identifier('x'), 'bar');
      const diag = expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_NULL_DEREF,
      );
      expect(diag.diagnostic.message).toContain('undefined');
    });

    it('deep member access where intermediate is null throws', () => {
      ctx.variables.set('user', { profile: null });
      // user.profile.name
      const expr = AST.member(
        AST.member(AST.identifier('user'), 'profile'),
        'name',
      );
      const diag = expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_NULL_DEREF,
      );
      expect(diag.diagnostic.message).toContain("'name'");
      expect(diag.diagnostic.message).toContain('null');
    });

    it('qualified name with null intermediate throws', () => {
      ctx.variables.set('a', { b: null });
      // a.b.c as QualifiedName
      const expr = AST.qualified(['a', 'b', 'c']);
      const diag = expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_NULL_DEREF,
      );
      expect(diag.diagnostic.message).toContain("'c'");
      expect(diag.diagnostic.message).toContain('a.b');
    });

    it('index access on null throws', () => {
      ctx.variables.set('arr', null);
      const expr = AST.index(AST.identifier('arr'), AST.number(0));
      expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_NULL_DEREF,
      );
    });

    it('index access on undefined throws', () => {
      ctx.variables.set('arr', undefined);
      const expr = AST.index(AST.identifier('arr'), AST.number(0));
      const diag = expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_NULL_DEREF,
      );
      expect(diag.diagnostic.message).toContain('undefined');
    });
  });

  // -----------------------------------------------------------------
  // EVAL_UNDEFINED_VAR
  // -----------------------------------------------------------------
  describe('EVAL_UNDEFINED_VAR', () => {
    it('unknown identifier throws with diagnostic code', () => {
      const diag = expectDiagnostic(
        () => evaluator.evaluate(AST.identifier('nonexistent'), ctx),
        EvalDiagnosticCode.EVAL_UNDEFINED_VAR,
      );
      expect(diag.diagnostic.message).toContain('nonexistent');
      expect(diag.diagnostic.subExpression).toBe('nonexistent');
    });

    it('includes source span in diagnostic', () => {
      const diag = expectDiagnostic(
        () => evaluator.evaluate(AST.identifier('missing'), ctx),
        EvalDiagnosticCode.EVAL_UNDEFINED_VAR,
      );
      expect(diag.diagnostic.span.file).toBe('<test>');
      expect(diag.diagnostic.span.line).toBe(1);
    });
  });

  // -----------------------------------------------------------------
  // EVAL_MISSING_OLD_STATE
  // -----------------------------------------------------------------
  describe('EVAL_MISSING_OLD_STATE', () => {
    it('old() without snapshot throws diagnostic', () => {
      const expr = AST.old(AST.identifier('x'));
      const diag = expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_MISSING_OLD_STATE,
      );
      expect(diag.diagnostic.message).toContain('old()');
      expect(diag.diagnostic.message).toContain('snapshot');
    });
  });

  // -----------------------------------------------------------------
  // EVAL_OLD_NESTED_FAIL
  // -----------------------------------------------------------------
  describe('EVAL_OLD_NESTED_FAIL', () => {
    it('wraps inner null-deref diagnostic when old() nested path fails', () => {
      store.create('User', { id: 'u1', name: 'Alice', profile: null });
      const snapshot = store.snapshot();
      store.update('User', 'u1', { name: 'Bob' });

      const ctxWithOld = createContext({
        store,
        oldState: snapshot,
        variables: new Map<string, unknown>([['u', { profile: null }]]),
      });

      // old(u.profile.name) - profile is null -> inner EVAL_NULL_DEREF
      const expr = AST.old(
        AST.member(
          AST.member(AST.identifier('u'), 'profile'),
          'name',
        ),
      );
      const diag = expectDiagnostic(
        () => evaluator.evaluate(expr, ctxWithOld),
        EvalDiagnosticCode.EVAL_OLD_NESTED_FAIL,
      );
      // Cause chain must reference the inner failure
      expect(diag.diagnostic.cause).toBeDefined();
      expect(diag.diagnostic.cause!.code).toBe(EvalDiagnosticCode.EVAL_NULL_DEREF);
    });

    it('wraps inner undefined-var diagnostic inside old()', () => {
      const snapshot = store.snapshot();
      const ctxWithOld = createContext({
        store,
        oldState: snapshot,
      });

      // old(missingVar) -> inner EVAL_UNDEFINED_VAR
      const expr = AST.old(AST.identifier('missingVar'));
      const diag = expectDiagnostic(
        () => evaluator.evaluate(expr, ctxWithOld),
        EvalDiagnosticCode.EVAL_OLD_NESTED_FAIL,
      );
      expect(diag.diagnostic.cause).toBeDefined();
      expect(diag.diagnostic.cause!.code).toBe(EvalDiagnosticCode.EVAL_UNDEFINED_VAR);
    });
  });

  // -----------------------------------------------------------------
  // EVAL_OOB_INDEX
  // -----------------------------------------------------------------
  describe('EVAL_OOB_INDEX', () => {
    it('array index out of bounds (positive) throws', () => {
      ctx.variables.set('arr', [1, 2, 3]);
      const expr = AST.index(AST.identifier('arr'), AST.number(5));
      const diag = expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_OOB_INDEX,
      );
      expect(diag.diagnostic.message).toContain('5');
      expect(diag.diagnostic.message).toContain('3');
    });

    it('array index out of bounds (negative) throws', () => {
      ctx.variables.set('arr', [1, 2, 3]);
      const expr = AST.index(AST.identifier('arr'), AST.number(-1));
      expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_OOB_INDEX,
      );
    });

    it('string index out of bounds throws', () => {
      ctx.variables.set('str', 'abc');
      const expr = AST.index(AST.identifier('str'), AST.number(10));
      const diag = expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_OOB_INDEX,
      );
      expect(diag.diagnostic.message).toContain('string');
    });

    it('empty array index 0 throws', () => {
      ctx.variables.set('arr', []);
      const expr = AST.index(AST.identifier('arr'), AST.number(0));
      expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_OOB_INDEX,
      );
    });
  });

  // -----------------------------------------------------------------
  // EVAL_UNSUPPORTED_EXPR
  // -----------------------------------------------------------------
  describe('EVAL_UNSUPPORTED_EXPR', () => {
    it('unknown expression kind throws diagnostic', () => {
      const weirdExpr = { kind: 'SomeFutureExpr', location: loc };
      const diag = expectDiagnostic(
        () => evaluator.evaluate(weirdExpr, ctx),
        EvalDiagnosticCode.EVAL_UNSUPPORTED_EXPR,
      );
      expect(diag.diagnostic.message).toContain('SomeFutureExpr');
      expect(diag.diagnostic.subExpression).toBe('<SomeFutureExpr>');
    });
  });

  // -----------------------------------------------------------------
  // EVAL_OPTIONAL_CHAIN_NON_OBJECT
  // -----------------------------------------------------------------
  describe('EVAL_OPTIONAL_CHAIN_NON_OBJECT', () => {
    it('?. applied to number throws', () => {
      ctx.variables.set('x', 42);
      const expr = AST.optionalMember(AST.identifier('x'), 'foo');
      const diag = expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_OPTIONAL_CHAIN_NON_OBJECT,
      );
      expect(diag.diagnostic.message).toContain('number');
    });

    it('?. applied to boolean throws', () => {
      ctx.variables.set('x', true);
      const expr = AST.optionalMember(AST.identifier('x'), 'foo');
      expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_OPTIONAL_CHAIN_NON_OBJECT,
      );
    });
  });

  // -----------------------------------------------------------------
  // Optional Chaining - Success Paths
  // -----------------------------------------------------------------
  describe('Optional Chaining', () => {
    it('?. on null returns undefined', () => {
      ctx.variables.set('x', null);
      const expr = AST.optionalMember(AST.identifier('x'), 'foo');
      expect(evaluator.evaluate(expr, ctx)).toBeUndefined();
    });

    it('?. on undefined returns undefined', () => {
      ctx.variables.set('x', undefined);
      const expr = AST.optionalMember(AST.identifier('x'), 'bar');
      expect(evaluator.evaluate(expr, ctx)).toBeUndefined();
    });

    it('?. on object resolves property', () => {
      ctx.variables.set('x', { foo: 42 });
      const expr = AST.optionalMember(AST.identifier('x'), 'foo');
      expect(evaluator.evaluate(expr, ctx)).toBe(42);
    });

    it('chained ?. expressions resolve deeply', () => {
      ctx.variables.set('a', { b: { c: 'deep' } });
      // a?.b?.c
      const expr = AST.optionalMember(
        AST.optionalMember(AST.identifier('a'), 'b'),
        'c',
      );
      expect(evaluator.evaluate(expr, ctx)).toBe('deep');
    });

    it('chained ?. short-circuits when intermediate is null', () => {
      ctx.variables.set('a', { b: null });
      // a?.b?.c -> null?.c -> undefined
      const expr = AST.optionalMember(
        AST.optionalMember(AST.identifier('a'), 'b'),
        'c',
      );
      expect(evaluator.evaluate(expr, ctx)).toBeUndefined();
    });

    it('?. resolves array length', () => {
      ctx.variables.set('arr', [1, 2, 3]);
      const expr = AST.optionalMember(AST.identifier('arr'), 'length');
      expect(evaluator.evaluate(expr, ctx)).toBe(3);
    });

    it('?. resolves string length', () => {
      ctx.variables.set('str', 'hello');
      const expr = AST.optionalMember(AST.identifier('str'), 'length');
      expect(evaluator.evaluate(expr, ctx)).toBe(5);
    });

    it('?. returns undefined for missing property on object', () => {
      ctx.variables.set('obj', { a: 1 });
      const expr = AST.optionalMember(AST.identifier('obj'), 'nope');
      expect(evaluator.evaluate(expr, ctx)).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------
  // Deep Member Access - Success Paths
  // -----------------------------------------------------------------
  describe('Deep Member Access', () => {
    it('resolves a.b.c.d on fully populated object', () => {
      ctx.variables.set('a', { b: { c: { d: 'value' } } });
      const expr = AST.member(
        AST.member(
          AST.member(AST.identifier('a'), 'b'),
          'c',
        ),
        'd',
      );
      expect(evaluator.evaluate(expr, ctx)).toBe('value');
    });

    it('throws EVAL_NULL_DEREF for a.b.c.d when b is null', () => {
      ctx.variables.set('a', { b: null });
      const expr = AST.member(
        AST.member(
          AST.member(AST.identifier('a'), 'b'),
          'c',
        ),
        'd',
      );
      expectDiagnostic(
        () => evaluator.evaluate(expr, ctx),
        EvalDiagnosticCode.EVAL_NULL_DEREF,
      );
    });

    it('deep access succeeds with five levels', () => {
      ctx.variables.set('root', { l1: { l2: { l3: { l4: { l5: 99 } } } } });
      const expr = AST.member(
        AST.member(
          AST.member(
            AST.member(
              AST.member(AST.identifier('root'), 'l1'),
              'l2',
            ),
            'l3',
          ),
          'l4',
        ),
        'l5',
      );
      expect(evaluator.evaluate(expr, ctx)).toBe(99);
    });
  });

  // -----------------------------------------------------------------
  // old() with Nested Paths - Success Paths
  // -----------------------------------------------------------------
  describe('old() with nested paths', () => {
    it('evaluates old(Entity.count()) correctly', () => {
      store.create('User', { id: 'u1', name: 'Alice' });
      const snapshot = store.snapshot();
      // Add another user after snapshot
      store.create('User', { id: 'u2', name: 'Bob' });

      const ctxWithOld = createContext({
        store,
        oldState: snapshot,
        domain: { name: 'Test', entities: [{ name: 'User' }] },
      });

      // old(User.count()) should be 1 (snapshot had 1 user)
      const expr = AST.old(
        AST.call(AST.member(AST.identifier('User'), 'count'), []),
      );
      expect(evaluator.evaluate(expr, ctxWithOld)).toBe(1);
    });

    it('evaluates old() on simple variable', () => {
      const snapshot = store.snapshot();
      const ctxWithOld = createContext({
        store,
        oldState: snapshot,
        variables: new Map<string, unknown>([['x', 10]]),
      });

      const expr = AST.old(AST.identifier('x'));
      expect(evaluator.evaluate(expr, ctxWithOld)).toBe(10);
    });

    it('evaluates old() on nested member expression', () => {
      const snapshot = store.snapshot();
      const ctxWithOld = createContext({
        store,
        oldState: snapshot,
        variables: new Map<string, unknown>([
          ['config', { db: { host: 'localhost', port: 5432 } }],
        ]),
      });

      // old(config.db.port)
      const expr = AST.old(
        AST.member(
          AST.member(AST.identifier('config'), 'db'),
          'port',
        ),
      );
      expect(evaluator.evaluate(expr, ctxWithOld)).toBe(5432);
    });
  });

  // -----------------------------------------------------------------
  // Diagnostic Payload Structure
  // -----------------------------------------------------------------
  describe('Diagnostic Payload Structure', () => {
    it('every diagnostic carries code, message, span, subExpression', () => {
      ctx.variables.set('x', null);
      const expr = AST.member(AST.identifier('x'), 'foo');
      try {
        evaluator.evaluate(expr, ctx);
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(DiagnosticError);
        const diag = (e as DiagnosticError).diagnostic;
        expect(diag.code).toBe(EvalDiagnosticCode.EVAL_NULL_DEREF);
        expect(typeof diag.message).toBe('string');
        expect(diag.message.length).toBeGreaterThan(0);
        expect(diag.span).toEqual(loc);
        expect(typeof diag.subExpression).toBe('string');
        expect(diag.subExpression.length).toBeGreaterThan(0);
      }
    });

    it('wrapped diagnostics carry a cause chain', () => {
      const snapshot = store.snapshot();
      const ctxWithOld = createContext({
        store,
        oldState: snapshot,
        variables: new Map<string, unknown>([['obj', null]]),
      });

      // old(obj.field) where obj is null
      const expr = AST.old(AST.member(AST.identifier('obj'), 'field'));
      try {
        evaluator.evaluate(expr, ctxWithOld);
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(DiagnosticError);
        const diag = (e as DiagnosticError).diagnostic;
        expect(diag.code).toBe(EvalDiagnosticCode.EVAL_OLD_NESTED_FAIL);
        expect(diag.cause).toBeDefined();
        expect(diag.cause!.code).toBe(EvalDiagnosticCode.EVAL_NULL_DEREF);
        expect(diag.cause!.span).toBeDefined();
        expect(diag.cause!.subExpression).toBeDefined();
      }
    });

    it('DiagnosticError extends EvaluationError for backward compat', () => {
      ctx.variables.set('x', null);
      const expr = AST.member(AST.identifier('x'), 'foo');
      try {
        evaluator.evaluate(expr, ctx);
        expect.fail('should have thrown');
      } catch (e) {
        // Catchable as DiagnosticError
        expect(e).toBeInstanceOf(DiagnosticError);
        // Has the diagnostic payload
        expect((e as DiagnosticError).diagnostic).toBeDefined();
        // Also has standard EvaluationError properties
        expect((e as DiagnosticError).location).toBeDefined();
        expect((e as DiagnosticError).code).toBeDefined();
      }
    });

    it('formatMessage includes diagnostic code and location', () => {
      ctx.variables.set('x', null);
      const expr = AST.member(AST.identifier('x'), 'foo');
      try {
        evaluator.evaluate(expr, ctx);
        expect.fail('should have thrown');
      } catch (e) {
        const formatted = (e as DiagnosticError).formatMessage();
        expect(formatted).toContain('EVAL_NULL_DEREF');
        expect(formatted).toContain('<test>');
      }
    });
  });

  // -----------------------------------------------------------------
  // Non-strict Mode (Backward Compatibility)
  // -----------------------------------------------------------------
  describe('Non-strict mode', () => {
    let lenient: Evaluator;

    beforeEach(() => {
      lenient = new Evaluator({ strict: false });
    });

    it('returns undefined for member access on null', () => {
      ctx.variables.set('x', null);
      const expr = AST.member(AST.identifier('x'), 'foo');
      expect(lenient.evaluate(expr, ctx)).toBeUndefined();
    });

    it('returns undefined for OOB array index', () => {
      ctx.variables.set('arr', [1, 2, 3]);
      const expr = AST.index(AST.identifier('arr'), AST.number(10));
      expect(lenient.evaluate(expr, ctx)).toBeUndefined();
    });

    it('returns undefined for index on null', () => {
      ctx.variables.set('x', null);
      const expr = AST.index(AST.identifier('x'), AST.number(0));
      expect(lenient.evaluate(expr, ctx)).toBeUndefined();
    });

    it('returns undefined for qualified name with null intermediate', () => {
      ctx.variables.set('a', { b: null });
      const expr = AST.qualified(['a', 'b', 'c']);
      expect(lenient.evaluate(expr, ctx)).toBeUndefined();
    });

    it('optional chaining on non-object returns undefined', () => {
      ctx.variables.set('x', 42);
      const expr = AST.optionalMember(AST.identifier('x'), 'foo');
      expect(lenient.evaluate(expr, ctx)).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------
  // expressionToString - OptionalMemberExpr
  // -----------------------------------------------------------------
  describe('expressionToString', () => {
    it('stringifies OptionalMemberExpr with ?. syntax', () => {
      const expr = AST.optionalMember(AST.identifier('a'), 'b');
      expect(expressionToString(expr)).toBe('a?.b');
    });

    it('stringifies chained optional member access', () => {
      const expr = AST.optionalMember(
        AST.optionalMember(AST.identifier('a'), 'b'),
        'c',
      );
      expect(expressionToString(expr)).toBe('a?.b?.c');
    });

    it('stringifies mixed member and optional member access', () => {
      const expr = AST.optionalMember(
        AST.member(AST.identifier('a'), 'b'),
        'c',
      );
      expect(expressionToString(expr)).toBe('a.b?.c');
    });
  });
});
