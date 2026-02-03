// ============================================================================
// Expression Evaluator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import type * as AST from '@isl-lang/parser';
import {
  evaluateExpression,
  type EvaluationContext,
  type ExpressionAdapter,
  DefaultAdapter,
  type TriState,
  triStateAnd,
  triStateOr,
  triStateNot,
  triStateImplies,
} from '../src/evaluator.js';
import type { EntityStore } from '../src/types.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createLocation(
  line: number = 1,
  column: number = 1,
  endLine: number = 1,
  endColumn: number = 1
): AST.SourceLocation {
  return {
    file: 'test.isl',
    line,
    column,
    endLine,
    endColumn,
  };
}

function createContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  const mockStore: EntityStore = {
    getAll: () => [],
    exists: () => false,
    lookup: () => undefined,
    count: () => 0,
    create: () => ({ __entity__: 'Test', __id__: '1', name: 'test' }),
    update: () => {},
    delete: () => {},
    snapshot: () => ({ entities: new Map(), timestamp: Date.now() }),
    restore: () => {},
  };

  return {
    input: {},
    result: undefined,
    error: undefined,
    store: mockStore,
    oldState: undefined,
    domain: {
      kind: 'Domain',
      name: { kind: 'Identifier', name: 'Test', location: createLocation() },
      version: { kind: 'StringLiteral', value: '1.0.0', location: createLocation() },
      imports: [],
      types: [],
      entities: [],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      location: createLocation(),
    },
    now: new Date(),
    variables: new Map(),
    ...overrides,
  };
}

function createStringLiteral(value: string): AST.StringLiteral {
  return {
    kind: 'StringLiteral',
    value,
    location: createLocation(),
  };
}

function createNumberLiteral(value: number): AST.NumberLiteral {
  return {
    kind: 'NumberLiteral',
    value,
    isFloat: false,
    location: createLocation(),
  };
}

function createBooleanLiteral(value: boolean): AST.BooleanLiteral {
  return {
    kind: 'BooleanLiteral',
    value,
    location: createLocation(),
  };
}

function createNullLiteral(): AST.NullLiteral {
  return {
    kind: 'NullLiteral',
    location: createLocation(),
  };
}

function createIdentifier(name: string): AST.Identifier {
  return {
    kind: 'Identifier',
    name,
    location: createLocation(),
  };
}

function createBinaryExpr(
  operator: AST.BinaryOperator,
  left: AST.Expression,
  right: AST.Expression
): AST.BinaryExpr {
  return {
    kind: 'BinaryExpr',
    operator,
    left,
    right,
    location: createLocation(),
  };
}

function createUnaryExpr(operator: AST.UnaryOperator, operand: AST.Expression): AST.UnaryExpr {
  return {
    kind: 'UnaryExpr',
    operator,
    operand,
    location: createLocation(),
  };
}

function createMemberExpr(object: AST.Expression, property: string): AST.MemberExpr {
  return {
    kind: 'MemberExpr',
    object,
    property: createIdentifier(property),
    location: createLocation(),
  };
}

function createCallExpr(callee: AST.Expression, args: AST.Expression[]): AST.CallExpr {
  return {
    kind: 'CallExpr',
    callee,
    arguments: args,
    location: createLocation(),
  };
}

function createQuantifierExpr(
  quantifier: 'all' | 'any',
  variable: string,
  collection: AST.Expression,
  predicate: AST.Expression
): AST.QuantifierExpr {
  return {
    kind: 'QuantifierExpr',
    quantifier,
    variable: createIdentifier(variable),
    collection,
    predicate,
    location: createLocation(),
  };
}

function createListExpr(elements: AST.Expression[]): AST.ListExpr {
  return {
    kind: 'ListExpr',
    elements,
    location: createLocation(),
  };
}

function createIndexExpr(object: AST.Expression, index: AST.Expression): AST.IndexExpr {
  return {
    kind: 'IndexExpr',
    object,
    index,
    location: createLocation(),
  };
}

function createConditionalExpr(
  condition: AST.Expression,
  thenBranch: AST.Expression,
  elseBranch: AST.Expression
): AST.ConditionalExpr {
  return {
    kind: 'ConditionalExpr',
    condition,
    thenBranch,
    elseBranch,
    location: createLocation(),
  };
}

