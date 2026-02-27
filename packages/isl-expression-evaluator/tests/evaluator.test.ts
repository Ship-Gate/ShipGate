// ============================================================================
// ISL Expression Evaluator - Unit Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import type { Expression } from '@isl-lang/parser';
import { evaluate, createContext, createAdapter, type TriState } from '../src/index.js';

// Helper to create a simple source location
function loc(line: number = 1, column: number = 1): { file: string; line: number; column: number; endLine: number; endColumn: number } {
  return { file: 'test.isl', line, column, endLine: line, endColumn: column + 10 };
}

// Helper to create expressions
function bool(value: boolean): Expression {
  return { kind: 'BooleanLiteral', value, location: loc() };
}

function str(value: string): Expression {
  return { kind: 'StringLiteral', value, location: loc() };
}

function num(value: number): Expression {
  return { kind: 'NumberLiteral', value, isFloat: false, location: loc() };
}

function nullLit(): Expression {
  return { kind: 'NullLiteral', location: loc() };
}

function id(name: string): Expression {
  return { kind: 'Identifier', name, location: loc() };
}

function bin(op: string, left: Expression, right: Expression): Expression {
  return {
    kind: 'BinaryExpr',
    operator: op as any,
    left,
    right,
    location: loc(),
  };
}

function unary(op: string, operand: Expression): Expression {
  return {
    kind: 'UnaryExpr',
    operator: op as any,
    operand,
    location: loc(),
  };
}

function call(callee: Expression, args: Expression[] = []): Expression {
  return {
    kind: 'CallExpr',
    callee,
    arguments: args,
    location: loc(),
  };
}

function member(object: Expression, property: string): Expression {
  return {
    kind: 'MemberExpr',
    object,
    property: id(property) as any,
    location: loc(),
  };
}

function list(elements: Expression[]): Expression {
  return {
    kind: 'ListExpr',
    elements,
    location: loc(),
  };
}

function quantifier(quant: 'all' | 'any', variable: string, collection: Expression, predicate: Expression): Expression {
  return {
    kind: 'QuantifierExpr',
    quantifier: quant,
    variable: id(variable) as any,
    collection,
    predicate,
    location: loc(),
  };
}

