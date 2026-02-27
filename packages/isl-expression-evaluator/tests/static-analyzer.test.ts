// ============================================================================
// ISL Static Analyzer - Comprehensive Test Suite
// ============================================================================
// Tests cover three categories:
// 1. Provably TRUE cases (type constraints satisfy condition)
// 2. Provably FALSE cases (type mismatch, impossible condition)
// 3. UNKNOWN cases (needs runtime data)
// ============================================================================

import { describe, it, expect } from 'vitest';
import type { Expression } from '@isl-lang/parser';
import {
  analyzeStatically,
  analyzeAll,
  summarizeResults,
  createTypeContext,
  typeInfo,
  fieldInfo,
  entityInfo,
} from '../src/static/index.js';
import type { TypeContext, StaticAnalysisResult } from '../src/static/types.js';

// ============================================================================
// AST HELPERS - Build expression ASTs without the parser
// ============================================================================

const loc = { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };

function ident(name: string): Expression {
  return { kind: 'Identifier', name, location: loc } as Expression;
}

function numLit(value: number, isFloat = false): Expression {
  return { kind: 'NumberLiteral', value, isFloat, location: loc } as Expression;
}

function strLit(value: string): Expression {
  return { kind: 'StringLiteral', value, location: loc } as Expression;
}

function boolLit(value: boolean): Expression {
  return { kind: 'BooleanLiteral', value, location: loc } as Expression;
}

function nullLit(): Expression {
  return { kind: 'NullLiteral', location: loc } as Expression;
}

function binary(left: Expression, operator: string, right: Expression): Expression {
  return { kind: 'BinaryExpr', operator, left, right, location: loc } as Expression;
}

function unary(operator: string, operand: Expression): Expression {
  return { kind: 'UnaryExpr', operator, operand, location: loc } as Expression;
}

function member(object: Expression, property: string): Expression {
  return { kind: 'MemberExpr', object, property: { kind: 'Identifier', name: property, location: loc }, location: loc } as Expression;
}

function call(callee: Expression, args: Expression[]): Expression {
  return { kind: 'CallExpr', callee, arguments: args, location: loc } as Expression;
}

function resultExpr(property?: string): Expression {
  return {
    kind: 'ResultExpr',
    property: property ? { kind: 'Identifier', name: property, location: loc } : undefined,
    location: loc,
  } as Expression;
}

function inputExpr(property: string): Expression {
  return {
    kind: 'InputExpr',
    property: { kind: 'Identifier', name: property, location: loc },
    location: loc,
  } as Expression;
}

function quantifier(
  type: 'all' | 'any' | 'none' | 'count' | 'sum' | 'filter',
  variable: string,
  collection: Expression,
  predicate: Expression
): Expression {
  return {
    kind: 'QuantifierExpr',
    quantifier: type,
    variable: { kind: 'Identifier', name: variable, location: loc },
    collection,
    predicate,
    location: loc,
  } as Expression;
}

function conditional(condition: Expression, thenBranch: Expression, elseBranch: Expression): Expression {
  return {
    kind: 'ConditionalExpr',
    condition, thenBranch, elseBranch,
    location: loc,
  } as Expression;
}

function listExpr(elements: Expression[]): Expression {
  return { kind: 'ListExpr', elements, location: loc } as Expression;
}

function oldExpr(expression: Expression): Expression {
  return { kind: 'OldExpr', expression, location: loc } as Expression;
}

function indexExpr(object: Expression, index: Expression): Expression {
  return { kind: 'IndexExpr', object, index, location: loc } as Expression;
}

// ============================================================================
// TEST: Provably TRUE Cases
// ============================================================================