// ============================================================================
// TRI-STATE LOGIC TESTS
// ============================================================================

describe('Tri-state logic', () => {
  it('should handle AND operations', () => {
    expect(triStateAnd(true, true)).toBe(true);
    expect(triStateAnd(true, false)).toBe(false);
    expect(triStateAnd(false, true)).toBe(false);
    expect(triStateAnd(false, false)).toBe(false);
    expect(triStateAnd(true, 'unknown')).toBe('unknown');
    expect(triStateAnd('unknown', true)).toBe('unknown');
    expect(triStateAnd(false, 'unknown')).toBe(false);
    expect(triStateAnd('unknown', false)).toBe(false);
    expect(triStateAnd('unknown', 'unknown')).toBe('unknown');
  });

  it('should handle OR operations', () => {
    expect(triStateOr(true, true)).toBe(true);
    expect(triStateOr(true, false)).toBe(true);
    expect(triStateOr(false, true)).toBe(true);
    expect(triStateOr(false, false)).toBe(false);
    expect(triStateOr(true, 'unknown')).toBe(true);
    expect(triStateOr('unknown', true)).toBe(true);
    expect(triStateOr(false, 'unknown')).toBe('unknown');
    expect(triStateOr('unknown', false)).toBe('unknown');
    expect(triStateOr('unknown', 'unknown')).toBe('unknown');
  });

  it('should handle NOT operations', () => {
    expect(triStateNot(true)).toBe(false);
    expect(triStateNot(false)).toBe(true);
    expect(triStateNot('unknown')).toBe('unknown');
  });

  it('should handle IMPLIES operations', () => {
    expect(triStateImplies(false, true)).toBe(true);
    expect(triStateImplies(false, false)).toBe(true);
    expect(triStateImplies(false, 'unknown')).toBe(true);
    expect(triStateImplies(true, true)).toBe(true);
    expect(triStateImplies(true, false)).toBe(false);
    expect(triStateImplies(true, 'unknown')).toBe('unknown');
    expect(triStateImplies('unknown', true)).toBe('unknown');
    expect(triStateImplies('unknown', false)).toBe('unknown');
    expect(triStateImplies('unknown', 'unknown')).toBe('unknown');
  });
});

// ============================================================================
// LITERAL TESTS
// ============================================================================

describe('Literals', () => {
  it('should evaluate string literals', () => {
    const expr = createStringLiteral('hello');
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should evaluate number literals', () => {
    const expr = createNumberLiteral(42);
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should evaluate boolean literals', () => {
    const trueExpr = createBooleanLiteral(true);
    const falseExpr = createBooleanLiteral(false);
    
    expect(evaluateExpression(trueExpr, createContext()).value).toBe(true);
    expect(evaluateExpression(falseExpr, createContext()).value).toBe(false);
  });

  it('should evaluate null literals', () => {
    const expr = createNullLiteral();
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(false);
  });
});

// ============================================================================
// COMPARISON OPERATOR TESTS
// ============================================================================

