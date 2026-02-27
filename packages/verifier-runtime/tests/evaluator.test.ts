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

// ============================================================================
// ARITHMETIC OPERATOR TESTS
// ============================================================================

describe('Arithmetic operators', () => {
  describe('Addition (+)', () => {
    it('should add two numbers', () => {
      const expr = createBinaryExpr('+', createNumberLiteral(3), createNumberLiteral(4));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should add negative numbers', () => {
      const expr = createBinaryExpr('+', createNumberLiteral(-5), createNumberLiteral(3));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should add zero', () => {
      const expr = createBinaryExpr('+', createNumberLiteral(0), createNumberLiteral(0));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should add floating point numbers', () => {
      const expr = createBinaryExpr('+', createNumberLiteral(1.5), createNumberLiteral(2.3));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should concatenate strings with +', () => {
      const expr = createBinaryExpr('+', createStringLiteral('hello'), createStringLiteral(' world'));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should concatenate string + number', () => {
      const expr = createBinaryExpr('+', createStringLiteral('count: '), createNumberLiteral(42));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should fail adding non-numeric/non-string types', () => {
      const expr = createBinaryExpr('+', createBooleanLiteral(true), createBooleanLiteral(false));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(false);
    });

    it('should return unknown when operand is unknown', () => {
      const expr = createBinaryExpr('+', createIdentifier('missing'), createNumberLiteral(1));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe('unknown');
    });
  });

  describe('Subtraction (-)', () => {
    it('should subtract two numbers', () => {
      const expr = createBinaryExpr('-', createNumberLiteral(10), createNumberLiteral(3));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should subtract to negative', () => {
      const expr = createBinaryExpr('-', createNumberLiteral(3), createNumberLiteral(10));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should subtract zero', () => {
      const expr = createBinaryExpr('-', createNumberLiteral(5), createNumberLiteral(0));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should subtract floating points', () => {
      const expr = createBinaryExpr('-', createNumberLiteral(5.5), createNumberLiteral(2.2));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should fail subtracting non-numbers', () => {
      const expr = createBinaryExpr('-', createStringLiteral('a'), createNumberLiteral(1));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(false);
      expect(result.reason).toContain('Cannot subtract non-numbers');
    });
  });

  describe('Multiplication (*)', () => {
    it('should multiply two numbers', () => {
      const expr = createBinaryExpr('*', createNumberLiteral(6), createNumberLiteral(7));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should multiply by zero', () => {
      const expr = createBinaryExpr('*', createNumberLiteral(100), createNumberLiteral(0));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should multiply negative numbers', () => {
      const expr = createBinaryExpr('*', createNumberLiteral(-3), createNumberLiteral(-4));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should multiply floating points', () => {
      const expr = createBinaryExpr('*', createNumberLiteral(2.5), createNumberLiteral(4.0));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should fail multiplying non-numbers', () => {
      const expr = createBinaryExpr('*', createStringLiteral('a'), createNumberLiteral(2));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(false);
      expect(result.reason).toContain('Cannot multiply non-numbers');
    });
  });

  describe('Division (/)', () => {
    it('should divide two numbers', () => {
      const expr = createBinaryExpr('/', createNumberLiteral(10), createNumberLiteral(2));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should divide with remainder', () => {
      const expr = createBinaryExpr('/', createNumberLiteral(7), createNumberLiteral(2));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should fail on division by zero', () => {
      const expr = createBinaryExpr('/', createNumberLiteral(10), createNumberLiteral(0));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(false);
      expect(result.reason).toBe('Division by zero');
    });

    it('should fail dividing non-numbers', () => {
      const expr = createBinaryExpr('/', createStringLiteral('a'), createNumberLiteral(1));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(false);
      expect(result.reason).toContain('Cannot divide non-numbers');
    });

    it('should divide floating points', () => {
      const expr = createBinaryExpr('/', createNumberLiteral(7.5), createNumberLiteral(2.5));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });
  });

  describe('Modulo (%)', () => {
    it('should compute modulo', () => {
      const expr = createBinaryExpr('%', createNumberLiteral(10), createNumberLiteral(3));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should compute modulo with zero remainder', () => {
      const expr = createBinaryExpr('%', createNumberLiteral(10), createNumberLiteral(5));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should fail on modulo by zero', () => {
      const expr = createBinaryExpr('%', createNumberLiteral(10), createNumberLiteral(0));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(false);
      expect(result.reason).toBe('Modulo by zero');
    });

    it('should fail modulo with non-numbers', () => {
      const expr = createBinaryExpr('%', createStringLiteral('a'), createNumberLiteral(2));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(false);
      expect(result.reason).toContain('Cannot modulo non-numbers');
    });

    it('should compute modulo with negative numbers', () => {
      const expr = createBinaryExpr('%', createNumberLiteral(-7), createNumberLiteral(3));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });
  });

  describe('Unary negation (-)', () => {
    it('should negate a number', () => {
      const expr = createUnaryExpr('-', createNumberLiteral(5));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should negate zero', () => {
      const expr = createUnaryExpr('-', createNumberLiteral(0));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should fail negating non-number', () => {
      const expr = createUnaryExpr('-', createStringLiteral('abc'));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(false);
    });
  });

  describe('Arithmetic with variables', () => {
    it('should add variables from context', () => {
      const ctx = createContext();
      ctx.variables.set('x', 10);
      ctx.variables.set('y', 20);

      const expr = createBinaryExpr('+', createIdentifier('x'), createIdentifier('y'));
      const result = evaluateExpression(expr, ctx);
      expect(result.value).toBe(true);
    });

    it('should use input fields in arithmetic', () => {
      const ctx = createContext({ input: { price: 100, tax: 8 } });
      const priceExpr = createIdentifier('price');
      const taxExpr = createIdentifier('tax');
      const expr = createBinaryExpr('*', priceExpr, taxExpr);
      const result = evaluateExpression(expr, ctx);
      expect(result.value).toBe(true);
    });
  });

  describe('Arithmetic in comparisons', () => {
    it('should compare arithmetic result: (3 + 4) == 7', () => {
      const sum = createBinaryExpr('+', createNumberLiteral(3), createNumberLiteral(4));
      const expr = createBinaryExpr('==', sum, createNumberLiteral(7));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should compare arithmetic result: (10 - 3) > 5', () => {
      const diff = createBinaryExpr('-', createNumberLiteral(10), createNumberLiteral(3));
      const expr = createBinaryExpr('>', diff, createNumberLiteral(5));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should compare arithmetic result: (4 * 5) == 20', () => {
      const product = createBinaryExpr('*', createNumberLiteral(4), createNumberLiteral(5));
      const expr = createBinaryExpr('==', product, createNumberLiteral(20));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should compare arithmetic result: (10 / 2) == 5', () => {
      const quotient = createBinaryExpr('/', createNumberLiteral(10), createNumberLiteral(2));
      const expr = createBinaryExpr('==', quotient, createNumberLiteral(5));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should compare arithmetic result: (10 % 3) == 1', () => {
      const mod = createBinaryExpr('%', createNumberLiteral(10), createNumberLiteral(3));
      const expr = createBinaryExpr('==', mod, createNumberLiteral(1));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });
  });
});

// ============================================================================
// STRING OPERATION TESTS
// ============================================================================