describe('Static Analyzer - Provably TRUE', () => {
  describe('Literal evaluation', () => {
    it('boolean true literal → true', () => {
      const result = analyzeStatically(boolLit(true), createTypeContext());
      expect(result.verdict).toBe('true');
      expect(result.confidence).toBe(1.0);
      expect(result.category).toBe('literal');
    });

    it('non-zero number literal → true (truthy)', () => {
      const result = analyzeStatically(numLit(42), createTypeContext());
      expect(result.verdict).toBe('true');
      expect(result.confidence).toBe(1.0);
    });

    it('non-empty string literal → true (truthy)', () => {
      const result = analyzeStatically(strLit('hello'), createTypeContext());
      expect(result.verdict).toBe('true');
      expect(result.confidence).toBe(1.0);
    });

    it('non-empty list literal → true', () => {
      const result = analyzeStatically(listExpr([numLit(1)]), createTypeContext());
      expect(result.verdict).toBe('true');
    });
  });

  describe('Literal comparison', () => {
    it('5 > 3 → true', () => {
      const result = analyzeStatically(binary(numLit(5), '>', numLit(3)), createTypeContext());
      expect(result.verdict).toBe('true');
      expect(result.confidence).toBe(1.0);
    });

    it('3 == 3 → true', () => {
      const result = analyzeStatically(binary(numLit(3), '==', numLit(3)), createTypeContext());
      expect(result.verdict).toBe('true');
    });

    it('"abc" == "abc" → true', () => {
      const result = analyzeStatically(binary(strLit('abc'), '==', strLit('abc')), createTypeContext());
      expect(result.verdict).toBe('true');
    });

    it('5 != 3 → true', () => {
      const result = analyzeStatically(binary(numLit(5), '!=', numLit(3)), createTypeContext());
      expect(result.verdict).toBe('true');
    });

    it('3 <= 5 → true', () => {
      const result = analyzeStatically(binary(numLit(3), '<=', numLit(5)), createTypeContext());
      expect(result.verdict).toBe('true');
    });
  });

  describe('Tautology detection', () => {
    it('x == x → true (tautology)', () => {
      const result = analyzeStatically(binary(ident('x'), '==', ident('x')), createTypeContext());
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('tautology');
    });

    it('x <= x → true (tautology)', () => {
      const result = analyzeStatically(binary(ident('x'), '<=', ident('x')), createTypeContext());
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('tautology');
    });

    it('x >= x → true (tautology)', () => {
      const result = analyzeStatically(binary(ident('x'), '>=', ident('x')), createTypeContext());
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('tautology');
    });

    it('result.email == result.email → true', () => {
      const result = analyzeStatically(
        binary(resultExpr('email'), '==', resultExpr('email')),
        createTypeContext()
      );
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('tautology');
    });
  });

  describe('Type-constraint propagation', () => {
    const emailType = typeInfo('string', { minLength: 1, format: 'email' });
    const ageType = typeInfo('integer', { min: 0, max: 150 });

    const userEntity = entityInfo('User', [
      fieldInfo('email', emailType, true),
      fieldInfo('age', ageType, true),
      fieldInfo('name', typeInfo('string', { minLength: 1 }), true),
      fieldInfo('nickname', typeInfo('string'), false),
    ]);

    const ctx = createTypeContext({
      entities: new Map([['User', userEntity]]),
      resultEntity: userEntity,
      types: new Map([
        ['Email', emailType],
        ['Age', ageType],
      ]),
    });

    it('required field on entity → true (field existence)', () => {
      const result = analyzeStatically(resultExpr('email'), ctx);
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('field-existence');
    });

    it('required field "name" on entity → true', () => {
      const result = analyzeStatically(resultExpr('name'), ctx);
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('field-existence');
    });

    it('result.email.length > 0 provable from min_length constraint', () => {
      // result.email has type string { min_length: 1 }
      // result.email.length resolves to integer { min: 1 }
      // 1 > 0 is provably true via range analysis
      const expr = binary(member(resultExpr('email'), 'length'), '>', numLit(0));
      const result = analyzeStatically(expr, ctx);
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('range-analysis');
    });

    it('result.age >= 0 provable from min constraint', () => {
      // result.age has type integer { min: 0, max: 150 }
      // So result.age >= 0 should be provably true
      const expr = binary(resultExpr('age'), '>=', numLit(0));
      const result = analyzeStatically(expr, ctx);
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('range-analysis');
    });

    it('result.age <= 150 provable from max constraint', () => {
      const expr = binary(resultExpr('age'), '<=', numLit(150));
      const result = analyzeStatically(expr, ctx);
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('range-analysis');
    });

    it('is_valid(email_var) when type has min_length > 0 → true', () => {
      const ctxWithBinding = createTypeContext({
        bindings: new Map([['email', emailType]]),
      });
      const expr = call(ident('is_valid'), [ident('email')]);
      const result = analyzeStatically(expr, ctxWithBinding);
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('type-constraint');
    });
  });

  describe('Type mismatch → true for !=', () => {
    it('number != string → true (always different types)', () => {
      const ctx = createTypeContext({
        bindings: new Map([
          ['x', typeInfo('number')],
          ['y', typeInfo('string')],
        ]),
      });
      const result = analyzeStatically(binary(ident('x'), '!=', ident('y')), ctx);
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('type-mismatch');
    });
  });

  describe('Logical simplification', () => {
    it('true or X → true (short-circuit)', () => {
      const result = analyzeStatically(binary(boolLit(true), 'or', ident('unknown_var')), createTypeContext());
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('logical-simplification');
    });

    it('false implies anything → true (vacuous truth)', () => {
      const result = analyzeStatically(binary(boolLit(false), 'implies', ident('anything')), createTypeContext());
      expect(result.verdict).toBe('true');
    });

    it('anything implies true → true', () => {
      const result = analyzeStatically(binary(ident('anything'), 'implies', boolLit(true)), createTypeContext());
      expect(result.verdict).toBe('true');
    });

    it('not false → true', () => {
      const result = analyzeStatically(unary('not', boolLit(false)), createTypeContext());
      expect(result.verdict).toBe('true');
    });

    it('true and true → true', () => {
      const result = analyzeStatically(binary(boolLit(true), 'and', boolLit(true)), createTypeContext());
      expect(result.verdict).toBe('true');
    });
  });

  describe('Quantifier over empty collection', () => {
    it('all over empty list → true (vacuous truth)', () => {
      const result = analyzeStatically(
        quantifier('all', 'x', listExpr([]), binary(ident('x'), '>', numLit(0))),
        createTypeContext()
      );
      expect(result.verdict).toBe('true');
    });

    it('none over empty list → true (vacuous truth)', () => {
      const result = analyzeStatically(
        quantifier('none', 'x', listExpr([]), binary(ident('x'), '>', numLit(0))),
        createTypeContext()
      );
      expect(result.verdict).toBe('true');
    });
  });

  describe('Enum analysis', () => {
    it('value not in enum with != → true', () => {
      const ctx = createTypeContext({
        bindings: new Map([
          ['status', typeInfo('string', { enumValues: ['active', 'suspended', 'banned'] })],
        ]),
      });
      const result = analyzeStatically(binary(ident('status'), '!=', strLit('deleted')), ctx);
      expect(result.verdict).toBe('true');
      expect(result.category).toBe('enum-analysis');
    });
  });

  describe('Membership in literal list', () => {
    it('3 in [1, 2, 3] → true', () => {
      const result = analyzeStatically(
        binary(numLit(3), 'in', listExpr([numLit(1), numLit(2), numLit(3)])),
        createTypeContext()
      );
      expect(result.verdict).toBe('true');
    });
  });

  describe('Conditional with both branches same', () => {
    it('cond ? true : true → true (both branches true)', () => {
      const result = analyzeStatically(
        conditional(ident('x'), boolLit(true), boolLit(true)),
        createTypeContext()
      );
      expect(result.verdict).toBe('true');
    });
  });

  describe('Biconditional (iff)', () => {
    it('true iff true → true', () => {
      const result = analyzeStatically(binary(boolLit(true), 'iff', boolLit(true)), createTypeContext());
      expect(result.verdict).toBe('true');
    });

    it('false iff false → true', () => {
      const result = analyzeStatically(binary(boolLit(false), 'iff', boolLit(false)), createTypeContext());
      expect(result.verdict).toBe('true');
    });
  });
});