describe('Comparison operators', () => {
  it('should evaluate == operator', () => {
    const expr1 = createBinaryExpr('==', createNumberLiteral(5), createNumberLiteral(5));
    const expr2 = createBinaryExpr('==', createNumberLiteral(5), createNumberLiteral(10));
    const expr3 = createBinaryExpr('==', createStringLiteral('hello'), createStringLiteral('hello'));
    const expr4 = createBinaryExpr('==', createStringLiteral('hello'), createStringLiteral('world'));
    
    expect(evaluateExpression(expr1, createContext()).value).toBe(true);
    expect(evaluateExpression(expr2, createContext()).value).toBe(false);
    expect(evaluateExpression(expr3, createContext()).value).toBe(true);
    expect(evaluateExpression(expr4, createContext()).value).toBe(false);
  });

  it('should evaluate != operator', () => {
    const expr1 = createBinaryExpr('!=', createNumberLiteral(5), createNumberLiteral(5));
    const expr2 = createBinaryExpr('!=', createNumberLiteral(5), createNumberLiteral(10));
    
    expect(evaluateExpression(expr1, createContext()).value).toBe(false);
    expect(evaluateExpression(expr2, createContext()).value).toBe(true);
  });

  it('should evaluate < operator', () => {
    const expr1 = createBinaryExpr('<', createNumberLiteral(5), createNumberLiteral(10));
    const expr2 = createBinaryExpr('<', createNumberLiteral(10), createNumberLiteral(5));
    const expr3 = createBinaryExpr('<', createNumberLiteral(5), createNumberLiteral(5));
    
    expect(evaluateExpression(expr1, createContext()).value).toBe(true);
    expect(evaluateExpression(expr2, createContext()).value).toBe(false);
    expect(evaluateExpression(expr3, createContext()).value).toBe(false);
  });

  it('should evaluate <= operator', () => {
    const expr1 = createBinaryExpr('<=', createNumberLiteral(5), createNumberLiteral(10));
    const expr2 = createBinaryExpr('<=', createNumberLiteral(5), createNumberLiteral(5));
    const expr3 = createBinaryExpr('<=', createNumberLiteral(10), createNumberLiteral(5));
    
    expect(evaluateExpression(expr1, createContext()).value).toBe(true);
    expect(evaluateExpression(expr2, createContext()).value).toBe(true);
    expect(evaluateExpression(expr3, createContext()).value).toBe(false);
  });

  it('should evaluate > operator', () => {
    const expr1 = createBinaryExpr('>', createNumberLiteral(10), createNumberLiteral(5));
    const expr2 = createBinaryExpr('>', createNumberLiteral(5), createNumberLiteral(10));
    const expr3 = createBinaryExpr('>', createNumberLiteral(5), createNumberLiteral(5));
    
    expect(evaluateExpression(expr1, createContext()).value).toBe(true);
    expect(evaluateExpression(expr2, createContext()).value).toBe(false);
    expect(evaluateExpression(expr3, createContext()).value).toBe(false);
  });

  it('should evaluate >= operator', () => {
    const expr1 = createBinaryExpr('>=', createNumberLiteral(10), createNumberLiteral(5));
    const expr2 = createBinaryExpr('>=', createNumberLiteral(5), createNumberLiteral(5));
    const expr3 = createBinaryExpr('>=', createNumberLiteral(5), createNumberLiteral(10));
    
    expect(evaluateExpression(expr1, createContext()).value).toBe(true);
    expect(evaluateExpression(expr2, createContext()).value).toBe(true);
    expect(evaluateExpression(expr3, createContext()).value).toBe(false);
  });
});

// ============================================================================
// LOGICAL OPERATOR TESTS
// ============================================================================

describe('Logical operators', () => {
  it('should evaluate && operator with short-circuit', () => {
    const expr1 = createBinaryExpr('and', createBooleanLiteral(true), createBooleanLiteral(true));
    const expr2 = createBinaryExpr('and', createBooleanLiteral(true), createBooleanLiteral(false));
    const expr3 = createBinaryExpr('and', createBooleanLiteral(false), createBooleanLiteral(true));
    const expr4 = createBinaryExpr('and', createBooleanLiteral(false), createBooleanLiteral(false));
    
    expect(evaluateExpression(expr1, createContext()).value).toBe(true);
    expect(evaluateExpression(expr2, createContext()).value).toBe(false);
    expect(evaluateExpression(expr3, createContext()).value).toBe(false);
    expect(evaluateExpression(expr4, createContext()).value).toBe(false);
  });

  it('should evaluate || operator with short-circuit', () => {
    const expr1 = createBinaryExpr('or', createBooleanLiteral(true), createBooleanLiteral(true));
    const expr2 = createBinaryExpr('or', createBooleanLiteral(true), createBooleanLiteral(false));
    const expr3 = createBinaryExpr('or', createBooleanLiteral(false), createBooleanLiteral(true));
    const expr4 = createBinaryExpr('or', createBooleanLiteral(false), createBooleanLiteral(false));
    
    expect(evaluateExpression(expr1, createContext()).value).toBe(true);
    expect(evaluateExpression(expr2, createContext()).value).toBe(true);
    expect(evaluateExpression(expr3, createContext()).value).toBe(true);
    expect(evaluateExpression(expr4, createContext()).value).toBe(false);
  });

  it('should evaluate ! operator', () => {
    const expr1 = createUnaryExpr('not', createBooleanLiteral(true));
    const expr2 = createUnaryExpr('not', createBooleanLiteral(false));
    
    expect(evaluateExpression(expr1, createContext()).value).toBe(false);
    expect(evaluateExpression(expr2, createContext()).value).toBe(true);
  });

  it('should evaluate implies operator', () => {
    const expr1 = createBinaryExpr('implies', createBooleanLiteral(false), createBooleanLiteral(true));
    const expr2 = createBinaryExpr('implies', createBooleanLiteral(false), createBooleanLiteral(false));
    const expr3 = createBinaryExpr('implies', createBooleanLiteral(true), createBooleanLiteral(true));
    const expr4 = createBinaryExpr('implies', createBooleanLiteral(true), createBooleanLiteral(false));
    
    expect(evaluateExpression(expr1, createContext()).value).toBe(true);
    expect(evaluateExpression(expr2, createContext()).value).toBe(true);
    expect(evaluateExpression(expr3, createContext()).value).toBe(true);
    expect(evaluateExpression(expr4, createContext()).value).toBe(false);
  });
});

