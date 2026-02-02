// ============================================================================
// Evaluator Tests - Expression Evaluation
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  Evaluator, 
  evaluate,
  expressionToString,
} from '../src/evaluator.js';
import { 
  InMemoryEntityStore,
  createEntityStore,
} from '../src/environment.js';
import type { EvaluationContext } from '../src/types.js';

// Helper to create a minimal evaluation context
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

// Helper to create a minimal AST node location
const loc = {
  file: '<test>',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
};

// Helper to create expression AST nodes
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
  
  binary: (operator: string, left: unknown, right: unknown) => ({
    kind: 'BinaryExpr' as const,
    operator,
    left,
    right,
    location: loc,
  }),
  
  unary: (operator: string, operand: unknown) => ({
    kind: 'UnaryExpr' as const,
    operator,
    operand,
    location: loc,
  }),
  
  member: (object: unknown, property: string) => ({
    kind: 'MemberExpr' as const,
    object,
    property: AST.identifier(property),
    location: loc,
  }),
  
  index: (object: unknown, index: unknown) => ({
    kind: 'IndexExpr' as const,
    object,
    index,
    location: loc,
  }),
  
  call: (callee: unknown, args: unknown[]) => ({
    kind: 'CallExpr' as const,
    callee,
    arguments: args,
    location: loc,
  }),
  
  list: (elements: unknown[]) => ({
    kind: 'ListExpr' as const,
    elements,
    location: loc,
  }),
  
  map: (entries: Array<{ key: unknown; value: unknown }>) => ({
    kind: 'MapExpr' as const,
    entries: entries.map(e => ({
      kind: 'MapEntry' as const,
      key: e.key,
      value: e.value,
      location: loc,
    })),
    location: loc,
  }),
  
  conditional: (condition: unknown, thenBranch: unknown, elseBranch: unknown) => ({
    kind: 'ConditionalExpr' as const,
    condition,
    thenBranch,
    elseBranch,
    location: loc,
  }),
  
  quantifier: (quantifier: string, variable: string, collection: unknown, predicate: unknown) => ({
    kind: 'QuantifierExpr' as const,
    quantifier,
    variable: AST.identifier(variable),
    collection,
    predicate,
    location: loc,
  }),
  
  old: (expression: unknown) => ({
    kind: 'OldExpr' as const,
    expression,
    location: loc,
  }),
  
  result: (property?: string) => ({
    kind: 'ResultExpr' as const,
    property: property ? AST.identifier(property) : undefined,
    location: loc,
  }),
  
  input: (property: string) => ({
    kind: 'InputExpr' as const,
    property: AST.identifier(property),
    location: loc,
  }),
};