// ============================================================================
// TEST: Provably FALSE Cases
// ============================================================================

describe('Static Analyzer - Provably FALSE', () => {
  describe('Literal evaluation', () => {
    it('boolean false literal → false', () => {
      const result = analyzeStatically(boolLit(false), createTypeContext());
      expect(result.verdict).toBe('false');
      expect(result.confidence).toBe(1.0);
    });

    it('number 0 literal → false (falsy)', () => {
      const result = analyzeStatically(numLit(0), createTypeContext());
      expect(result.verdict).toBe('false');
    });

    it('empty string literal → false (falsy)', () => {
      const result = analyzeStatically(strLit(''), createTypeContext());
      expect(result.verdict).toBe('false');
    });

    it('null literal → false', () => {
      const result = analyzeStatically(nullLit(), createTypeContext());
      expect(result.verdict).toBe('false');
    });

    it('empty list literal → false', () => {
      const result = analyzeStatically(listExpr([]), createTypeContext());
      expect(result.verdict).toBe('false');
    });
  });

  describe('Literal comparison', () => {
    it('3 > 5 → false', () => {
      const result = analyzeStatically(binary(numLit(3), '>', numLit(5)), createTypeContext());
      expect(result.verdict).toBe('false');
    });

    it('3 == 5 → false', () => {
      const result = analyzeStatically(binary(numLit(3), '==', numLit(5)), createTypeContext());
      expect(result.verdict).toBe('false');
    });

    it('"abc" == "def" → false', () => {
      const result = analyzeStatically(binary(strLit('abc'), '==', strLit('def')), createTypeContext());
      expect(result.verdict).toBe('false');
    });
  });

  describe('Contradiction detection', () => {
    it('x != x → false (contradiction)', () => {
      const result = analyzeStatically(binary(ident('x'), '!=', ident('x')), createTypeContext());
      expect(result.verdict).toBe('false');
      expect(result.category).toBe('contradiction');
    });

    it('x < x → false (contradiction)', () => {
      const result = analyzeStatically(binary(ident('x'), '<', ident('x')), createTypeContext());
      expect(result.verdict).toBe('false');
      expect(result.category).toBe('contradiction');
    });

    it('x > x → false (contradiction)', () => {
      const result = analyzeStatically(binary(ident('x'), '>', ident('x')), createTypeContext());
      expect(result.verdict).toBe('false');
      expect(result.category).toBe('contradiction');
    });
  });

  describe('Type mismatch', () => {
    it('number == string → false (incompatible types)', () => {
      const ctx = createTypeContext({
        bindings: new Map([
          ['x', typeInfo('number')],
          ['y', typeInfo('string')],
        ]),
      });
      const result = analyzeStatically(binary(ident('x'), '==', ident('y')), ctx);
      expect(result.verdict).toBe('false');
      expect(result.category).toBe('type-mismatch');
    });

    it('boolean == number → false', () => {
      const ctx = createTypeContext({
        bindings: new Map([
          ['flag', typeInfo('boolean')],
          ['count', typeInfo('integer')],
        ]),
      });
      const result = analyzeStatically(binary(ident('flag'), '==', ident('count')), ctx);
      expect(result.verdict).toBe('false');
      expect(result.category).toBe('type-mismatch');
    });
  });

  describe('Range analysis', () => {
    it('Age > 200 when max is 150 → false', () => {
      const ctx = createTypeContext({
        bindings: new Map([['age', typeInfo('integer', { min: 0, max: 150 })]]),
      });
      const result = analyzeStatically(binary(ident('age'), '>', numLit(200)), ctx);
      expect(result.verdict).toBe('false');
      expect(result.category).toBe('range-analysis');
    });

    it('Age < 0 when min is 0 → false', () => {
      const ctx = createTypeContext({
        bindings: new Map([['age', typeInfo('integer', { min: 0, max: 150 })]]),
      });
      const result = analyzeStatically(binary(ident('age'), '<', numLit(0)), ctx);
      expect(result.verdict).toBe('false');
      expect(result.category).toBe('range-analysis');
    });

    it('non-overlapping ranges with == → false', () => {
      const ctx = createTypeContext({
        bindings: new Map([
          ['x', typeInfo('integer', { min: 10, max: 20 })],
          ['y', typeInfo('integer', { min: 30, max: 40 })],
        ]),
      });
      const result = analyzeStatically(binary(ident('x'), '==', ident('y')), ctx);
      expect(result.verdict).toBe('false');
      expect(result.category).toBe('range-analysis');
    });
  });

  describe('Field existence', () => {
    it('undeclared field on entity → false', () => {
      const userEntity = entityInfo('User', [
        fieldInfo('email', typeInfo('string'), true),
      ]);
      const ctx = createTypeContext({
        resultEntity: userEntity,
      });
      const result = analyzeStatically(resultExpr('nonexistent_field'), ctx);
      expect(result.verdict).toBe('false');
      expect(result.category).toBe('field-existence');
    });
  });

  describe('Logical simplification', () => {
    it('false and X → false (short-circuit)', () => {
      const result = analyzeStatically(binary(boolLit(false), 'and', ident('unknown_var')), createTypeContext());
      expect(result.verdict).toBe('false');
    });

    it('false or false → false', () => {
      const result = analyzeStatically(binary(boolLit(false), 'or', boolLit(false)), createTypeContext());
      expect(result.verdict).toBe('false');
    });

    it('true implies false → false', () => {
      const result = analyzeStatically(binary(boolLit(true), 'implies', boolLit(false)), createTypeContext());
      expect(result.verdict).toBe('false');
    });

    it('not true → false', () => {
      const result = analyzeStatically(unary('not', boolLit(true)), createTypeContext());
      expect(result.verdict).toBe('false');
    });
  });

  describe('Quantifier over empty collection', () => {
    it('any over empty list → false', () => {
      const result = analyzeStatically(
        quantifier('any', 'x', listExpr([]), binary(ident('x'), '>', numLit(0))),
        createTypeContext()
      );
      expect(result.verdict).toBe('false');
    });
  });

  describe('Enum analysis', () => {
    it('enum var == value not in enum → false', () => {
      const ctx = createTypeContext({
        bindings: new Map([
          ['status', typeInfo('string', { enumValues: ['active', 'suspended', 'banned'] })],
        ]),
      });
      const result = analyzeStatically(binary(ident('status'), '==', strLit('deleted')), ctx);
      expect(result.verdict).toBe('false');
      expect(result.category).toBe('enum-analysis');
    });
  });

  describe('Membership in literal list', () => {
    it('5 in [1, 2, 3] → false', () => {
      const result = analyzeStatically(
        binary(numLit(5), 'in', listExpr([numLit(1), numLit(2), numLit(3)])),
        createTypeContext()
      );
      expect(result.verdict).toBe('false');
    });
  });

  describe('Biconditional (iff)', () => {
    it('true iff false → false', () => {
      const result = analyzeStatically(binary(boolLit(true), 'iff', boolLit(false)), createTypeContext());
      expect(result.verdict).toBe('false');
    });
  });
});