describe('Expression Evaluator', () => {
  describe('Literals', () => {
    it('should evaluate boolean true', () => {
      const result = evaluate(bool(true), createContext());
      expect(result.value).toBe('true');
    });

    it('should evaluate boolean false', () => {
      const result = evaluate(bool(false), createContext());
      expect(result.value).toBe('false');
    });

    it('should evaluate string literal', () => {
      const result = evaluate(str('hello'), createContext());
      expect(result.value).toBe('true');
    });

    it('should evaluate number literal', () => {
      const result = evaluate(num(42), createContext());
      expect(result.value).toBe('true');
    });

    it('should evaluate null literal', () => {
      const result = evaluate(nullLit(), createContext());
      expect(result.value).toBe('false');
    });
  });

  describe('Comparison Operators', () => {
    it('should evaluate == with equal numbers', () => {
      const result = evaluate(bin('==', num(5), num(5)), createContext());
      expect(result.value).toBe('true');
    });

    it('should evaluate == with unequal numbers', () => {
      const result = evaluate(bin('==', num(5), num(10)), createContext());
      expect(result.value).toBe('false');
    });

    it('should evaluate != with unequal numbers', () => {
      const result = evaluate(bin('!=', num(5), num(10)), createContext());
      expect(result.value).toBe('true');
    });

    it('should evaluate < correctly', () => {
      expect(evaluate(bin('<', num(3), num(5)), createContext()).value).toBe('true');
      expect(evaluate(bin('<', num(5), num(3)), createContext()).value).toBe('false');
      expect(evaluate(bin('<', num(5), num(5)), createContext()).value).toBe('false');
    });

    it('should evaluate <= correctly', () => {
      expect(evaluate(bin('<=', num(3), num(5)), createContext()).value).toBe('true');
      expect(evaluate(bin('<=', num(5), num(5)), createContext()).value).toBe('true');
      expect(evaluate(bin('<=', num(5), num(3)), createContext()).value).toBe('false');
    });

    it('should evaluate > correctly', () => {
      expect(evaluate(bin('>', num(5), num(3)), createContext()).value).toBe('true');
      expect(evaluate(bin('>', num(3), num(5)), createContext()).value).toBe('false');
      expect(evaluate(bin('>', num(5), num(5)), createContext()).value).toBe('false');
    });

    it('should evaluate >= correctly', () => {
      expect(evaluate(bin('>=', num(5), num(3)), createContext()).value).toBe('true');
      expect(evaluate(bin('>=', num(5), num(5)), createContext()).value).toBe('true');
      expect(evaluate(bin('>=', num(3), num(5)), createContext()).value).toBe('false');
    });
  });

  describe('Logical Operators', () => {
    it('should evaluate && with both true', () => {
      const result = evaluate(bin('and', bool(true), bool(true)), createContext());
      expect(result.value).toBe('true');
    });

    it('should evaluate && with one false', () => {
      expect(evaluate(bin('and', bool(true), bool(false)), createContext()).value).toBe('false');
      expect(evaluate(bin('and', bool(false), bool(true)), createContext()).value).toBe('false');
    });

    it('should evaluate && with both false', () => {
      const result = evaluate(bin('and', bool(false), bool(false)), createContext());
      expect(result.value).toBe('false');
    });

    it('should evaluate || with both true', () => {
      const result = evaluate(bin('or', bool(true), bool(true)), createContext());
      expect(result.value).toBe('true');
    });

    it('should evaluate || with one true', () => {
      expect(evaluate(bin('or', bool(true), bool(false)), createContext()).value).toBe('true');
      expect(evaluate(bin('or', bool(false), bool(true)), createContext()).value).toBe('true');
    });

    it('should evaluate || with both false', () => {
      const result = evaluate(bin('or', bool(false), bool(false)), createContext());
      expect(result.value).toBe('false');
    });

    it('should evaluate ! correctly', () => {
      expect(evaluate(unary('not', bool(true)), createContext()).value).toBe('false');
      expect(evaluate(unary('not', bool(false)), createContext()).value).toBe('true');
    });

    it('should evaluate implies correctly', () => {
      // false implies anything is true
      expect(evaluate(bin('implies', bool(false), bool(false)), createContext()).value).toBe('true');
      expect(evaluate(bin('implies', bool(false), bool(true)), createContext()).value).toBe('true');
      // true implies true is true
      expect(evaluate(bin('implies', bool(true), bool(true)), createContext()).value).toBe('true');
      // true implies false is false
      expect(evaluate(bin('implies', bool(true), bool(false)), createContext()).value).toBe('false');
    });
  });

  describe('Tri-State Logic', () => {
    it('should propagate unknown from identifiers', () => {
      const result = evaluate(id('unknownVar'), createContext());
      expect(result.value).toBe('unknown');
    });

    it('should propagate unknown in &&', () => {
      expect(evaluate(bin('and', bool(true), id('unknown')), createContext()).value).toBe('unknown');
      expect(evaluate(bin('and', bool(false), id('unknown')), createContext()).value).toBe('false');
      expect(evaluate(bin('and', id('unknown'), bool(true)), createContext()).value).toBe('unknown');
    });

    it('should propagate unknown in ||', () => {
      expect(evaluate(bin('or', bool(false), id('unknown')), createContext()).value).toBe('unknown');
      expect(evaluate(bin('or', bool(true), id('unknown')), createContext()).value).toBe('true');
      expect(evaluate(bin('or', id('unknown'), bool(false)), createContext()).value).toBe('unknown');
    });

    it('should propagate unknown in !', () => {
      const result = evaluate(unary('not', id('unknown')), createContext());
      expect(result.value).toBe('unknown');
    });

    it('should propagate unknown in implies', () => {
      expect(evaluate(bin('implies', bool(true), id('unknown')), createContext()).value).toBe('unknown');
      expect(evaluate(bin('implies', id('unknown'), bool(true)), createContext()).value).toBe('unknown');
      expect(evaluate(bin('implies', bool(false), id('unknown')), createContext()).value).toBe('true');
    });

    it('should propagate unknown in comparisons', () => {
      expect(evaluate(bin('==', id('unknown'), num(5)), createContext()).value).toBe('unknown');
      expect(evaluate(bin('<', id('unknown'), num(5)), createContext()).value).toBe('unknown');
    });
  });

  describe('Variables', () => {
    it('should evaluate variable from context', () => {
      const context = createContext({
        variables: new Map([['x', 42]]),
      });
      const result = evaluate(id('x'), context);
      expect(result.value).toBe('true');
    });

    it('should evaluate boolean variable', () => {
      const context = createContext({
        variables: new Map([['flag', true]]),
      });
      const result = evaluate(id('flag'), context);
      expect(result.value).toBe('true');
    });

    it('should evaluate null variable as false', () => {
      const context = createContext({
        variables: new Map([['x', null]]),
      });
      const result = evaluate(id('x'), context);
      expect(result.value).toBe('false');
    });
  });

  describe('Property Access', () => {
    it('should access property via member expression', () => {
      const adapter = createAdapter({
        getProperty: (obj, prop) => {
          if (typeof obj === 'object' && obj !== null) {
            return (obj as Record<string, unknown>)[prop];
          }
          return 'unknown';
        },
      });
      const context = createContext({ adapter });
      const objExpr = id('user');
      context.variables.set('user', { name: 'Alice', age: 30 });
      
      const result = evaluate(member(objExpr, 'name'), context);
      expect(result.value).toBe('true');
    });

    it('should return unknown for missing property', () => {
      const adapter = createAdapter({
        getProperty: (obj, prop) => {
          if (typeof obj === 'object' && obj !== null && prop in (obj as Record<string, unknown>)) {
            return (obj as Record<string, unknown>)[prop];
          }
          return 'unknown';
        },
      });
      const context = createContext({ adapter });
      context.variables.set('user', { name: 'Alice' });
      
      const result = evaluate(member(id('user'), 'missing'), context);
      expect(result.value).toBe('unknown');
    });
  });

  describe('Function Predicates', () => {
    it('should evaluate is_valid for non-empty string', () => {
      const adapter = createAdapter({
        is_valid: (val) => {
          if (typeof val === 'string') return val.length > 0 ? 'true' : 'false';
          return 'unknown';
        },
      });
      const context = createContext({ adapter });
      context.variables.set('str', 'hello');
      
      const result = evaluate(call(id('is_valid'), [id('str')]), context);
      expect(result.value).toBe('true');
    });

    it('should evaluate is_valid for empty string', () => {
      const adapter = createAdapter({
        is_valid: (val) => {
          if (typeof val === 'string') return val.length > 0 ? 'true' : 'false';
          return 'unknown';
        },
      });
      const context = createContext({ adapter });
      context.variables.set('str', '');
      
      const result = evaluate(call(id('is_valid'), [id('str')]), context);
      expect(result.value).toBe('false');
    });

    it('should evaluate length for string', () => {
      const adapter = createAdapter({
        length: (val) => {
          if (typeof val === 'string') return val.length;
          if (Array.isArray(val)) return val.length;
          return 'unknown';
        },
      });
      const context = createContext({ adapter });
      context.variables.set('str', 'hello');
      
      const result = evaluate(call(id('length'), [id('str')]), context);
      expect(result.value).toBe('true');
    });

    it('should evaluate exists for entity', () => {
      const adapter = createAdapter({
        exists: (entityName, criteria) => {
          if (entityName === 'User' && criteria?.id === '123') {
            return 'true';
          }
          return 'false';
        },
      });
      const context = createContext({ adapter });
      // Store criteria as a variable
      context.variables.set('criteria', { id: '123' });
      
      const result = evaluate(call(id('exists'), [str('User'), id('criteria')]), context);
      expect(result.value).toBe('true');
    });

    it('should evaluate lookup for entity', () => {
      const adapter = createAdapter({
        lookup: (entityName, criteria) => {
          if (entityName === 'User' && criteria?.id === '123') {
            return { id: '123', name: 'Alice' };
          }
          return 'unknown';
        },
      });
      const context = createContext({ adapter });
      // Store criteria as a variable
      context.variables.set('criteria', { id: '123' });
      
      const result = evaluate(call(id('lookup'), [str('User'), id('criteria')]), context);
      expect(result.value).toBe('true');
    });
  });

  describe('Quantifiers', () => {
    it('should evaluate all() with all true', () => {
      const context = createContext();
      context.variables.set('items', [1, 2, 3]);
      
      const result = evaluate(
        quantifier('all', 'item', id('items'), bin('>', id('item'), num(0))),
        context
      );
      expect(result.value).toBe('true');
    });

    it('should evaluate all() with one false', () => {
      const context = createContext();
      context.variables.set('items', [1, 2, -1]);
      
      const result = evaluate(
        quantifier('all', 'item', id('items'), bin('>', id('item'), num(0))),
        context
      );
      expect(result.value).toBe('false');
    });

    it('should evaluate any() with one true', () => {
      const context = createContext();
      context.variables.set('items', [-1, -2, 3]);
      
      const result = evaluate(
        quantifier('any', 'item', id('items'), bin('>', id('item'), num(0))),
        context
      );
      expect(result.value).toBe('true');
    });

    it('should evaluate any() with all false', () => {
      const context = createContext();
      context.variables.set('items', [-1, -2, -3]);
      
      const result = evaluate(
        quantifier('any', 'item', id('items'), bin('>', id('item'), num(0))),
        context
      );
      expect(result.value).toBe('false');
    });

    it('should propagate unknown in quantifiers', () => {
      const context = createContext();
      context.variables.set('items', [1, 'unknown', 3]);
      
      const result = evaluate(
        quantifier('all', 'item', id('items'), bin('>', id('item'), num(0))),
        context
      );
      expect(result.value).toBe('unknown');
    });
  });

  describe('Precedence and Complex Expressions', () => {
    it('should handle nested && and ||', () => {
      const expr = bin('or',
        bin('and', bool(true), bool(false)),
        bin('and', bool(true), bool(true))
      );
      const result = evaluate(expr, createContext());
      expect(result.value).toBe('true');
    });

    it('should handle chained comparisons', () => {
      const expr = bin('and',
        bin('<', num(1), num(5)),
        bin('<', num(5), num(10))
      );
      const result = evaluate(expr, createContext());
      expect(result.value).toBe('true');
    });

    it('should handle implies with comparisons', () => {
      const expr = bin('implies',
        bin('>', num(10), num(5)),
        bin('<', num(3), num(5))
      );
      const result = evaluate(expr, createContext());
      expect(result.value).toBe('true');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty array in quantifier', () => {
      const context = createContext();
      context.variables.set('items', []);
      
      const result = evaluate(
        quantifier('all', 'item', id('items'), bool(true)),
        context
      );
      expect(result.value).toBe('true'); // All on empty is true
    });

    it('should handle empty array in any quantifier', () => {
      const context = createContext();
      context.variables.set('items', []);
      
      const result = evaluate(
        quantifier('any', 'item', id('items'), bool(true)),
        context
      );
      expect(result.value).toBe('false'); // Any on empty is false
    });

    it('should handle result variable', () => {
      const context = createContext({
        result: { success: true },
      });
      
      const result = evaluate(id('result'), context);
      expect(result.value).toBe('true');
    });

    it('should handle input variable', () => {
      const context = createContext({
        input: { userId: '123' },
      });
      
      const result = evaluate(id('userId'), context);
      expect(result.value).toBe('true');
    });
  });

  describe('Performance', () => {
    it('should evaluate 1000 expressions quickly', () => {
      const context = createContext();
      const expressions: Expression[] = [];
      
      for (let i = 0; i < 1000; i++) {
        expressions.push(bin('==', num(i), num(i)));
      }
      
      const start = performance.now();
      for (const expr of expressions) {
        evaluate(expr, context);
      }
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(100); // Should be < 100ms
    });
  });
});
