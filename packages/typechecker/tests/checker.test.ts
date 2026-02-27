// ============================================================================
// Type Checker Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { check, TypeChecker, ErrorCodes, typeToString, BOOLEAN_TYPE, STRING_TYPE, INT_TYPE } from '../src';

// Helper to create a minimal source location
const loc = (line = 1, col = 1) => ({
  file: 'test.isl',
  line,
  column: col,
  endLine: line,
  endColumn: col + 10,
});

// Helper to create identifier
const id = (name: string, line = 1) => ({
  kind: 'Identifier' as const,
  name,
  location: loc(line),
});

// Helper to create string literal
const str = (value: string) => ({
  kind: 'StringLiteral' as const,
  value,
  location: loc(),
});

// Minimal domain factory
function createDomain(overrides: Partial<{
  types: unknown[];
  entities: unknown[];
  behaviors: unknown[];
  invariants: unknown[];
  policies: unknown[];
  views: unknown[];
  scenarios: unknown[];
}> = {}) {
  return {
    kind: 'Domain',
    name: id('TestDomain'),
    version: str('1.0.0'),
    imports: [],
    types: overrides.types || [],
    entities: overrides.entities || [],
    behaviors: overrides.behaviors || [],
    invariants: overrides.invariants || [],
    policies: overrides.policies || [],
    views: overrides.views || [],
    scenarios: overrides.scenarios || [],
    chaos: [],
    location: loc(),
  };
}