// ============================================================================
// TEST: UNKNOWN Cases (Needs Runtime)
// ============================================================================

describe('Static Analyzer - Unknown (Runtime Required)', () => {
  describe('Runtime-dependent expressions', () => {
    it('identifier with no type info → unknown', () => {
      const result = analyzeStatically(ident('x'), createTypeContext());
      expect(result.verdict).toBe('unknown');
    });

    it('identifier with type info but no value → unknown', () => {
      const ctx = createTypeContext({
        bindings: new Map([['x', typeInfo('number')]]),
      });
      const result = analyzeStatically(ident('x'), ctx);
      expect(result.verdict).toBe('unknown');
    });
  });

  describe('Function calls requiring runtime', () => {
    it('exists() → unknown (needs data store)', () => {
      const result = analyzeStatically(call(ident('exists'), [strLit('User')]), createTypeContext());
      expect(result.verdict).toBe('unknown');
    });

    it('lookup() → unknown (needs data store)', () => {
      const result = analyzeStatically(call(ident('lookup'), [strLit('User')]), createTypeContext());
      expect(result.verdict).toBe('unknown');
    });

    it('now() → unknown (non-deterministic)', () => {
      const result = analyzeStatically(call(ident('now'), []), createTypeContext());
      expect(result.verdict).toBe('unknown');
    });
  });

  describe('Quantifiers over runtime collections', () => {
    it('forall(users, u => u.active) → unknown', () => {
      const result = analyzeStatically(
        quantifier('all', 'u', ident('users'), member(ident('u'), 'active')),
        createTypeContext()
      );
      expect(result.verdict).toBe('unknown');
    });

    it('any(items, i => i.ready) → unknown', () => {
      const result = analyzeStatically(
        quantifier('any', 'i', ident('items'), member(ident('i'), 'ready')),
        createTypeContext()
      );
      expect(result.verdict).toBe('unknown');
    });
  });

  describe('old() expressions', () => {
    it('old(balance) → unknown (needs runtime state)', () => {
      const result = analyzeStatically(oldExpr(ident('balance')), createTypeContext());
      expect(result.verdict).toBe('unknown');
    });
  });

  describe('Result/Input without type info', () => {
    it('result (bare) → unknown', () => {
      const result = analyzeStatically(resultExpr(), createTypeContext());
      expect(result.verdict).toBe('unknown');
    });

    it('result.field without entity info → unknown', () => {
      const result = analyzeStatically(resultExpr('field'), createTypeContext());
      expect(result.verdict).toBe('unknown');
    });

    it('input.param → unknown', () => {
      const result = analyzeStatically(inputExpr('email'), createTypeContext());
      expect(result.verdict).toBe('unknown');
    });
  });

  describe('Comparison without enough type info', () => {
    it('x > 5 without type constraints → unknown', () => {
      const result = analyzeStatically(binary(ident('x'), '>', numLit(5)), createTypeContext());
      expect(result.verdict).toBe('unknown');
    });

    it('overlapping ranges → unknown', () => {
      const ctx = createTypeContext({
        bindings: new Map([
          ['x', typeInfo('integer', { min: 0, max: 100 })],
        ]),
      });
      // x > 50 where x ∈ [0, 100] — can't determine statically
      const result = analyzeStatically(binary(ident('x'), '>', numLit(50)), ctx);
      expect(result.verdict).toBe('unknown');
    });
  });

  describe('Optional field access', () => {
    it('optional field on entity → unknown', () => {
      const userEntity = entityInfo('User', [
        fieldInfo('email', typeInfo('string'), true),
        fieldInfo('nickname', typeInfo('string'), false),
      ]);
      const ctx = createTypeContext({ resultEntity: userEntity });
      const result = analyzeStatically(resultExpr('nickname'), ctx);
      expect(result.verdict).toBe('unknown');
    });
  });

  describe('Mixed known/unknown in logic', () => {
    it('true and unknown_var → unknown', () => {
      const result = analyzeStatically(binary(boolLit(true), 'and', ident('x')), createTypeContext());
      expect(result.verdict).toBe('unknown');
    });

    it('false or unknown_var → unknown', () => {
      const result = analyzeStatically(binary(boolLit(false), 'or', ident('x')), createTypeContext());
      expect(result.verdict).toBe('unknown');
    });
  });

  describe('Index expressions', () => {
    it('array[0] → unknown', () => {
      const result = analyzeStatically(indexExpr(ident('arr'), numLit(0)), createTypeContext());
      expect(result.verdict).toBe('unknown');
    });
  });

  describe('Conditional with unknown condition', () => {
    it('unknown ? X : Y with different branches → unknown', () => {
      const result = analyzeStatically(
        conditional(ident('x'), boolLit(true), boolLit(false)),
        createTypeContext()
      );
      expect(result.verdict).toBe('unknown');
    });
  });
});