// ============================================================================
// PRECEDENCE TESTS
// ============================================================================

describe('Operator precedence', () => {
  it('should respect && precedence over ||', () => {
    // true || false && false should be true (not false)
    const left = createBooleanLiteral(true);
    const middle = createBooleanLiteral(false);
    const right = createBooleanLiteral(false);
    const andExpr = createBinaryExpr('and', middle, right);
    const orExpr = createBinaryExpr('or', left, andExpr);
    
    expect(evaluateExpression(orExpr, createContext()).value).toBe(true);
  });

  it('should respect comparison precedence over logical', () => {
    // 5 < 10 && 10 > 5 should be true
    const comp1 = createBinaryExpr('<', createNumberLiteral(5), createNumberLiteral(10));
    const comp2 = createBinaryExpr('>', createNumberLiteral(10), createNumberLiteral(5));
    const andExpr = createBinaryExpr('and', comp1, comp2);
    
    expect(evaluateExpression(andExpr, createContext()).value).toBe(true);
  });
});

// ============================================================================
// PROPERTY ACCESS TESTS
// ============================================================================

describe('Property access', () => {
  it('should evaluate member expressions', () => {
    const context = createContext({
      input: { user: { name: 'Alice', age: 30 } },
    });
    
    const inputExpr = createIdentifier('input');
    const userExpr = createMemberExpr(inputExpr, 'user');
    const nameExpr = createMemberExpr(userExpr, 'name');
    
    const result = evaluateExpression(nameExpr, context);
    expect(result.value).toBe(true);
  });

  it('should handle nested property access', () => {
    const context = createContext({
      input: { user: { profile: { email: 'alice@example.com' } } },
    });
    
    const inputExpr = createIdentifier('input');
    const userExpr = createMemberExpr(inputExpr, 'user');
    const profileExpr = createMemberExpr(userExpr, 'profile');
    const emailExpr = createMemberExpr(profileExpr, 'email');
    
    const result = evaluateExpression(emailExpr, context);
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// FUNCTION CALL TESTS
// ============================================================================

describe('Function calls', () => {
  it('should evaluate is_valid on strings', () => {
    const adapter = new DefaultAdapter();
    const context = createContext();
    
    const strExpr = createStringLiteral('hello');
    const memberExpr = createMemberExpr(strExpr, 'is_valid');
    const callExpr = createCallExpr(memberExpr, []);
    
    const result = evaluateExpression(callExpr, context, { adapter });
    expect(result.value).toBe(true);
  });

  it('should evaluate length on strings', () => {
    const adapter = new DefaultAdapter();
    const context = createContext();
    
    const strExpr = createStringLiteral('hello');
    const memberExpr = createMemberExpr(strExpr, 'length');
    const callExpr = createCallExpr(memberExpr, []);
    
    const result = evaluateExpression(callExpr, context, { adapter });
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// QUANTIFIER TESTS
// ============================================================================

describe('Quantifiers', () => {
  it('should evaluate all() on empty array', () => {
    const collection = createListExpr([]);
    const predicate = createBooleanLiteral(true);
    const expr = createQuantifierExpr('all', 'x', collection, predicate);
    
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true); // all([]) = true
  });

  it('should evaluate any() on empty array', () => {
    const collection = createListExpr([]);
    const predicate = createBooleanLiteral(true);
    const expr = createQuantifierExpr('any', 'x', collection, predicate);
    
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(false); // any([]) = false
  });

  it('should evaluate all() on non-empty array', () => {
    const collection = createListExpr([
      createBooleanLiteral(true),
      createBooleanLiteral(true),
    ]);
    const predicate = createBooleanLiteral(true);
    const expr = createQuantifierExpr('all', 'x', collection, predicate);
    
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should evaluate any() on non-empty array', () => {
    const collection = createListExpr([
      createBooleanLiteral(false),
      createBooleanLiteral(true),
    ]);
    const predicate = createBooleanLiteral(true);
    const expr = createQuantifierExpr('any', 'x', collection, predicate);
    
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// LIST EXPRESSION TESTS
// ============================================================================

describe('List expressions', () => {
  it('should evaluate empty list', () => {
    const expr = createListExpr([]);
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should evaluate list with elements', () => {
    const expr = createListExpr([
      createNumberLiteral(1),
      createNumberLiteral(2),
      createNumberLiteral(3),
    ]);
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// INDEX EXPRESSION TESTS
// ============================================================================

describe('Index expressions', () => {
  it('should evaluate array index access', () => {
    const context = createContext({
      input: { items: [10, 20, 30] },
    });
    
    const inputExpr = createIdentifier('input');
    const itemsExpr = createMemberExpr(inputExpr, 'items');
    const indexExpr = createIndexExpr(itemsExpr, createNumberLiteral(0));
    
    const result = evaluateExpression(indexExpr, context);
    expect(result.value).toBe(true);
  });

  it('should handle out-of-bounds index', () => {
    const context = createContext({
      input: { items: [10, 20] },
    });
    
    const inputExpr = createIdentifier('input');
    const itemsExpr = createMemberExpr(inputExpr, 'items');
    const indexExpr = createIndexExpr(itemsExpr, createNumberLiteral(10));
    
    const result = evaluateExpression(indexExpr, context);
    expect(result.value).toBe(false);
  });
});

// ============================================================================
// CONDITIONAL EXPRESSION TESTS
// ============================================================================

describe('Conditional expressions', () => {
  it('should evaluate ternary with true condition', () => {
    const condition = createBooleanLiteral(true);
    const thenBranch = createNumberLiteral(10);
    const elseBranch = createNumberLiteral(20);
    const expr = createConditionalExpr(condition, thenBranch, elseBranch);
    
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should evaluate ternary with false condition', () => {
    const condition = createBooleanLiteral(false);
    const thenBranch = createNumberLiteral(10);
    const elseBranch = createNumberLiteral(20);
    const expr = createConditionalExpr(condition, thenBranch, elseBranch);
    
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge cases', () => {
  it('should handle null comparisons', () => {
    const expr1 = createBinaryExpr('==', createNullLiteral(), createNullLiteral());
    const expr2 = createBinaryExpr('==', createNullLiteral(), createStringLiteral('test'));
    
    expect(evaluateExpression(expr1, createContext()).value).toBe(true);
    expect(evaluateExpression(expr2, createContext()).value).toBe(false);
  });

  it('should handle unknown values', () => {
    const context = createContext({
      input: { value: null },
    });
    
    const inputExpr = createIdentifier('input');
    const valueExpr = createMemberExpr(inputExpr, 'value');
    const unknownExpr = createMemberExpr(valueExpr, 'property');
    
    const result = evaluateExpression(unknownExpr, context);
    expect(result.value).toBe('unknown');
  });

  it('should handle deep nesting', () => {
    const context = createContext({
      input: { a: { b: { c: { d: { e: 'value' } } } } },
    });
    
    const inputExpr = createIdentifier('input');
    const aExpr = createMemberExpr(inputExpr, 'a');
    const bExpr = createMemberExpr(aExpr, 'b');
    const cExpr = createMemberExpr(bExpr, 'c');
    const dExpr = createMemberExpr(cExpr, 'd');
    const eExpr = createMemberExpr(dExpr, 'e');
    
    const result = evaluateExpression(eExpr, context);
    expect(result.value).toBe(true);
  });

  it('should handle complex expressions', () => {
    // (5 < 10) && (20 > 15) || (false)
    const comp1 = createBinaryExpr('<', createNumberLiteral(5), createNumberLiteral(10));
    const comp2 = createBinaryExpr('>', createNumberLiteral(20), createNumberLiteral(15));
    const andExpr = createBinaryExpr('and', comp1, comp2);
    const orExpr = createBinaryExpr('or', andExpr, createBooleanLiteral(false));
    
    const result = evaluateExpression(orExpr, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle chained comparisons', () => {
    // 5 < 10 < 20 (as (5 < 10) && (10 < 20))
    const comp1 = createBinaryExpr('<', createNumberLiteral(5), createNumberLiteral(10));
    const comp2 = createBinaryExpr('<', createNumberLiteral(10), createNumberLiteral(20));
    const andExpr = createBinaryExpr('and', comp1, comp2);
    
    const result = evaluateExpression(andExpr, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle negation of comparisons', () => {
    // !(5 == 10)
    const eqExpr = createBinaryExpr('==', createNumberLiteral(5), createNumberLiteral(10));
    const notExpr = createUnaryExpr('not', eqExpr);
    
    const result = evaluateExpression(notExpr, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle multiple logical operators', () => {
    // true && false || true
    const andExpr = createBinaryExpr('and', createBooleanLiteral(true), createBooleanLiteral(false));
    const orExpr = createBinaryExpr('or', andExpr, createBooleanLiteral(true));
    
    const result = evaluateExpression(orExpr, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle nested implications', () => {
    // (false implies true) implies true
    const inner = createBinaryExpr('implies', createBooleanLiteral(false), createBooleanLiteral(true));
    const outer = createBinaryExpr('implies', inner, createBooleanLiteral(true));
    
    const result = evaluateExpression(outer, createContext());
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// DIAGNOSTICS TESTS
// ============================================================================

describe('Diagnostics', () => {
  it('should include source location in results', () => {
    const expr = createBooleanLiteral(true);
    const result = evaluateExpression(expr, createContext());
    
    expect(result.location).toBeDefined();
    expect(result.location.file).toBe('test.isl');
  });

  it('should include failure reasons', () => {
    const expr = createBinaryExpr('==', createNumberLiteral(5), createNumberLiteral(10));
    const result = evaluateExpression(expr, createContext());
    
    expect(result.value).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain('not equal');
  });

  it('should include nested results for compound expressions', () => {
    const left = createBooleanLiteral(true);
    const right = createBooleanLiteral(false);
    const expr = createBinaryExpr('and', left, right);
    
    const result = evaluateExpression(expr, createContext());
    
    expect(result.children).toBeDefined();
    expect(result.children?.length).toBe(2);
  });
});

// ============================================================================
// ADAPTER TESTS
// ============================================================================

describe('Adapter interface', () => {
  it('should use default adapter when none provided', () => {
    const expr = createStringLiteral('test');
    const memberExpr = createMemberExpr(expr, 'is_valid');
    const callExpr = createCallExpr(memberExpr, []);
    
    const result = evaluateExpression(callExpr, createContext());
    expect(result.value).toBe(true);
  });

  it('should use custom adapter when provided', () => {
    const customAdapter: ExpressionAdapter = {
      is_valid: (value) => {
        if (typeof value === 'string') {
          return value.length > 5;
        }
        return false;
      },
    };
    
    const shortStr = createStringLiteral('hi');
    const longStr = createStringLiteral('hello world');
    
    const shortMember = createMemberExpr(shortStr, 'is_valid');
    const longMember = createMemberExpr(longStr, 'is_valid');
    
    const shortCall = createCallExpr(shortMember, []);
    const longCall = createCallExpr(longMember, []);
    
    const shortResult = evaluateExpression(shortCall, createContext(), { adapter: customAdapter });
    const longResult = evaluateExpression(longCall, createContext(), { adapter: customAdapter });
    
    expect(shortResult.value).toBe(false);
    expect(longResult.value).toBe(true);
  });
});