describe('String operations', () => {
  describe('contains', () => {
    it('should return true when substring is found', () => {
      const str = createStringLiteral('hello world');
      const member = createMemberExpr(str, 'contains');
      const call = createCallExpr(member, [createStringLiteral('world')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(true);
    });

    it('should return false when substring is not found', () => {
      const str = createStringLiteral('hello world');
      const member = createMemberExpr(str, 'contains');
      const call = createCallExpr(member, [createStringLiteral('xyz')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(false);
    });

    it('should find empty string in any string', () => {
      const str = createStringLiteral('hello');
      const member = createMemberExpr(str, 'contains');
      const call = createCallExpr(member, [createStringLiteral('')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(true);
    });

    it('should find string in itself', () => {
      const str = createStringLiteral('exact');
      const member = createMemberExpr(str, 'contains');
      const call = createCallExpr(member, [createStringLiteral('exact')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(true);
    });

    it('should handle case sensitivity', () => {
      const str = createStringLiteral('Hello World');
      const member = createMemberExpr(str, 'contains');
      const call = createCallExpr(member, [createStringLiteral('hello')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(false);
    });

    it('should fail with non-string argument', () => {
      const str = createStringLiteral('hello');
      const member = createMemberExpr(str, 'contains');
      const call = createCallExpr(member, [createNumberLiteral(42)]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(false);
      expect(result.reason).toContain('contains requires a string argument');
    });
  });

  describe('startsWith', () => {
    it('should return true when string starts with prefix', () => {
      const str = createStringLiteral('hello world');
      const member = createMemberExpr(str, 'startsWith');
      const call = createCallExpr(member, [createStringLiteral('hello')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(true);
    });

    it('should return false when string does not start with prefix', () => {
      const str = createStringLiteral('hello world');
      const member = createMemberExpr(str, 'startsWith');
      const call = createCallExpr(member, [createStringLiteral('world')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(false);
    });

    it('should handle empty prefix', () => {
      const str = createStringLiteral('hello');
      const member = createMemberExpr(str, 'startsWith');
      const call = createCallExpr(member, [createStringLiteral('')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(true);
    });

    it('should fail with non-string argument', () => {
      const str = createStringLiteral('hello');
      const member = createMemberExpr(str, 'startsWith');
      const call = createCallExpr(member, [createNumberLiteral(1)]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(false);
      expect(result.reason).toContain('startsWith requires a string argument');
    });
  });

  describe('endsWith', () => {
    it('should return true when string ends with suffix', () => {
      const str = createStringLiteral('hello world');
      const member = createMemberExpr(str, 'endsWith');
      const call = createCallExpr(member, [createStringLiteral('world')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(true);
    });

    it('should return false when string does not end with suffix', () => {
      const str = createStringLiteral('hello world');
      const member = createMemberExpr(str, 'endsWith');
      const call = createCallExpr(member, [createStringLiteral('hello')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(false);
    });

    it('should handle empty suffix', () => {
      const str = createStringLiteral('hello');
      const member = createMemberExpr(str, 'endsWith');
      const call = createCallExpr(member, [createStringLiteral('')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(true);
    });

    it('should fail with non-string argument', () => {
      const str = createStringLiteral('hello');
      const member = createMemberExpr(str, 'endsWith');
      const call = createCallExpr(member, [createNumberLiteral(1)]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(false);
      expect(result.reason).toContain('endsWith requires a string argument');
    });
  });

  describe('concat', () => {
    it('should concatenate two strings', () => {
      const str = createStringLiteral('hello');
      const member = createMemberExpr(str, 'concat');
      const call = createCallExpr(member, [createStringLiteral(' world')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(true);
    });

    it('should concatenate with empty string', () => {
      const str = createStringLiteral('hello');
      const member = createMemberExpr(str, 'concat');
      const call = createCallExpr(member, [createStringLiteral('')]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(true);
    });

    it('should fail with non-string argument', () => {
      const str = createStringLiteral('hello');
      const member = createMemberExpr(str, 'concat');
      const call = createCallExpr(member, [createNumberLiteral(42)]);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(false);
      expect(result.reason).toContain('concat requires a string argument');
    });
  });

  describe('String length (method call)', () => {
    it('should return true for non-empty string length', () => {
      const str = createStringLiteral('hello');
      const member = createMemberExpr(str, 'length');
      const call = createCallExpr(member, []);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(true);
    });

    it('should return true for empty string length', () => {
      const str = createStringLiteral('');
      const member = createMemberExpr(str, 'length');
      const call = createCallExpr(member, []);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(true);
    });
  });

  describe('String length (property access)', () => {
    it('should evaluate string length property', () => {
      const ctx = createContext({ input: { name: 'Alice' } });
      const nameExpr = createIdentifier('name');
      const lengthExpr = createMemberExpr(nameExpr, 'length');
      const result = evaluateExpression(lengthExpr, ctx);
      expect(result.value).toBe(true);
    });
  });

  describe('String is_valid', () => {
    it('should return true for non-empty string is_valid call', () => {
      const str = createStringLiteral('hello');
      const member = createMemberExpr(str, 'is_valid');
      const call = createCallExpr(member, []);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(true);
    });

    it('should return false for empty string is_valid call', () => {
      const str = createStringLiteral('');
      const member = createMemberExpr(str, 'is_valid');
      const call = createCallExpr(member, []);
      const result = evaluateExpression(call, createContext());
      expect(result.value).toBe(false);
    });
  });

  describe('String with input values', () => {
    it('should evaluate contains on input field', () => {
      const ctx = createContext({ input: { email: 'user@example.com' } });
      const emailExpr = createIdentifier('email');
      const member = createMemberExpr(emailExpr, 'contains');
      const call = createCallExpr(member, [createStringLiteral('@')]);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });

    it('should evaluate startsWith on input field', () => {
      const ctx = createContext({ input: { url: 'https://example.com' } });
      const urlExpr = createIdentifier('url');
      const member = createMemberExpr(urlExpr, 'startsWith');
      const call = createCallExpr(member, [createStringLiteral('https://')]);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });
  });
});

// ============================================================================
// COLLECTION OPERATION TESTS
// ============================================================================

describe('Collection operations', () => {
  function createInputList(name: string, values: number[]): { ctx: ReturnType<typeof createContext>; listExpr: AST.Expression } {
    const ctx = createContext({ input: { [name]: values } });
    const listExpr = createIdentifier(name);
    return { ctx, listExpr };
  }

  describe('Collection length (method call)', () => {
    it('should return true for array length', () => {
      const { ctx, listExpr } = createInputList('items', [1, 2, 3]);
      const member = createMemberExpr(listExpr, 'length');
      const call = createCallExpr(member, []);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });

    it('should return true for empty array length', () => {
      const { ctx, listExpr } = createInputList('items', []);
      const member = createMemberExpr(listExpr, 'length');
      const call = createCallExpr(member, []);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });
  });

  describe('Collection length (property access)', () => {
    it('should evaluate array length property', () => {
      const ctx = createContext({ input: { items: [10, 20, 30] } });
      const itemsExpr = createIdentifier('items');
      const lengthExpr = createMemberExpr(itemsExpr, 'length');
      const result = evaluateExpression(lengthExpr, ctx);
      expect(result.value).toBe(true);
    });

    it('should compare array length: items.length == 3', () => {
      const ctx = createContext({ input: { items: [10, 20, 30] } });
      const itemsExpr = createIdentifier('items');
      const lengthExpr = createMemberExpr(itemsExpr, 'length');
      const expr = createBinaryExpr('==', lengthExpr, createNumberLiteral(3));
      const result = evaluateExpression(expr, ctx);
      expect(result.value).toBe(true);
    });
  });

  describe('Collection sum', () => {
    it('should compute sum of numeric array', () => {
      const { ctx, listExpr } = createInputList('nums', [1, 2, 3, 4, 5]);
      const member = createMemberExpr(listExpr, 'sum');
      const call = createCallExpr(member, []);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });

    it('should compute sum of empty array', () => {
      const { ctx, listExpr } = createInputList('nums', []);
      const member = createMemberExpr(listExpr, 'sum');
      const call = createCallExpr(member, []);
      // Empty array: every() returns true for empty, so sum succeeds
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });

    it('should fail sum of non-numeric array', () => {
      const ctx = createContext({ input: { items: ['a', 'b', 'c'] } });
      const listExpr = createIdentifier('items');
      const member = createMemberExpr(listExpr, 'sum');
      const call = createCallExpr(member, []);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(false);
      expect(result.reason).toContain('sum requires all numeric elements');
    });
  });

  describe('Collection count', () => {
    it('should return true for count', () => {
      const { ctx, listExpr } = createInputList('items', [10, 20, 30]);
      const member = createMemberExpr(listExpr, 'count');
      const call = createCallExpr(member, []);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });

    it('should return true for empty array count', () => {
      const { ctx, listExpr } = createInputList('items', []);
      const member = createMemberExpr(listExpr, 'count');
      const call = createCallExpr(member, []);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });
  });

  describe('Collection contains', () => {
    it('should return true when element is in array', () => {
      const { ctx, listExpr } = createInputList('nums', [1, 2, 3]);
      const member = createMemberExpr(listExpr, 'contains');
      const call = createCallExpr(member, [createNumberLiteral(2)]);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });

    it('should return false when element is not in array', () => {
      const { ctx, listExpr } = createInputList('nums', [1, 2, 3]);
      const member = createMemberExpr(listExpr, 'contains');
      const call = createCallExpr(member, [createNumberLiteral(99)]);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(false);
    });

    it('should handle string elements', () => {
      const ctx = createContext({ input: { tags: ['red', 'green', 'blue'] } });
      const listExpr = createIdentifier('tags');
      const member = createMemberExpr(listExpr, 'contains');
      const call = createCallExpr(member, [createStringLiteral('green')]);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });

    it('should return false for empty array', () => {
      const { ctx, listExpr } = createInputList('items', []);
      const member = createMemberExpr(listExpr, 'contains');
      const call = createCallExpr(member, [createNumberLiteral(1)]);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(false);
    });
  });

  describe('Collection isEmpty', () => {
    it('should return true for empty array', () => {
      const { ctx, listExpr } = createInputList('items', []);
      const member = createMemberExpr(listExpr, 'isEmpty');
      const call = createCallExpr(member, []);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });

    it('should return false for non-empty array', () => {
      const { ctx, listExpr } = createInputList('items', [1, 2, 3]);
      const member = createMemberExpr(listExpr, 'isEmpty');
      const call = createCallExpr(member, []);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(false);
    });
  });

  describe('Collection index', () => {
    it('should return true for valid index', () => {
      const { ctx, listExpr } = createInputList('items', [10, 20, 30]);
      const member = createMemberExpr(listExpr, 'index');
      const call = createCallExpr(member, [createNumberLiteral(1)]);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });

    it('should return true for first element', () => {
      const { ctx, listExpr } = createInputList('items', [10, 20, 30]);
      const member = createMemberExpr(listExpr, 'index');
      const call = createCallExpr(member, [createNumberLiteral(0)]);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });

    it('should return true for last element', () => {
      const { ctx, listExpr } = createInputList('items', [10, 20, 30]);
      const member = createMemberExpr(listExpr, 'index');
      const call = createCallExpr(member, [createNumberLiteral(2)]);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });

    it('should fail for out-of-bounds index', () => {
      const { ctx, listExpr } = createInputList('items', [10, 20, 30]);
      const member = createMemberExpr(listExpr, 'index');
      const call = createCallExpr(member, [createNumberLiteral(5)]);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(false);
      expect(result.reason).toContain('out of bounds');
    });

    it('should fail for negative index', () => {
      const { ctx, listExpr } = createInputList('items', [10, 20, 30]);
      const member = createMemberExpr(listExpr, 'index');
      const call = createCallExpr(member, [createNumberLiteral(-1)]);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(false);
      expect(result.reason).toContain('out of bounds');
    });

    it('should fail for non-number index', () => {
      const { ctx, listExpr } = createInputList('items', [10, 20, 30]);
      const member = createMemberExpr(listExpr, 'index');
      const call = createCallExpr(member, [createStringLiteral('first')]);
      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(false);
      expect(result.reason).toContain('index requires a number argument');
    });
  });

  describe('IndexExpr on collections', () => {
    it('should access array element by index', () => {
      const ctx = createContext({ input: { items: [10, 20, 30] } });
      const itemsExpr = createIdentifier('items');
      const indexExpr = createIndexExpr(itemsExpr, createNumberLiteral(1));
      const result = evaluateExpression(indexExpr, ctx);
      expect(result.value).toBe(true);
    });

    it('should access object property by string index', () => {
      const ctx = createContext({ input: { data: { key: 'value' } } });
      const dataExpr = createIdentifier('data');
      const indexExpr = createIndexExpr(dataExpr, createStringLiteral('key'));
      const result = evaluateExpression(indexExpr, ctx);
      expect(result.value).toBe(true);
    });

    it('should fail for array with non-number index', () => {
      const ctx = createContext({ input: { items: [10, 20] } });
      const itemsExpr = createIdentifier('items');
      const indexExpr = createIndexExpr(itemsExpr, createStringLiteral('foo'));
      const result = evaluateExpression(indexExpr, ctx);
      expect(result.value).toBe(false);
    });

    it('should fail for null object', () => {
      const ctx = createContext({ input: { obj: null } });
      const objExpr = createIdentifier('obj');
      const indexExpr = createIndexExpr(objExpr, createNumberLiteral(0));
      const result = evaluateExpression(indexExpr, ctx);
      expect(result.value).toBe(false);
    });
  });
});

// ============================================================================
// IN / IFF OPERATOR TESTS
// ============================================================================

describe('Membership and biconditional operators', () => {
  describe('in operator', () => {
    it('should find number in array', () => {
      const ctx = createContext({ input: { items: [1, 2, 3] } });
      const expr = createBinaryExpr('in', createNumberLiteral(2), createIdentifier('items'));
      const result = evaluateExpression(expr, ctx);
      expect(result.value).toBe(true);
    });

    it('should not find missing number in array', () => {
      const ctx = createContext({ input: { items: [1, 2, 3] } });
      const expr = createBinaryExpr('in', createNumberLiteral(99), createIdentifier('items'));
      const result = evaluateExpression(expr, ctx);
      expect(result.value).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should find substring in string', () => {
      const expr = createBinaryExpr('in', createStringLiteral('world'), createStringLiteral('hello world'));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should not find missing substring', () => {
      const expr = createBinaryExpr('in', createStringLiteral('xyz'), createStringLiteral('hello'));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(false);
    });

    it('should fail for invalid right operand', () => {
      const expr = createBinaryExpr('in', createNumberLiteral(1), createNumberLiteral(42));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(false);
      expect(result.reason).toContain('requires array or string');
    });

    it('should find string in array', () => {
      const ctx = createContext({ input: { roles: ['admin', 'user', 'moderator'] } });
      const expr = createBinaryExpr('in', createStringLiteral('admin'), createIdentifier('roles'));
      const result = evaluateExpression(expr, ctx);
      expect(result.value).toBe(true);
    });
  });

  describe('iff operator', () => {
    it('should return true when both sides true', () => {
      const expr = createBinaryExpr('iff', createBooleanLiteral(true), createBooleanLiteral(true));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should return true when both sides false', () => {
      const expr = createBinaryExpr('iff', createBooleanLiteral(false), createBooleanLiteral(false));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(true);
    });

    it('should return false when sides differ (true/false)', () => {
      const expr = createBinaryExpr('iff', createBooleanLiteral(true), createBooleanLiteral(false));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(false);
    });

    it('should return false when sides differ (false/true)', () => {
      const expr = createBinaryExpr('iff', createBooleanLiteral(false), createBooleanLiteral(true));
      const result = evaluateExpression(expr, createContext());
      expect(result.value).toBe(false);
    });
  });
});

// ============================================================================
// extractValue CONCRETE VALUE TESTS
// ============================================================================

describe('Concrete value extraction via comparisons', () => {
  it('should verify string concat result: "hello" + " world" == "hello world"', () => {
    const concat = createBinaryExpr('+', createStringLiteral('hello'), createStringLiteral(' world'));
    const expr = createBinaryExpr('==', concat, createStringLiteral('hello world'));
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should verify nested arithmetic: (2 + 3) * 4 == 20', () => {
    const sum = createBinaryExpr('+', createNumberLiteral(2), createNumberLiteral(3));
    const product = createBinaryExpr('*', sum, createNumberLiteral(4));
    const expr = createBinaryExpr('==', product, createNumberLiteral(20));
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should verify division: 15 / 3 == 5', () => {
    const div = createBinaryExpr('/', createNumberLiteral(15), createNumberLiteral(3));
    const expr = createBinaryExpr('==', div, createNumberLiteral(5));
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should verify modulo: 17 % 5 == 2', () => {
    const mod = createBinaryExpr('%', createNumberLiteral(17), createNumberLiteral(5));
    const expr = createBinaryExpr('==', mod, createNumberLiteral(2));
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should verify subtraction: 100 - 37 == 63', () => {
    const diff = createBinaryExpr('-', createNumberLiteral(100), createNumberLiteral(37));
    const expr = createBinaryExpr('==', diff, createNumberLiteral(63));
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should verify complex: ((a + b) * c) - d where a=2,b=3,c=4,d=5 == 15', () => {
    const ctx = createContext();
    ctx.variables.set('a', 2);
    ctx.variables.set('b', 3);
    ctx.variables.set('c', 4);
    ctx.variables.set('d', 5);

    const sum = createBinaryExpr('+', createIdentifier('a'), createIdentifier('b'));
    const product = createBinaryExpr('*', sum, createIdentifier('c'));
    const diff = createBinaryExpr('-', product, createIdentifier('d'));
    const expr = createBinaryExpr('==', diff, createNumberLiteral(15));
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// SPECIAL EXPRESSION COVERAGE
// ============================================================================

describe('Special expressions', () => {
  it('should evaluate result expression', () => {
    const ctx = createContext({ result: { status: 'ok', value: 42 } });
    const expr: AST.ResultExpr = {
      kind: 'ResultExpr',
      property: createIdentifier('status'),
      location: createLocation(),
    };
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });

  it('should fail result expression with missing property', () => {
    const ctx = createContext({ result: { status: 'ok' } });
    const expr: AST.ResultExpr = {
      kind: 'ResultExpr',
      property: createIdentifier('missing'),
      location: createLocation(),
    };
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(false);
  });

  it('should fail result expression when result is null', () => {
    const ctx = createContext({ result: null });
    const expr: AST.ResultExpr = {
      kind: 'ResultExpr',
      property: createIdentifier('status'),
      location: createLocation(),
    };
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(false);
  });

  it('should evaluate result without property', () => {
    const ctx = createContext({ result: 42 });
    const expr: AST.ResultExpr = {
      kind: 'ResultExpr',
      property: undefined as unknown as AST.Identifier,
      location: createLocation(),
    };
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });

  it('should evaluate input expression', () => {
    const ctx = createContext({ input: { name: 'Alice' } });
    const expr: AST.InputExpr = {
      kind: 'InputExpr',
      property: createIdentifier('name'),
      location: createLocation(),
    };
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });

  it('should fail input expression with missing property', () => {
    const ctx = createContext({ input: {} });
    const expr: AST.InputExpr = {
      kind: 'InputExpr',
      property: createIdentifier('missing'),
      location: createLocation(),
    };
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(false);
  });

  it('should handle identifier for result', () => {
    const ctx = createContext({ result: { value: 100 } });
    const expr = createIdentifier('result');
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });

  it('should handle identifier for input', () => {
    const ctx = createContext({ input: { name: 'test' } });
    const expr = createIdentifier('input');
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });

  it('should handle identifier for now', () => {
    const ctx = createContext();
    const expr = createIdentifier('now');
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });

  it('should evaluate old() expression', () => {
    const snapshot = {
      entities: new Map(),
      timestamp: Date.now(),
    };
    const ctx = createContext({ oldState: snapshot });
    const innerExpr = createBooleanLiteral(true);
    const expr: AST.OldExpr = {
      kind: 'OldExpr',
      expression: innerExpr,
      location: createLocation(),
    };
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });

  it('should fail old() without snapshot', () => {
    const ctx = createContext({ oldState: undefined });
    const innerExpr = createBooleanLiteral(true);
    const expr: AST.OldExpr = {
      kind: 'OldExpr',
      expression: innerExpr,
      location: createLocation(),
    };
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(false);
  });
});

// ============================================================================
// QUALIFIED NAME & DEPTH LIMIT TESTS
// ============================================================================

describe('QualifiedName expressions', () => {
  it('should evaluate qualified name', () => {
    const ctx = createContext({ input: { user: { name: 'Alice' } } });
    const expr: AST.QualifiedName = {
      kind: 'QualifiedName',
      parts: [createIdentifier('input'), createIdentifier('user')],
      location: createLocation(),
    };
    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });
});

describe('Depth limit', () => {
  it('should fail when depth exceeds maxDepth', () => {
    const expr = createBooleanLiteral(true);
    const result = evaluateExpression(expr, createContext(), { maxDepth: 0 });
    expect(result.value).toBe(true); // single expr at depth 0 passes
    const nested = createBinaryExpr('and', expr, expr);
    const result2 = evaluateExpression(nested, createContext(), { maxDepth: 0 });
    expect(result2.value).toBe(false);
    // Depth limit may appear in reason or in a child's reason (e.g. left operand)
    const reason = result2.reason ?? '';
    const childReason = result2.children?.[0]?.reason ?? result2.children?.[1]?.reason ?? '';
    expect(reason + childReason).toMatch(/Maximum evaluation depth/);
  });
});

// ============================================================================
// UNSUPPORTED EXPRESSION TESTS
// ============================================================================

describe('Unsupported expressions', () => {
  it('should fail for unsupported expression kinds', () => {
    const expr = {
      kind: 'SomeFutureExpr',
      location: createLocation(),
    } as unknown as AST.Expression;
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(false);
    expect(result.reason).toContain('Unsupported expression kind');
  });

  it('should fail for unsupported binary operator', () => {
    const expr = createBinaryExpr('xor' as AST.BinaryOperator, createNumberLiteral(1), createNumberLiteral(2));
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(false);
    expect(result.reason).toContain('Unsupported binary operator');
  });

  it('should fail for unsupported unary operator', () => {
    const expr = createUnaryExpr('~' as AST.UnaryOperator, createNumberLiteral(1));
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(false);
    expect(result.reason).toContain('Unsupported unary operator');
  });

  it('should fail for unknown method on string', () => {
    const str = createStringLiteral('hello');
    const member = createMemberExpr(str, 'unknownMethod');
    const call = createCallExpr(member, []);
    const result = evaluateExpression(call, createContext());
    expect(result.value).toBe(false);
    expect(result.reason).toContain('Unknown method');
  });

  it('should fail for unknown builtin function', () => {
    const call = createCallExpr(createIdentifier('nonExistentFn'), []);
    const result = evaluateExpression(call, createContext());
    expect(result.value).toBe(false);
    expect(result.reason).toContain('Unknown function');
  });

  it('should fail for unknown identifier', () => {
    const expr = createIdentifier('undeclaredVariable');
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(false);
    expect(result.reason).toContain('Unknown identifier');
  });
});

// ============================================================================
// DEFAULT ADAPTER TESTS
// ============================================================================

describe('DefaultAdapter', () => {
  const adapter = new DefaultAdapter();

  it('is_valid returns false for null', () => {
    expect(adapter.is_valid(null)).toBe(false);
  });

  it('is_valid returns false for undefined', () => {
    expect(adapter.is_valid(undefined)).toBe(false);
  });

  it('is_valid returns true for non-empty string', () => {
    expect(adapter.is_valid('hello')).toBe(true);
  });

  it('is_valid returns false for empty string', () => {
    expect(adapter.is_valid('')).toBe(false);
  });

  it('is_valid returns true for valid number', () => {
    expect(adapter.is_valid(42)).toBe(true);
  });

  it('is_valid returns false for NaN', () => {
    expect(adapter.is_valid(NaN)).toBe(false);
  });

  it('is_valid returns false for Infinity', () => {
    expect(adapter.is_valid(Infinity)).toBe(false);
  });

  it('is_valid returns true for boolean', () => {
    expect(adapter.is_valid(true)).toBe(true);
    expect(adapter.is_valid(false)).toBe(true);
  });

  it('is_valid returns true for non-empty array', () => {
    expect(adapter.is_valid([1, 2])).toBe(true);
  });

  it('is_valid returns false for empty array', () => {
    expect(adapter.is_valid([])).toBe(false);
  });

  it('is_valid returns true for object', () => {
    expect(adapter.is_valid({ key: 'val' })).toBe(true);
  });

  it('length returns unknown for null', () => {
    expect(adapter.length(null)).toBe('unknown');
  });

  it('length returns unknown for undefined', () => {
    expect(adapter.length(undefined)).toBe('unknown');
  });

  it('length returns string length', () => {
    expect(adapter.length('hello')).toBe(5);
  });

  it('length returns array length', () => {
    expect(adapter.length([1, 2, 3])).toBe(3);
  });

  it('length returns unknown for number', () => {
    expect(adapter.length(42)).toBe('unknown');
  });
});

// ============================================================================
// COMPLEX END-TO-END SCENARIOS
// ============================================================================

describe('End-to-end scenarios', () => {
  it('should verify order total: items.length > 0 and total > 0', () => {
    const ctx = createContext({ input: { items: ['a', 'b'], total: 100 } });

    const itemsLen = createMemberExpr(createIdentifier('items'), 'length');
    const lenGtZero = createBinaryExpr('>', itemsLen, createNumberLiteral(0));
    const totalGtZero = createBinaryExpr('>', createIdentifier('total'), createNumberLiteral(0));
    const expr = createBinaryExpr('and', lenGtZero, totalGtZero);

    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });

  it('should verify email format: email.contains("@") and email.length > 5', () => {
    const ctx = createContext({ input: { email: 'user@example.com' } });

    const emailExpr = createIdentifier('email');
    const containsAt = createCallExpr(
      createMemberExpr(emailExpr, 'contains'),
      [createStringLiteral('@')]
    );
    const emailLen = createMemberExpr(emailExpr, 'length');
    const lenGt5 = createBinaryExpr('>', emailLen, createNumberLiteral(5));
    const expr = createBinaryExpr('and', containsAt, lenGt5);

    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });

  it('should verify discount: price * discount / 100 == expected', () => {
    const ctx = createContext();
    ctx.variables.set('price', 200);
    ctx.variables.set('discount', 15);

    const product = createBinaryExpr('*', createIdentifier('price'), createIdentifier('discount'));
    const divided = createBinaryExpr('/', product, createNumberLiteral(100));
    const expr = createBinaryExpr('==', divided, createNumberLiteral(30));

    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });

  it('should verify pagination: page >= 1 and page <= totalPages', () => {
    const ctx = createContext({ input: { page: 3, totalPages: 10 } });

    const pageGe1 = createBinaryExpr('>=', createIdentifier('page'), createNumberLiteral(1));
    const pageLeTp = createBinaryExpr('<=', createIdentifier('page'), createIdentifier('totalPages'));
    const expr = createBinaryExpr('and', pageGe1, pageLeTp);

    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });

  it('should handle all quantifier with arithmetic predicate', () => {
    const collection = createListExpr([
      createNumberLiteral(2),
      createNumberLiteral(4),
      createNumberLiteral(6),
    ]);
    // all(x in [2,4,6], x % 2 == 0)
    const predicate = createBinaryExpr(
      '==',
      createBinaryExpr('%', createIdentifier('x'), createNumberLiteral(2)),
      createNumberLiteral(0)
    );
    const expr = createQuantifierExpr('all', 'x', collection, predicate);
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle any quantifier finding match', () => {
    const collection = createListExpr([
      createNumberLiteral(1),
      createNumberLiteral(3),
      createNumberLiteral(4),
    ]);
    // any(x in [1,3,4], x % 2 == 0)
    const predicate = createBinaryExpr(
      '==',
      createBinaryExpr('%', createIdentifier('x'), createNumberLiteral(2)),
      createNumberLiteral(0)
    );
    const expr = createQuantifierExpr('any', 'x', collection, predicate);
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle conditional with arithmetic', () => {
    const ctx = createContext();
    ctx.variables.set('discount', true);

    const condition = createIdentifier('discount');
    const thenBranch = createBinaryExpr('*', createNumberLiteral(100), createNumberLiteral(0.9));
    const elseBranch = createNumberLiteral(100);
    const expr = createConditionalExpr(condition, thenBranch, elseBranch);

    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// ENTITY OPERATIONS TESTS (using adapter interface)
// ============================================================================

describe('Entity operations with adapter', () => {
  it('should use adapter for is_valid check', () => {
    const ctx = createContext({ input: { value: 'test' } });
    const adapter = {
      is_valid: () => true,
      length: () => 4,
    };

    const valueExpr = createIdentifier('value');
    const isValidExpr = createMemberExpr(valueExpr, 'is_valid');
    const call = createCallExpr(isValidExpr, []);

    const result = evaluateExpression(call, ctx, { adapter });
    expect(result.value).toBe(true);
  });

  it('should use adapter for is_valid returning false', () => {
    const ctx = createContext({ input: { value: '' } });
    const adapter = {
      is_valid: () => false,
      length: () => 0,
    };

    const valueExpr = createIdentifier('value');
    const isValidExpr = createMemberExpr(valueExpr, 'is_valid');
    const call = createCallExpr(isValidExpr, []);

    const result = evaluateExpression(call, ctx, { adapter });
    expect(result.value).toBe(false);
  });

  it('should use adapter for length check', () => {
    const ctx = createContext({ input: { items: [1, 2, 3] } });
    const adapter = {
      is_valid: () => true,
      length: () => 3,
    };

    const itemsExpr = createIdentifier('items');
    const lengthExpr = createMemberExpr(itemsExpr, 'length');

    const result = evaluateExpression(lengthExpr, ctx, { adapter });
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// POSTCONDITION PATTERN TESTS
// ============================================================================

describe('Postcondition patterns', () => {
  function createPostconditionContext(result: unknown): ReturnType<typeof createContext> {
    return createContext({ result });
  }

  describe('success implies condition pattern', () => {
    it('should evaluate "success implies result.id != null" to TRUE when result has id', () => {
      const ctx = createPostconditionContext({ id: 'new-user-123', name: 'Alice' });
      ctx.variables.set('success', true);

      const successExpr = createIdentifier('success');
      const resultExpr: AST.ResultExpr = {
        kind: 'ResultExpr',
        property: createIdentifier('id'),
        location: createLocation(),
      };
      const notNullExpr = createBinaryExpr('!=', resultExpr, createNullLiteral());
      const impliesExpr = createBinaryExpr('implies', successExpr, notNullExpr);

      const result = evaluateExpression(impliesExpr, ctx);
      expect(result.value).toBe(true);
      expect(result.value).not.toBe('unknown');
    });

    it('should evaluate "success implies result.id != null" to unknown when success but id property missing', () => {
      const ctx = createPostconditionContext({ name: 'Alice' });
      ctx.variables.set('success', true);

      const successExpr = createIdentifier('success');
      const resultExpr: AST.ResultExpr = {
        kind: 'ResultExpr',
        property: createIdentifier('id'),
        location: createLocation(),
      };
      const notNullExpr = createBinaryExpr('!=', resultExpr, createNullLiteral());
      const impliesExpr = createBinaryExpr('implies', successExpr, notNullExpr);

      const result = evaluateExpression(impliesExpr, ctx);
      // Missing property returns unknown since we can't determine the value
      expect(result.value).toBe('unknown');
    });

    it('should evaluate "success implies result.id != null" to FALSE when success but id is explicitly null', () => {
      const ctx = createPostconditionContext({ name: 'Alice', id: null });
      ctx.variables.set('success', true);

      const successExpr = createIdentifier('success');
      const resultExpr: AST.ResultExpr = {
        kind: 'ResultExpr',
        property: createIdentifier('id'),
        location: createLocation(),
      };
      const notNullExpr = createBinaryExpr('!=', resultExpr, createNullLiteral());
      const impliesExpr = createBinaryExpr('implies', successExpr, notNullExpr);

      const result = evaluateExpression(impliesExpr, ctx);
      expect(result.value).toBe(false);
    });

    it('should evaluate "false implies anything" to TRUE (vacuous truth)', () => {
      const ctx = createPostconditionContext(null);

      // Use boolean literal false directly
      const falseExpr = createBooleanLiteral(false);
      const anyCondition = createBooleanLiteral(false);
      const impliesExpr = createBinaryExpr('implies', falseExpr, anyCondition);

      const result = evaluateExpression(impliesExpr, ctx);
      expect(result.value).toBe(true);
    });
  });

  describe('implies operator behavior', () => {
    it('should evaluate "true implies true" to TRUE', () => {
      const ctx = createPostconditionContext({ id: 'user-123' });

      const trueExpr1 = createBooleanLiteral(true);
      const trueExpr2 = createBooleanLiteral(true);
      const impliesExpr = createBinaryExpr('implies', trueExpr1, trueExpr2);

      const result = evaluateExpression(impliesExpr, ctx);
      expect(result.value).toBe(true);
      expect(result.value).not.toBe('unknown');
    });

    it('should evaluate "true implies false" to FALSE', () => {
      const ctx = createPostconditionContext({ id: 'user-123' });

      const trueExpr = createBooleanLiteral(true);
      const falseExpr = createBooleanLiteral(false);
      const impliesExpr = createBinaryExpr('implies', trueExpr, falseExpr);

      const result = evaluateExpression(impliesExpr, ctx);
      expect(result.value).toBe(false);
    });

    it('should evaluate "false implies anything" to TRUE (vacuous truth)', () => {
      const ctx = createPostconditionContext(null);

      const falseExpr = createBooleanLiteral(false);
      const anyCondition = createBooleanLiteral(false);
      const impliesExpr = createBinaryExpr('implies', falseExpr, anyCondition);

      const result = evaluateExpression(impliesExpr, ctx);
      expect(result.value).toBe(true);
    });
  });

  describe('result property postconditions', () => {
    it('should verify result.status == "created"', () => {
      const ctx = createPostconditionContext({ status: 'created', id: 'user-1' });

      const resultExpr: AST.ResultExpr = {
        kind: 'ResultExpr',
        property: createIdentifier('status'),
        location: createLocation(),
      };
      const expr = createBinaryExpr('==', resultExpr, createStringLiteral('created'));

      const result = evaluateExpression(expr, ctx);
      expect(result.value).toBe(true);
    });

    it('should verify result.count > 0', () => {
      const ctx = createPostconditionContext({ count: 5 });

      const resultExpr: AST.ResultExpr = {
        kind: 'ResultExpr',
        property: createIdentifier('count'),
        location: createLocation(),
      };
      const expr = createBinaryExpr('>', resultExpr, createNumberLiteral(0));

      const result = evaluateExpression(expr, ctx);
      expect(result.value).toBe(true);
    });

    it('should verify complex postcondition: result.items.length == input.count', () => {
      const ctx = createPostconditionContext({ items: [1, 2, 3] });
      ctx.input = { count: 3 };

      const resultExpr: AST.ResultExpr = {
        kind: 'ResultExpr',
        property: createIdentifier('items'),
        location: createLocation(),
      };
      const lengthExpr = createMemberExpr(resultExpr, 'length');
      const inputCountExpr = createIdentifier('count');
      const expr = createBinaryExpr('==', lengthExpr, inputCountExpr);

      const result = evaluateExpression(expr, ctx);
      expect(result.value).toBe(true);
    });
  });

  describe('postconditions evaluate to TRUE/FALSE not unknown', () => {
    it('should return concrete boolean for simple comparisons', () => {
      const ctx = createPostconditionContext({ value: 42 });

      const resultExpr: AST.ResultExpr = {
        kind: 'ResultExpr',
        property: createIdentifier('value'),
        location: createLocation(),
      };
      const expr = createBinaryExpr('==', resultExpr, createNumberLiteral(42));

      const result = evaluateExpression(expr, ctx);
      expect(typeof result.value === 'boolean').toBe(true);
    });

    it('should return FALSE (not unknown) for missing property', () => {
      const ctx = createPostconditionContext({ name: 'test' });

      const resultExpr: AST.ResultExpr = {
        kind: 'ResultExpr',
        property: createIdentifier('missingProp'),
        location: createLocation(),
      };

      const result = evaluateExpression(resultExpr, ctx);
      expect(result.value).toBe(false);
    });

    it('should return concrete boolean for string contains', () => {
      const ctx = createPostconditionContext({ email: 'user@example.com' });

      const resultExpr: AST.ResultExpr = {
        kind: 'ResultExpr',
        property: createIdentifier('email'),
        location: createLocation(),
      };
      const containsExpr = createMemberExpr(resultExpr, 'contains');
      const call = createCallExpr(containsExpr, [createStringLiteral('@')]);

      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
      expect(result.value).not.toBe('unknown');
    });

    it('should return concrete boolean for array membership', () => {
      const ctx = createPostconditionContext({ roles: ['admin', 'user'] });

      const resultExpr: AST.ResultExpr = {
        kind: 'ResultExpr',
        property: createIdentifier('roles'),
        location: createLocation(),
      };
      const containsExpr = createMemberExpr(resultExpr, 'contains');
      const call = createCallExpr(containsExpr, [createStringLiteral('admin')]);

      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
      expect(result.value).not.toBe('unknown');
    });
  });
});

// ============================================================================
// NULL/UNDEFINED SAFETY TESTS
// ============================================================================

describe('Null/undefined safety', () => {
  describe('null propagation', () => {
    it('should handle null in member access gracefully', () => {
      const ctx = createContext({ input: { user: null } });

      const userExpr = createIdentifier('user');
      const nameExpr = createMemberExpr(userExpr, 'name');

      const result = evaluateExpression(nameExpr, ctx);
      expect(result.value).toBe('unknown');
    });

    it('should handle undefined in member access gracefully', () => {
      const ctx = createContext({ input: {} });

      const userExpr = createIdentifier('user');
      const nameExpr = createMemberExpr(userExpr, 'name');

      const result = evaluateExpression(nameExpr, ctx);
      // Unknown identifier followed by member access returns unknown
      expect(result.value).toBe('unknown');
    });

    it('should handle deeply nested null access', () => {
      const ctx = createContext({ input: { a: { b: null } } });

      const aExpr = createIdentifier('a');
      const bExpr = createMemberExpr(aExpr, 'b');
      const cExpr = createMemberExpr(bExpr, 'c');

      const result = evaluateExpression(cExpr, ctx);
      expect(result.value).toBe('unknown');
    });
  });

  describe('null comparisons', () => {
    it('should correctly compare value == null', () => {
      const ctx = createContext({ input: { value: null } });

      const valueExpr = createIdentifier('value');
      const expr = createBinaryExpr('==', valueExpr, createNullLiteral());

      const result = evaluateExpression(expr, ctx);
      expect(result.value).toBe(true);
    });

    it('should correctly compare value != null', () => {
      const ctx = createContext({ input: { value: 'something' } });

      const valueExpr = createIdentifier('value');
      const expr = createBinaryExpr('!=', valueExpr, createNullLiteral());

      const result = evaluateExpression(expr, ctx);
      expect(result.value).toBe(true);
    });

    it('should handle null in array contains', () => {
      const ctx = createContext({ input: { items: [1, null, 3] } });

      const itemsExpr = createIdentifier('items');
      const containsExpr = createMemberExpr(itemsExpr, 'contains');
      const call = createCallExpr(containsExpr, [createNullLiteral()]);

      const result = evaluateExpression(call, ctx);
      expect(result.value).toBe(true);
    });
  });

  describe('null-safe arithmetic', () => {
    it('should fail for arithmetic with null (type error)', () => {
      const ctx = createContext({ input: { value: null } });

      const valueExpr = createIdentifier('value');
      const expr = createBinaryExpr('+', valueExpr, createNumberLiteral(1));

      const result = evaluateExpression(expr, ctx);
      // Arithmetic with null fails (cannot add null + number)
      expect(result.value).toBe(false);
    });

    it('should fail for comparison with null values (type error)', () => {
      const ctx = createContext({ input: { a: null, b: 5 } });

      const aExpr = createIdentifier('a');
      const bExpr = createIdentifier('b');
      const expr = createBinaryExpr('<', aExpr, bExpr);

      const result = evaluateExpression(expr, ctx);
      // Comparison < with null fails (cannot compare null < number)
      expect(result.value).toBe(false);
    });
  });

  describe('null-safe string operations', () => {
    it('should fail gracefully for contains on null', () => {
      const ctx = createContext({ input: { text: null } });

      const textExpr = createIdentifier('text');
      const containsExpr = createMemberExpr(textExpr, 'contains');
      const call = createCallExpr(containsExpr, [createStringLiteral('test')]);

      const result = evaluateExpression(call, ctx);
      expect(result.value === 'unknown' || result.value === false).toBe(true);
    });

    it('should fail gracefully for startsWith on null', () => {
      const ctx = createContext({ input: { text: null } });

      const textExpr = createIdentifier('text');
      const startsExpr = createMemberExpr(textExpr, 'startsWith');
      const call = createCallExpr(startsExpr, [createStringLiteral('test')]);

      const result = evaluateExpression(call, ctx);
      expect(result.value === 'unknown' || result.value === false).toBe(true);
    });
  });

  describe('null-safe index access', () => {
    it('should fail gracefully for index on null array', () => {
      const ctx = createContext({ input: { items: null } });

      const itemsExpr = createIdentifier('items');
      const indexExpr = createIndexExpr(itemsExpr, createNumberLiteral(0));

      const result = evaluateExpression(indexExpr, ctx);
      expect(result.value).toBe(false);
    });

    it('should fail gracefully for property access on null object', () => {
      const ctx = createContext({ input: { obj: null } });

      const objExpr = createIdentifier('obj');
      const indexExpr = createIndexExpr(objExpr, createStringLiteral('key'));

      const result = evaluateExpression(indexExpr, ctx);
      expect(result.value).toBe(false);
    });
  });
});

// ============================================================================
// ADDITIONAL ARITHMETIC EDGE CASES
// ============================================================================

describe('Arithmetic edge cases', () => {
  it('should handle very large numbers', () => {
    const expr = createBinaryExpr('+', createNumberLiteral(Number.MAX_SAFE_INTEGER), createNumberLiteral(1));
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle very small numbers', () => {
    const expr = createBinaryExpr('-', createNumberLiteral(Number.MIN_SAFE_INTEGER), createNumberLiteral(1));
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle floating point precision', () => {
    const sum = createBinaryExpr('+', createNumberLiteral(0.1), createNumberLiteral(0.2));
    const expr = createBinaryExpr('<', sum, createNumberLiteral(0.4));
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle negative modulo', () => {
    const expr = createBinaryExpr('%', createNumberLiteral(-10), createNumberLiteral(3));
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle chained arithmetic: a + b - c * d / e', () => {
    const ctx = createContext();
    ctx.variables.set('a', 10);
    ctx.variables.set('b', 5);
    ctx.variables.set('c', 3);
    ctx.variables.set('d', 4);
    ctx.variables.set('e', 2);

    const mul = createBinaryExpr('*', createIdentifier('c'), createIdentifier('d'));
    const div = createBinaryExpr('/', mul, createIdentifier('e'));
    const add = createBinaryExpr('+', createIdentifier('a'), createIdentifier('b'));
    const sub = createBinaryExpr('-', add, div);
    const expr = createBinaryExpr('==', sub, createNumberLiteral(9));

    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// ADDITIONAL STRING EDGE CASES
// ============================================================================

describe('String edge cases', () => {
  it('should handle empty string contains empty string', () => {
    const str = createStringLiteral('');
    const member = createMemberExpr(str, 'contains');
    const call = createCallExpr(member, [createStringLiteral('')]);
    const result = evaluateExpression(call, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle unicode strings', () => {
    const str = createStringLiteral('héllo 世界');
    const member = createMemberExpr(str, 'contains');
    const call = createCallExpr(member, [createStringLiteral('世界')]);
    const result = evaluateExpression(call, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle special characters in strings', () => {
    const str = createStringLiteral('hello\nworld\ttab');
    const member = createMemberExpr(str, 'contains');
    const call = createCallExpr(member, [createStringLiteral('\n')]);
    const result = evaluateExpression(call, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle very long strings', () => {
    const longStr = 'a'.repeat(10000);
    const str = createStringLiteral(longStr);
    const member = createMemberExpr(str, 'startsWith');
    const call = createCallExpr(member, [createStringLiteral('a')]);
    const result = evaluateExpression(call, createContext());
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// ADDITIONAL ARRAY EDGE CASES
// ============================================================================

describe('Array edge cases', () => {
  it('should handle nested arrays', () => {
    const ctx = createContext({ input: { matrix: [[1, 2], [3, 4]] } });

    const matrixExpr = createIdentifier('matrix');
    const firstRow = createIndexExpr(matrixExpr, createNumberLiteral(0));
    const firstElement = createIndexExpr(firstRow, createNumberLiteral(0));

    const result = evaluateExpression(firstElement, ctx);
    expect(result.value).toBe(true);
  });

  it('should handle array of objects', () => {
    const ctx = createContext({
      input: { users: [{ name: 'Alice' }, { name: 'Bob' }] },
    });

    const usersExpr = createIdentifier('users');
    const firstUser = createIndexExpr(usersExpr, createNumberLiteral(0));
    const nameExpr = createMemberExpr(firstUser, 'name');

    const result = evaluateExpression(nameExpr, ctx);
    expect(result.value).toBe(true);
  });

  it('should handle mixed type arrays', () => {
    const ctx = createContext({
      input: { mixed: [1, 'two', true, null] },
    });

    const mixedExpr = createIdentifier('mixed');
    const containsExpr = createMemberExpr(mixedExpr, 'contains');
    const call = createCallExpr(containsExpr, [createStringLiteral('two')]);

    const result = evaluateExpression(call, ctx);
    expect(result.value).toBe(true);
  });

  it('should handle array length comparison with arithmetic', () => {
    const ctx = createContext({ input: { items: [1, 2, 3, 4, 5] } });

    const itemsExpr = createIdentifier('items');
    const lengthExpr = createMemberExpr(itemsExpr, 'length');
    const doubled = createBinaryExpr('*', lengthExpr, createNumberLiteral(2));
    const expr = createBinaryExpr('==', doubled, createNumberLiteral(10));

    const result = evaluateExpression(expr, ctx);
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// BOOLEAN LOGIC EDGE CASES
// ============================================================================

describe('Boolean logic edge cases', () => {
  it('should handle triple negation', () => {
    const not1 = createUnaryExpr('not', createBooleanLiteral(true));
    const not2 = createUnaryExpr('not', not1);
    const not3 = createUnaryExpr('not', not2);

    const result = evaluateExpression(not3, createContext());
    expect(result.value).toBe(false);
  });

  it('should handle De Morgan: not (A and B) == (not A) or (not B)', () => {
    const a = createBooleanLiteral(true);
    const b = createBooleanLiteral(false);

    const andExpr = createBinaryExpr('and', a, b);
    const notAnd = createUnaryExpr('not', andExpr);

    const notA = createUnaryExpr('not', createBooleanLiteral(true));
    const notB = createUnaryExpr('not', createBooleanLiteral(false));
    const orNotNot = createBinaryExpr('or', notA, notB);

    const result1 = evaluateExpression(notAnd, createContext());
    const result2 = evaluateExpression(orNotNot, createContext());

    expect(result1.value).toBe(result2.value);
  });

  it('should handle complex boolean: (A implies B) iff (not A or B)', () => {
    const a = createBooleanLiteral(true);
    const b = createBooleanLiteral(false);

    const impliesExpr = createBinaryExpr('implies', a, b);
    const notA = createUnaryExpr('not', createBooleanLiteral(true));
    const orExpr = createBinaryExpr('or', notA, createBooleanLiteral(false));

    const result1 = evaluateExpression(impliesExpr, createContext());
    const result2 = evaluateExpression(orExpr, createContext());

    expect(result1.value).toBe(result2.value);
  });

  it('should handle iff with non-boolean values', () => {
    const expr = createBinaryExpr('iff', createNumberLiteral(0), createStringLiteral(''));
    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });
});

// ============================================================================
// QUANTIFIER EDGE CASES
// ============================================================================

describe('Quantifier edge cases', () => {
  it('should handle all with single element true', () => {
    const collection = createListExpr([createBooleanLiteral(true)]);
    const predicate = createIdentifier('x');
    const expr = createQuantifierExpr('all', 'x', collection, predicate);

    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });

  it('should handle all with single element false predicate', () => {
    const collection = createListExpr([createNumberLiteral(5)]);
    // Predicate: x < 0 (always false for positive numbers)
    const predicate = createBinaryExpr('<', createIdentifier('x'), createNumberLiteral(0));
    const expr = createQuantifierExpr('all', 'x', collection, predicate);

    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(false);
  });

  it('should handle any with all elements failing predicate', () => {
    const collection = createListExpr([
      createNumberLiteral(1),
      createNumberLiteral(2),
      createNumberLiteral(3),
    ]);
    // Predicate: x > 10 (always false for 1,2,3)
    const predicate = createBinaryExpr('>', createIdentifier('x'), createNumberLiteral(10));
    const expr = createQuantifierExpr('any', 'x', collection, predicate);

    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(false);
  });

  it('should handle quantifier with complex predicate', () => {
    const collection = createListExpr([
      createNumberLiteral(10),
      createNumberLiteral(20),
      createNumberLiteral(30),
    ]);
    const predicate = createBinaryExpr(
      'and',
      createBinaryExpr('>=', createIdentifier('x'), createNumberLiteral(10)),
      createBinaryExpr('<=', createIdentifier('x'), createNumberLiteral(30))
    );
    const expr = createQuantifierExpr('all', 'x', collection, predicate);

    const result = evaluateExpression(expr, createContext());
    expect(result.value).toBe(true);
  });
});