// ============================================================================
// TEST: Batch Analysis & Summary
// ============================================================================

describe('Static Analyzer - Batch Operations', () => {
  it('analyzeAll processes multiple expressions', () => {
    const exprs = [
      boolLit(true),
      boolLit(false),
      ident('unknown_var'),
    ];
    const results = analyzeAll(exprs, createTypeContext());
    expect(results).toHaveLength(3);
    expect(results[0].verdict).toBe('true');
    expect(results[1].verdict).toBe('false');
    expect(results[2].verdict).toBe('unknown');
  });

  it('summarizeResults provides correct counts', () => {
    const results: StaticAnalysisResult[] = [
      { expression: 'true', verdict: 'true', reason: 'literal', confidence: 1.0 },
      { expression: 'true', verdict: 'true', reason: 'literal', confidence: 1.0 },
      { expression: 'false', verdict: 'false', reason: 'literal', confidence: 1.0 },
      { expression: 'x', verdict: 'unknown', reason: 'unknown', confidence: 0 },
    ];
    const summary = summarizeResults(results);
    expect(summary.total).toBe(4);
    expect(summary.provablyTrue).toBe(2);
    expect(summary.provablyFalse).toBe(1);
    expect(summary.unknown).toBe(1);
    expect(summary.needsRuntime).toBe(true);
  });

  it('needsRuntime is false when all are resolved', () => {
    const results: StaticAnalysisResult[] = [
      { expression: 'true', verdict: 'true', reason: 'literal', confidence: 1.0 },
      { expression: 'false', verdict: 'false', reason: 'literal', confidence: 1.0 },
    ];
    const summary = summarizeResults(results);
    expect(summary.needsRuntime).toBe(false);
  });
});