describe('TypeChecker', () => {
  describe('basic functionality', () => {
    it('should check an empty domain successfully', () => {
      const domain = createDomain();
      const result = check(domain);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('should have built-in types in symbol table', () => {
      const domain = createDomain();
      const result = check(domain);

      expect(result.symbolTable.lookup('String')).toBeDefined();
      expect(result.symbolTable.lookup('Int')).toBeDefined();
      expect(result.symbolTable.lookup('Boolean')).toBeDefined();
      expect(result.symbolTable.lookup('Decimal')).toBeDefined();
      expect(result.symbolTable.lookup('Timestamp')).toBeDefined();
      expect(result.symbolTable.lookup('UUID')).toBeDefined();
      expect(result.symbolTable.lookup('Duration')).toBeDefined();
    });
  });

  describe('type declarations', () => {
    it('should register type declarations', () => {
      const domain = createDomain({
        types: [{
          kind: 'TypeDeclaration',
          name: id('Email'),
          definition: {
            kind: 'ConstrainedType',
            base: { kind: 'PrimitiveType', name: 'String', location: loc() },
            constraints: [
              { name: 'format', value: { kind: 'StringLiteral', value: 'email', location: loc() } }
            ],
            location: loc(),
          },
          annotations: [],
          location: loc(),
        }],
      });

      const result = check(domain);

      expect(result.success).toBe(true);
      const emailSymbol = result.symbolTable.lookup('Email');
      expect(emailSymbol).toBeDefined();
      expect(emailSymbol?.kind).toBe('type');
    });

    it('should detect duplicate type declarations', () => {
      const domain = createDomain({
        types: [
          {
            kind: 'TypeDeclaration',
            name: id('Email', 1),
            definition: { kind: 'PrimitiveType', name: 'String', location: loc(1) },
            annotations: [],
            location: loc(1),
          },
          {
            kind: 'TypeDeclaration',
            name: id('Email', 5),
            definition: { kind: 'PrimitiveType', name: 'String', location: loc(5) },
            annotations: [],
            location: loc(5),
          },
        ],
      });

      const result = check(domain);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === ErrorCodes.DUPLICATE_TYPE)).toBe(true);
    });
  });

  describe('entity declarations', () => {
    it('should register entity declarations with fields', () => {
      const domain = createDomain({
        entities: [{
          kind: 'Entity',
          name: id('User'),
          fields: [
            {
              kind: 'Field',
              name: id('id'),
              type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
              optional: false,
              annotations: [],
              location: loc(2),
            },
            {
              kind: 'Field',
              name: id('name'),
              type: { kind: 'PrimitiveType', name: 'String', location: loc() },
              optional: false,
              annotations: [],
              location: loc(3),
            },
            {
              kind: 'Field',
              name: id('email'),
              type: { kind: 'PrimitiveType', name: 'String', location: loc() },
              optional: true,
              annotations: [],
              location: loc(4),
            },
          ],
          invariants: [],
          location: loc(),
        }],
      });

      const result = check(domain);

      expect(result.success).toBe(true);
      
      const userSymbol = result.symbolTable.lookup('User');
      expect(userSymbol).toBeDefined();
      expect(userSymbol?.kind).toBe('entity');
      
      if (userSymbol?.type.kind === 'entity') {
        expect(userSymbol.type.fields.has('id')).toBe(true);
        expect(userSymbol.type.fields.has('name')).toBe(true);
        expect(userSymbol.type.fields.has('email')).toBe(true);
      }
    });

    it('should detect duplicate entity declarations', () => {
      const domain = createDomain({
        entities: [
          {
            kind: 'Entity',
            name: id('User', 1),
            fields: [],
            invariants: [],
            location: loc(1),
          },
          {
            kind: 'Entity',
            name: id('User', 10),
            fields: [],
            invariants: [],
            location: loc(10),
          },
        ],
      });

      const result = check(domain);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === ErrorCodes.DUPLICATE_ENTITY)).toBe(true);
    });

    it('should detect duplicate fields in entity', () => {
      const domain = createDomain({
        entities: [{
          kind: 'Entity',
          name: id('User'),
          fields: [
            {
              kind: 'Field',
              name: id('email', 2),
              type: { kind: 'PrimitiveType', name: 'String', location: loc(2) },
              optional: false,
              annotations: [],
              location: loc(2),
            },
            {
              kind: 'Field',
              name: id('email', 3),
              type: { kind: 'PrimitiveType', name: 'String', location: loc(3) },
              optional: false,
              annotations: [],
              location: loc(3),
            },
          ],
          invariants: [],
          location: loc(),
        }],
      });

      const result = check(domain);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === ErrorCodes.DUPLICATE_FIELD)).toBe(true);
    });
  });

  describe('behavior declarations', () => {
    it('should register behavior declarations', () => {
      const domain = createDomain({
        behaviors: [{
          kind: 'Behavior',
          name: id('CreateUser'),
          description: str('Create a new user'),
          input: {
            kind: 'InputSpec',
            fields: [
              {
                kind: 'Field',
                name: id('name'),
                type: { kind: 'PrimitiveType', name: 'String', location: loc() },
                optional: false,
                annotations: [],
                location: loc(),
              },
            ],
            location: loc(),
          },
          output: {
            kind: 'OutputSpec',
            success: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
            errors: [],
            location: loc(),
          },
          preconditions: [],
          postconditions: [],
          invariants: [],
          temporal: [],
          security: [],
          compliance: [],
          location: loc(),
        }],
      });

      const result = check(domain);

      expect(result.success).toBe(true);
      
      const behaviorSymbol = result.symbolTable.lookup('CreateUser');
      expect(behaviorSymbol).toBeDefined();
      expect(behaviorSymbol?.kind).toBe('behavior');
    });

    it('should detect duplicate behavior declarations', () => {
      const domain = createDomain({
        behaviors: [
          {
            kind: 'Behavior',
            name: id('DoThing', 1),
            input: { kind: 'InputSpec', fields: [], location: loc(1) },
            output: { kind: 'OutputSpec', success: { kind: 'PrimitiveType', name: 'Boolean', location: loc() }, errors: [], location: loc() },
            preconditions: [],
            postconditions: [],
            invariants: [],
            temporal: [],
            security: [],
            compliance: [],
            location: loc(1),
          },
          {
            kind: 'Behavior',
            name: id('DoThing', 10),
            input: { kind: 'InputSpec', fields: [], location: loc(10) },
            output: { kind: 'OutputSpec', success: { kind: 'PrimitiveType', name: 'Boolean', location: loc() }, errors: [], location: loc() },
            preconditions: [],
            postconditions: [],
            invariants: [],
            temporal: [],
            security: [],
            compliance: [],
            location: loc(10),
          },
        ],
      });

      const result = check(domain);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === ErrorCodes.DUPLICATE_BEHAVIOR)).toBe(true);
    });
  });

  describe('expression type checking', () => {
    it('should check binary operators have compatible types', () => {
      const domain = createDomain({
        behaviors: [{
          kind: 'Behavior',
          name: id('TestBehavior'),
          input: {
            kind: 'InputSpec',
            fields: [
              {
                kind: 'Field',
                name: id('value'),
                type: { kind: 'PrimitiveType', name: 'Int', location: loc() },
                optional: false,
                annotations: [],
                location: loc(),
              },
            ],
            location: loc(),
          },
          output: {
            kind: 'OutputSpec',
            success: { kind: 'PrimitiveType', name: 'Boolean', location: loc() },
            errors: [],
            location: loc(),
          },
          preconditions: [
            {
              kind: 'BinaryExpr',
              operator: '>',
              left: { kind: 'Identifier', name: 'value', location: loc() },
              right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: loc() },
              location: loc(),
            },
          ],
          postconditions: [],
          invariants: [],
          temporal: [],
          security: [],
          compliance: [],
          location: loc(),
        }],
      });

      const result = check(domain);

      expect(result.success).toBe(true);
    });

    it('should error when logical operators are used with non-boolean types', () => {
      const domain = createDomain({
        behaviors: [{
          kind: 'Behavior',
          name: id('TestBehavior'),
          input: {
            kind: 'InputSpec',
            fields: [
              {
                kind: 'Field',
                name: id('value'),
                type: { kind: 'PrimitiveType', name: 'Int', location: loc() },
                optional: false,
                annotations: [],
                location: loc(),
              },
            ],
            location: loc(),
          },
          output: {
            kind: 'OutputSpec',
            success: { kind: 'PrimitiveType', name: 'Boolean', location: loc() },
            errors: [],
            location: loc(),
          },
          preconditions: [
            {
              kind: 'BinaryExpr',
              operator: 'and',
              left: { kind: 'Identifier', name: 'value', location: loc() },
              right: { kind: 'BooleanLiteral', value: true, location: loc() },
              location: loc(),
            },
          ],
          postconditions: [],
          invariants: [],
          temporal: [],
          security: [],
          compliance: [],
          location: loc(),
        }],
      });

      const result = check(domain);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === ErrorCodes.TYPE_MISMATCH)).toBe(true);
    });
  });

  describe('postcondition context', () => {
    it('should allow old() in postconditions', () => {
      const domain = createDomain({
        entities: [{
          kind: 'Entity',
          name: id('Counter'),
          fields: [
            {
              kind: 'Field',
              name: id('value'),
              type: { kind: 'PrimitiveType', name: 'Int', location: loc() },
              optional: false,
              annotations: [],
              location: loc(),
            },
          ],
          invariants: [],
          location: loc(),
        }],
        behaviors: [{
          kind: 'Behavior',
          name: id('Increment'),
          input: {
            kind: 'InputSpec',
            fields: [],
            location: loc(),
          },
          output: {
            kind: 'OutputSpec',
            success: { kind: 'PrimitiveType', name: 'Int', location: loc() },
            errors: [],
            location: loc(),
          },
          preconditions: [],
          postconditions: [{
            kind: 'PostconditionBlock',
            condition: 'success',
            predicates: [
              {
                kind: 'BinaryExpr',
                operator: '==',
                left: { kind: 'ResultExpr', location: loc() },
                right: {
                  kind: 'BinaryExpr',
                  operator: '+',
                  left: {
                    kind: 'OldExpr',
                    expression: {
                      kind: 'MemberExpr',
                      object: { kind: 'Identifier', name: 'Counter', location: loc() },
                      property: id('value'),
                      location: loc(),
                    },
                    location: loc(),
                  },
                  right: { kind: 'NumberLiteral', value: 1, isFloat: false, location: loc() },
                  location: loc(),
                },
                location: loc(),
              },
            ],
            location: loc(),
          }],
          invariants: [],
          temporal: [],
          security: [],
          compliance: [],
          location: loc(),
        }],
      });

      const result = check(domain);

      // May have errors if Counter.value resolution fails, but old() itself should be valid
      const oldErrors = result.diagnostics.filter(d => d.code === ErrorCodes.OLD_OUTSIDE_POSTCONDITION);
      expect(oldErrors).toHaveLength(0);
    });

    it('should error when old() is used outside postconditions', () => {
      const domain = createDomain({
        behaviors: [{
          kind: 'Behavior',
          name: id('TestBehavior'),
          input: { kind: 'InputSpec', fields: [], location: loc() },
          output: {
            kind: 'OutputSpec',
            success: { kind: 'PrimitiveType', name: 'Boolean', location: loc() },
            errors: [],
            location: loc(),
          },
          preconditions: [
            {
              kind: 'OldExpr',
              expression: { kind: 'Identifier', name: 'someValue', location: loc() },
              location: loc(),
            },
          ],
          postconditions: [],
          invariants: [],
          temporal: [],
          security: [],
          compliance: [],
          location: loc(),
        }],
      });

      const result = check(domain);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === ErrorCodes.OLD_OUTSIDE_POSTCONDITION)).toBe(true);
    });

    it('should error when result is used outside postconditions', () => {
      const domain = createDomain({
        behaviors: [{
          kind: 'Behavior',
          name: id('TestBehavior'),
          input: { kind: 'InputSpec', fields: [], location: loc() },
          output: {
            kind: 'OutputSpec',
            success: { kind: 'PrimitiveType', name: 'Boolean', location: loc() },
            errors: [],
            location: loc(),
          },
          preconditions: [
            {
              kind: 'ResultExpr',
              location: loc(),
            },
          ],
          postconditions: [],
          invariants: [],
          temporal: [],
          security: [],
          compliance: [],
          location: loc(),
        }],
      });

      const result = check(domain);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === ErrorCodes.RESULT_OUTSIDE_POSTCONDITION)).toBe(true);
    });
  });

  describe('lifecycle states', () => {
    it('should validate lifecycle state transitions', () => {
      const domain = createDomain({
        entities: [{
          kind: 'Entity',
          name: id('Order'),
          fields: [
            {
              kind: 'Field',
              name: id('status'),
              type: { kind: 'PrimitiveType', name: 'String', location: loc() },
              optional: false,
              annotations: [],
              location: loc(),
            },
          ],
          invariants: [],
          lifecycle: {
            kind: 'LifecycleSpec',
            transitions: [
              { kind: 'LifecycleTransition', from: id('pending'), to: id('confirmed'), location: loc() },
              { kind: 'LifecycleTransition', from: id('confirmed'), to: id('shipped'), location: loc() },
              { kind: 'LifecycleTransition', from: id('shipped'), to: id('delivered'), location: loc() },
            ],
            location: loc(),
          },
          location: loc(),
        }],
      });

      const result = check(domain);

      expect(result.success).toBe(true);
      
      const orderSymbol = result.symbolTable.lookup('Order');
      expect(orderSymbol?.type.kind).toBe('entity');
      if (orderSymbol?.type.kind === 'entity') {
        expect(orderSymbol.type.lifecycleStates).toContain('pending');
        expect(orderSymbol.type.lifecycleStates).toContain('confirmed');
        expect(orderSymbol.type.lifecycleStates).toContain('shipped');
        expect(orderSymbol.type.lifecycleStates).toContain('delivered');
      }
    });
  });

  describe('undefined reference errors', () => {
    it('should error on undefined type references', () => {
      const domain = createDomain({
        entities: [{
          kind: 'Entity',
          name: id('User'),
          fields: [
            {
              kind: 'Field',
              name: id('address'),
              type: {
                kind: 'ReferenceType',
                name: { kind: 'QualifiedName', parts: [id('Address')], location: loc() },
                location: loc(),
              },
              optional: false,
              annotations: [],
              location: loc(),
            },
          ],
          invariants: [],
          location: loc(),
        }],
      });

      const result = check(domain);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === ErrorCodes.UNDEFINED_TYPE)).toBe(true);
    });

    it('should error on undefined variable references', () => {
      const domain = createDomain({
        behaviors: [{
          kind: 'Behavior',
          name: id('TestBehavior'),
          input: { kind: 'InputSpec', fields: [], location: loc() },
          output: {
            kind: 'OutputSpec',
            success: { kind: 'PrimitiveType', name: 'Boolean', location: loc() },
            errors: [],
            location: loc(),
          },
          preconditions: [
            {
              kind: 'BinaryExpr',
              operator: '>',
              left: { kind: 'Identifier', name: 'unknownVar', location: loc() },
              right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: loc() },
              location: loc(),
            },
          ],
          postconditions: [],
          invariants: [],
          temporal: [],
          security: [],
          compliance: [],
          location: loc(),
        }],
      });

      const result = check(domain);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === ErrorCodes.UNDEFINED_VARIABLE)).toBe(true);
    });
  });

  describe('type utilities', () => {
    it('should convert types to strings correctly', () => {
      expect(typeToString(BOOLEAN_TYPE)).toBe('Boolean');
      expect(typeToString(STRING_TYPE)).toBe('String');
      expect(typeToString(INT_TYPE)).toBe('Int');
      expect(typeToString({ kind: 'list', element: STRING_TYPE })).toBe('List<String>');
      expect(typeToString({ kind: 'optional', inner: INT_TYPE })).toBe('Int?');
      expect(typeToString({ kind: 'map', key: STRING_TYPE, value: INT_TYPE })).toBe('Map<String, Int>');
    });
  });
});

describe('TypeChecker class', () => {
  it('should be instantiable', () => {
    const checker = new TypeChecker();
    expect(checker).toBeDefined();
  });

  it('should produce same results when called multiple times', () => {
    const domain = createDomain({
      types: [{
        kind: 'TypeDeclaration',
        name: id('Email'),
        definition: { kind: 'PrimitiveType', name: 'String', location: loc() },
        annotations: [],
        location: loc(),
      }],
    });

    const checker1 = new TypeChecker();
    const result1 = checker1.check(domain);

    const checker2 = new TypeChecker();
    const result2 = checker2.check(domain);

    expect(result1.success).toBe(result2.success);
    expect(result1.diagnostics.length).toBe(result2.diagnostics.length);
  });
});