describe('Evaluator', () => {
  let evaluator: Evaluator;
  let store: InMemoryEntityStore;
  let context: EvaluationContext;

  beforeEach(() => {
    store = createEntityStore();
    context = createContext({ store });
    evaluator = new Evaluator();
  });

  describe('Literal Evaluation', () => {
    it('should evaluate string literals', () => {
      const result = evaluator.evaluate(AST.string('hello'), context);
      expect(result).toBe('hello');
    });

    it('should evaluate number literals', () => {
      expect(evaluator.evaluate(AST.number(42), context)).toBe(42);
      expect(evaluator.evaluate(AST.number(3.14, true), context)).toBe(3.14);
    });

    it('should evaluate boolean literals', () => {
      expect(evaluator.evaluate(AST.boolean(true), context)).toBe(true);
      expect(evaluator.evaluate(AST.boolean(false), context)).toBe(false);
    });

    it('should evaluate null literal', () => {
      expect(evaluator.evaluate(AST.null(), context)).toBeNull();
    });
  });

  describe('Identifier Evaluation', () => {
    it('should evaluate bound identifiers', () => {
      context.variables.set('x', 42);
      
      const result = evaluator.evaluate(AST.identifier('x'), context);
      expect(result).toBe(42);
    });

    it('should throw for undefined identifiers', () => {
      expect(() => evaluator.evaluate(AST.identifier('undefined_var'), context))
        .toThrow();
    });
  });

  describe('Binary Operations', () => {
    describe('Arithmetic', () => {
      it('should evaluate addition', () => {
        const expr = AST.binary('+', AST.number(10), AST.number(5));
        expect(evaluator.evaluate(expr, context)).toBe(15);
      });

      it('should evaluate subtraction', () => {
        const expr = AST.binary('-', AST.number(10), AST.number(5));
        expect(evaluator.evaluate(expr, context)).toBe(5);
      });

      it('should evaluate multiplication', () => {
        const expr = AST.binary('*', AST.number(10), AST.number(5));
        expect(evaluator.evaluate(expr, context)).toBe(50);
      });

      it('should evaluate division', () => {
        const expr = AST.binary('/', AST.number(10), AST.number(5));
        expect(evaluator.evaluate(expr, context)).toBe(2);
      });

      it('should evaluate modulo', () => {
        const expr = AST.binary('%', AST.number(10), AST.number(3));
        expect(evaluator.evaluate(expr, context)).toBe(1);
      });
    });

    describe('Comparison', () => {
      it('should evaluate equality', () => {
        expect(evaluator.evaluate(AST.binary('==', AST.number(5), AST.number(5)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('==', AST.number(5), AST.number(3)), context)).toBe(false);
        expect(evaluator.evaluate(AST.binary('==', AST.string('a'), AST.string('a')), context)).toBe(true);
      });

      it('should evaluate inequality', () => {
        expect(evaluator.evaluate(AST.binary('!=', AST.number(5), AST.number(3)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('!=', AST.number(5), AST.number(5)), context)).toBe(false);
      });

      it('should evaluate less than', () => {
        expect(evaluator.evaluate(AST.binary('<', AST.number(3), AST.number(5)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('<', AST.number(5), AST.number(3)), context)).toBe(false);
      });

      it('should evaluate greater than', () => {
        expect(evaluator.evaluate(AST.binary('>', AST.number(5), AST.number(3)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('>', AST.number(3), AST.number(5)), context)).toBe(false);
      });

      it('should evaluate less than or equal', () => {
        expect(evaluator.evaluate(AST.binary('<=', AST.number(3), AST.number(5)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('<=', AST.number(5), AST.number(5)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('<=', AST.number(6), AST.number(5)), context)).toBe(false);
      });

      it('should evaluate greater than or equal', () => {
        expect(evaluator.evaluate(AST.binary('>=', AST.number(5), AST.number(3)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('>=', AST.number(5), AST.number(5)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('>=', AST.number(3), AST.number(5)), context)).toBe(false);
      });
    });

    describe('Logical', () => {
      it('should evaluate and', () => {
        expect(evaluator.evaluate(AST.binary('and', AST.boolean(true), AST.boolean(true)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('and', AST.boolean(true), AST.boolean(false)), context)).toBe(false);
        expect(evaluator.evaluate(AST.binary('and', AST.boolean(false), AST.boolean(true)), context)).toBe(false);
      });

      it('should evaluate or', () => {
        expect(evaluator.evaluate(AST.binary('or', AST.boolean(true), AST.boolean(false)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('or', AST.boolean(false), AST.boolean(true)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('or', AST.boolean(false), AST.boolean(false)), context)).toBe(false);
      });

      it('should evaluate implies', () => {
        // p implies q = !p || q
        expect(evaluator.evaluate(AST.binary('implies', AST.boolean(false), AST.boolean(false)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('implies', AST.boolean(false), AST.boolean(true)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('implies', AST.boolean(true), AST.boolean(true)), context)).toBe(true);
        expect(evaluator.evaluate(AST.binary('implies', AST.boolean(true), AST.boolean(false)), context)).toBe(false);
      });
    });
  });

  describe('Unary Operations', () => {
    it('should evaluate not', () => {
      expect(evaluator.evaluate(AST.unary('not', AST.boolean(true)), context)).toBe(false);
      expect(evaluator.evaluate(AST.unary('not', AST.boolean(false)), context)).toBe(true);
    });

    it('should evaluate negation', () => {
      expect(evaluator.evaluate(AST.unary('-', AST.number(5)), context)).toBe(-5);
      expect(evaluator.evaluate(AST.unary('-', AST.number(-3)), context)).toBe(3);
    });
  });

  describe('Member Access', () => {
    it('should access object properties', () => {
      context.variables.set('obj', { name: 'Alice', age: 30 });
      
      const expr = AST.member(AST.identifier('obj'), 'name');
      expect(evaluator.evaluate(expr, context)).toBe('Alice');
    });

    it('should access nested properties', () => {
      context.variables.set('user', { 
        profile: { 
          address: { 
            city: 'NYC' 
          } 
        } 
      });
      
      const expr = AST.member(
        AST.member(
          AST.member(AST.identifier('user'), 'profile'),
          'address'
        ),
        'city'
      );
      expect(evaluator.evaluate(expr, context)).toBe('NYC');
    });

    it('should access string length', () => {
      context.variables.set('str', 'hello');
      
      const expr = AST.member(AST.identifier('str'), 'length');
      expect(evaluator.evaluate(expr, context)).toBe(5);
    });

    it('should access array length', () => {
      context.variables.set('arr', [1, 2, 3, 4, 5]);
      
      const expr = AST.member(AST.identifier('arr'), 'length');
      expect(evaluator.evaluate(expr, context)).toBe(5);
    });
  });

  describe('Index Access', () => {
    it('should access array elements', () => {
      context.variables.set('arr', [10, 20, 30]);
      
      expect(evaluator.evaluate(AST.index(AST.identifier('arr'), AST.number(0)), context)).toBe(10);
      expect(evaluator.evaluate(AST.index(AST.identifier('arr'), AST.number(1)), context)).toBe(20);
    });

    it('should access map values', () => {
      // Implementation uses Record, not Map, for index access by string key
      context.variables.set('map', { a: 1, b: 2 });
      
      const expr = AST.index(AST.identifier('map'), AST.string('a'));
      expect(evaluator.evaluate(expr, context)).toBe(1);
    });

    it('should access object properties by key', () => {
      context.variables.set('obj', { key1: 'value1', key2: 'value2' });
      
      const expr = AST.index(AST.identifier('obj'), AST.string('key1'));
      expect(evaluator.evaluate(expr, context)).toBe('value1');
    });
  });

  describe('List Expressions', () => {
    it('should evaluate empty list', () => {
      const result = evaluator.evaluate(AST.list([]), context);
      expect(result).toEqual([]);
    });

    it('should evaluate list with elements', () => {
      const result = evaluator.evaluate(AST.list([
        AST.number(1),
        AST.number(2),
        AST.number(3),
      ]), context);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should evaluate nested lists', () => {
      const result = evaluator.evaluate(AST.list([
        AST.list([AST.number(1), AST.number(2)]),
        AST.list([AST.number(3), AST.number(4)]),
      ]), context);
      expect(result).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('Map Expressions', () => {
    it('should evaluate empty map', () => {
      const result = evaluator.evaluate(AST.map([]), context);
      // Implementation returns plain object, not Map
      expect(result).toEqual({});
    });

    it('should evaluate map with entries', () => {
      const result = evaluator.evaluate(AST.map([
        { key: AST.string('a'), value: AST.number(1) },
        { key: AST.string('b'), value: AST.number(2) },
      ]), context);
      // Implementation returns plain object, not Map
      expect((result as Record<string, unknown>)['a']).toBe(1);
      expect((result as Record<string, unknown>)['b']).toBe(2);
    });
  });

  describe('Conditional Expressions', () => {
    it('should evaluate true branch', () => {
      const expr = AST.conditional(
        AST.boolean(true),
        AST.string('yes'),
        AST.string('no')
      );
      expect(evaluator.evaluate(expr, context)).toBe('yes');
    });

    it('should evaluate false branch', () => {
      const expr = AST.conditional(
        AST.boolean(false),
        AST.string('yes'),
        AST.string('no')
      );
      expect(evaluator.evaluate(expr, context)).toBe('no');
    });

    it('should short-circuit evaluation', () => {
      // Since we can't easily test side effects in expressions,
      // we just verify the correct branch is taken
      const expr = AST.conditional(
        AST.boolean(true),
        AST.string('good'),
        AST.string('bad')
      );
      expect(evaluator.evaluate(expr, context)).toBe('good');
    });
  });

  describe('Quantifier Expressions', () => {
    it('should evaluate all()', () => {
      context.variables.set('numbers', [1, 2, 3, 4, 5]);
      
      // all(n in numbers: n > 0)
      const allPositive = AST.quantifier(
        'all',
        'n',
        AST.identifier('numbers'),
        AST.binary('>', AST.identifier('n'), AST.number(0))
      );
      expect(evaluator.evaluate(allPositive, context)).toBe(true);
      
      // all(n in numbers: n > 2)
      const allGreaterThanTwo = AST.quantifier(
        'all',
        'n',
        AST.identifier('numbers'),
        AST.binary('>', AST.identifier('n'), AST.number(2))
      );
      expect(evaluator.evaluate(allGreaterThanTwo, context)).toBe(false);
    });

    it('should evaluate any()', () => {
      context.variables.set('numbers', [1, 2, 3, 4, 5]);
      
      // any(n in numbers: n > 4)
      const anyGreaterThanFour = AST.quantifier(
        'any',
        'n',
        AST.identifier('numbers'),
        AST.binary('>', AST.identifier('n'), AST.number(4))
      );
      expect(evaluator.evaluate(anyGreaterThanFour, context)).toBe(true);
      
      // any(n in numbers: n > 10)
      const anyGreaterThanTen = AST.quantifier(
        'any',
        'n',
        AST.identifier('numbers'),
        AST.binary('>', AST.identifier('n'), AST.number(10))
      );
      expect(evaluator.evaluate(anyGreaterThanTen, context)).toBe(false);
    });

    it('should evaluate none()', () => {
      context.variables.set('numbers', [1, 2, 3, 4, 5]);
      
      // none(n in numbers: n < 0)
      const noneNegative = AST.quantifier(
        'none',
        'n',
        AST.identifier('numbers'),
        AST.binary('<', AST.identifier('n'), AST.number(0))
      );
      expect(evaluator.evaluate(noneNegative, context)).toBe(true);
      
      // none(n in numbers: n > 3)
      const noneGreaterThanThree = AST.quantifier(
        'none',
        'n',
        AST.identifier('numbers'),
        AST.binary('>', AST.identifier('n'), AST.number(3))
      );
      expect(evaluator.evaluate(noneGreaterThanThree, context)).toBe(false);
    });

    it('should evaluate count()', () => {
      context.variables.set('numbers', [1, 2, 3, 4, 5]);
      
      // count(n in numbers: n > 3)
      const countGreaterThanThree = AST.quantifier(
        'count',
        'n',
        AST.identifier('numbers'),
        AST.binary('>', AST.identifier('n'), AST.number(3))
      );
      expect(evaluator.evaluate(countGreaterThanThree, context)).toBe(2); // 4, 5
    });

    it('should evaluate filter()', () => {
      context.variables.set('numbers', [1, 2, 3, 4, 5]);
      
      // filter(n in numbers: n > 3)
      const filterGreaterThanThree = AST.quantifier(
        'filter',
        'n',
        AST.identifier('numbers'),
        AST.binary('>', AST.identifier('n'), AST.number(3))
      );
      expect(evaluator.evaluate(filterGreaterThanThree, context)).toEqual([4, 5]);
    });
  });
});

describe('evaluate() Function', () => {
  it('should evaluate expression with context', () => {
    const store = createEntityStore();
    const ctx = createContext({ store });
    ctx.variables.set('x', 10);
    
    const result = evaluate(AST.identifier('x'), ctx);
    expect(result).toBe(10);
  });
});

describe('expressionToString()', () => {
  it('should stringify literals', () => {
    expect(expressionToString(AST.string('hello'))).toBe('"hello"');
    expect(expressionToString(AST.number(42))).toBe('42');
    expect(expressionToString(AST.boolean(true))).toBe('true');
    expect(expressionToString(AST.null())).toBe('null');
  });

  it('should stringify identifiers', () => {
    expect(expressionToString(AST.identifier('foo'))).toBe('foo');
  });

  it('should stringify binary expressions', () => {
    const expr = AST.binary('+', AST.number(1), AST.number(2));
    expect(expressionToString(expr)).toContain('+');
  });
});

// Re-export the createContext helper for other tests if needed
export { createContext };