// ============================================================================
// TEST: Type-Constraint Propagation (Advanced)
// ============================================================================

describe('Static Analyzer - Type-Constraint Propagation', () => {
  it('Email type with min_length satisfies length > 0 postcondition', () => {
    // ISL: type Email = String { min_length: 1 }
    // Postcondition: result.email.length > 0
    const emailType = typeInfo('string', { minLength: 1 });
    const userEntity = entityInfo('User', [
      fieldInfo('email', emailType, true),
    ]);
    const ctx = createTypeContext({ resultEntity: userEntity });

    const expr = binary(member(resultExpr('email'), 'length'), '>', numLit(0));
    const result = analyzeStatically(expr, ctx);

    expect(result.verdict).toBe('true');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('Percentage type with min/max satisfies range check', () => {
    // ISL: type Percentage = Float { min: 0.0, max: 100.0 }
    // Postcondition: result.score >= 0 and result.score <= 100
    const percentType = typeInfo('float', { min: 0, max: 100 });
    const resultEntity = entityInfo('Result', [
      fieldInfo('score', percentType, true),
    ]);
    const ctx = createTypeContext({ resultEntity });

    const geZero = binary(resultExpr('score'), '>=', numLit(0));
    const leHundred = binary(resultExpr('score'), '<=', numLit(100));
    const combined = binary(geZero, 'and', leHundred);

    const result = analyzeStatically(combined, ctx);
    expect(result.verdict).toBe('true');
  });

  it('Count type with min:0 satisfies >= 0 check', () => {
    const countType = typeInfo('integer', { min: 0 });
    const ctx = createTypeContext({
      bindings: new Map([['count', countType]]),
    });

    const expr = binary(ident('count'), '>=', numLit(0));
    const result = analyzeStatically(expr, ctx);
    expect(result.verdict).toBe('true');
    expect(result.category).toBe('range-analysis');
  });

  it('Status enum excludes impossible value', () => {
    // ISL: type Status = String { enum: ["active", "suspended", "banned"] }
    const statusType = typeInfo('string', { enumValues: ['active', 'suspended', 'banned'] });
    const ctx = createTypeContext({
      bindings: new Map([['status', statusType]]),
    });

    // status == "deleted" should be false (not in enum)
    const result = analyzeStatically(binary(ident('status'), '==', strLit('deleted')), ctx);
    expect(result.verdict).toBe('false');
    expect(result.category).toBe('enum-analysis');
  });
});

// ============================================================================
// TEST: Edge Cases & Confidence
// ============================================================================

describe('Static Analyzer - Edge Cases', () => {
  it('confidence is clamped to [0, 1]', () => {
    const result = analyzeStatically(boolLit(true), createTypeContext());
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('expression string is populated', () => {
    const result = analyzeStatically(binary(numLit(5), '>', numLit(3)), createTypeContext());
    expect(result.expression).toContain('5');
    expect(result.expression).toContain('>');
    expect(result.expression).toContain('3');
  });

  it('reason is non-empty for all verdicts', () => {
    const results = [
      analyzeStatically(boolLit(true), createTypeContext()),
      analyzeStatically(boolLit(false), createTypeContext()),
      analyzeStatically(ident('x'), createTypeContext()),
    ];
    for (const r of results) {
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it('null comparison is compatible with any type', () => {
    // null == something should not be a type mismatch
    const ctx = createTypeContext({
      bindings: new Map([['x', typeInfo('string')]]),
    });
    // The analyzer should not flag this as type-mismatch since null is compatible
    const result = analyzeStatically(binary(ident('x'), '==', nullLit()), ctx);
    // It's unknown because we don't know x's value, but it should not be "false" from type mismatch
    expect(result.verdict).not.toBe('false');
  });

  it('deeply nested expression analysis', () => {
    // ((true and true) or false) and (not false)
    const inner1 = binary(boolLit(true), 'and', boolLit(true));
    const inner2 = binary(inner1, 'or', boolLit(false));
    const inner3 = unary('not', boolLit(false));
    const combined = binary(inner2, 'and', inner3);

    const result = analyzeStatically(combined, createTypeContext());
    expect(result.verdict).toBe('true');
  });
});
