// ============================================================================
// Verifier Runtime Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type * as AST from '../../../master_contracts/ast';
import {
  verify,
  createEntityStore,
  buildMockImplementation,
  evaluate,
  generateInputs,
  checkPreconditions,
  checkPostconditions,
  determineOutcome,
  generateReport,
  type EvaluationContext,
  type EntityStore,
} from '../src';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createSourceLocation = (): AST.SourceLocation => ({
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
});

const createIdentifier = (name: string): AST.Identifier => ({
  kind: 'Identifier',
  name,
  location: createSourceLocation(),
});

const createNumberLiteral = (value: number): AST.NumberLiteral => ({
  kind: 'NumberLiteral',
  value,
  isFloat: value % 1 !== 0,
  location: createSourceLocation(),
});

const createBooleanLiteral = (value: boolean): AST.BooleanLiteral => ({
  kind: 'BooleanLiteral',
  value,
  location: createSourceLocation(),
});

const createBinaryExpr = (
  left: AST.Expression,
  operator: AST.BinaryOperator,
  right: AST.Expression
): AST.BinaryExpr => ({
  kind: 'BinaryExpr',
  operator,
  left,
  right,
  location: createSourceLocation(),
});

const createMinimalDomain = (): AST.Domain => ({
  kind: 'Domain',
  name: createIdentifier('TestDomain'),
  version: { kind: 'StringLiteral', value: '1.0.0', location: createSourceLocation() },
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      name: createIdentifier('User'),
      fields: [
        {
          kind: 'Field',
          name: createIdentifier('id'),
          type: { kind: 'PrimitiveType', name: 'UUID', location: createSourceLocation() },
          optional: false,
          annotations: [],
          location: createSourceLocation(),
        },
        {
          kind: 'Field',
          name: createIdentifier('email'),
          type: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
          optional: false,
          annotations: [],
          location: createSourceLocation(),
        },
        {
          kind: 'Field',
          name: createIdentifier('active'),
          type: { kind: 'PrimitiveType', name: 'Boolean', location: createSourceLocation() },
          optional: false,
          annotations: [],
          location: createSourceLocation(),
        },
      ],
      invariants: [],
      location: createSourceLocation(),
    },
  ],
  behaviors: [
    {
      kind: 'Behavior',
      name: createIdentifier('CreateUser'),
      input: {
        kind: 'InputSpec',
        fields: [
          {
            kind: 'Field',
            name: createIdentifier('email'),
            type: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
            optional: false,
            annotations: [],
            location: createSourceLocation(),
          },
        ],
        location: createSourceLocation(),
      },
      output: {
        kind: 'OutputSpec',
        success: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [createIdentifier('User')], location: createSourceLocation() }, location: createSourceLocation() },
        errors: [],
        location: createSourceLocation(),
      },
      preconditions: [
        // input.email.length > 0
        createBinaryExpr(
          {
            kind: 'MemberExpr',
            object: {
              kind: 'MemberExpr',
              object: createIdentifier('input'),
              property: createIdentifier('email'),
              location: createSourceLocation(),
            },
            property: createIdentifier('length'),
            location: createSourceLocation(),
          },
          '>',
          createNumberLiteral(0)
        ),
      ],
      postconditions: [
        {
          kind: 'PostconditionBlock',
          condition: 'success',
          predicates: [
            // result.email == input.email
            createBinaryExpr(
              {
                kind: 'MemberExpr',
                object: createIdentifier('result'),
                property: createIdentifier('email'),
                location: createSourceLocation(),
              },
              '==',
              {
                kind: 'MemberExpr',
                object: createIdentifier('input'),
                property: createIdentifier('email'),
                location: createSourceLocation(),
              }
            ),
          ],
          location: createSourceLocation(),
        },
      ],
      invariants: [],
      temporal: [],
      security: [],
      compliance: [],
      location: createSourceLocation(),
    },
  ],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
  location: createSourceLocation(),
});

// ============================================================================
// EXPRESSION EVALUATION TESTS
// ============================================================================

describe('Expression Evaluation', () => {
  let store: EntityStore;
  let ctx: EvaluationContext;
  let domain: AST.Domain;

  beforeEach(() => {
    store = createEntityStore();
    domain = createMinimalDomain();
    ctx = {
      input: { email: 'test@example.com', count: 5 },
      result: { id: 'user-123', email: 'test@example.com' },
      store,
      domain,
      now: new Date(),
      variables: new Map(),
    };
  });

  describe('Literals', () => {
    it('should evaluate number literals', () => {
      const expr = createNumberLiteral(42);
      expect(evaluate(expr, ctx)).toBe(42);
    });

    it('should evaluate boolean literals', () => {
      const trueExpr = createBooleanLiteral(true);
      const falseExpr = createBooleanLiteral(false);
      expect(evaluate(trueExpr, ctx)).toBe(true);
      expect(evaluate(falseExpr, ctx)).toBe(false);
    });

    it('should evaluate string literals', () => {
      const expr: AST.StringLiteral = {
        kind: 'StringLiteral',
        value: 'hello',
        location: createSourceLocation(),
      };
      expect(evaluate(expr, ctx)).toBe('hello');
    });
  });

  describe('Binary Expressions', () => {
    it('should evaluate equality', () => {
      const expr = createBinaryExpr(
        createNumberLiteral(5),
        '==',
        createNumberLiteral(5)
      );
      expect(evaluate(expr, ctx)).toBe(true);
    });

    it('should evaluate inequality', () => {
      const expr = createBinaryExpr(
        createNumberLiteral(5),
        '!=',
        createNumberLiteral(3)
      );
      expect(evaluate(expr, ctx)).toBe(true);
    });

    it('should evaluate comparison operators', () => {
      expect(evaluate(createBinaryExpr(createNumberLiteral(5), '<', createNumberLiteral(10)), ctx)).toBe(true);
      expect(evaluate(createBinaryExpr(createNumberLiteral(5), '>', createNumberLiteral(3)), ctx)).toBe(true);
      expect(evaluate(createBinaryExpr(createNumberLiteral(5), '<=', createNumberLiteral(5)), ctx)).toBe(true);
      expect(evaluate(createBinaryExpr(createNumberLiteral(5), '>=', createNumberLiteral(5)), ctx)).toBe(true);
    });

    it('should evaluate logical operators', () => {
      expect(evaluate(createBinaryExpr(createBooleanLiteral(true), 'and', createBooleanLiteral(true)), ctx)).toBe(true);
      expect(evaluate(createBinaryExpr(createBooleanLiteral(true), 'and', createBooleanLiteral(false)), ctx)).toBe(false);
      expect(evaluate(createBinaryExpr(createBooleanLiteral(false), 'or', createBooleanLiteral(true)), ctx)).toBe(true);
      expect(evaluate(createBinaryExpr(createBooleanLiteral(false), 'or', createBooleanLiteral(false)), ctx)).toBe(false);
    });

    it('should evaluate implies operator', () => {
      // false implies anything is true
      expect(evaluate(createBinaryExpr(createBooleanLiteral(false), 'implies', createBooleanLiteral(false)), ctx)).toBe(true);
      expect(evaluate(createBinaryExpr(createBooleanLiteral(false), 'implies', createBooleanLiteral(true)), ctx)).toBe(true);
      // true implies true is true
      expect(evaluate(createBinaryExpr(createBooleanLiteral(true), 'implies', createBooleanLiteral(true)), ctx)).toBe(true);
      // true implies false is false
      expect(evaluate(createBinaryExpr(createBooleanLiteral(true), 'implies', createBooleanLiteral(false)), ctx)).toBe(false);
    });

    it('should evaluate arithmetic operators', () => {
      expect(evaluate(createBinaryExpr(createNumberLiteral(5), '+', createNumberLiteral(3)), ctx)).toBe(8);
      expect(evaluate(createBinaryExpr(createNumberLiteral(5), '-', createNumberLiteral(3)), ctx)).toBe(2);
      expect(evaluate(createBinaryExpr(createNumberLiteral(5), '*', createNumberLiteral(3)), ctx)).toBe(15);
      expect(evaluate(createBinaryExpr(createNumberLiteral(6), '/', createNumberLiteral(2)), ctx)).toBe(3);
      expect(evaluate(createBinaryExpr(createNumberLiteral(7), '%', createNumberLiteral(3)), ctx)).toBe(1);
    });
  });

  describe('Member Expressions', () => {
    it('should access input properties', () => {
      const expr: AST.MemberExpr = {
        kind: 'MemberExpr',
        object: createIdentifier('input'),
        property: createIdentifier('email'),
        location: createSourceLocation(),
      };
      expect(evaluate(expr, ctx)).toBe('test@example.com');
    });

    it('should access result properties', () => {
      const expr: AST.MemberExpr = {
        kind: 'MemberExpr',
        object: createIdentifier('result'),
        property: createIdentifier('id'),
        location: createSourceLocation(),
      };
      expect(evaluate(expr, ctx)).toBe('user-123');
    });
  });

  describe('Quantifier Expressions', () => {
    it('should evaluate all quantifier', () => {
      ctx.variables.set('numbers', [2, 4, 6, 8]);
      
      const expr: AST.QuantifierExpr = {
        kind: 'QuantifierExpr',
        quantifier: 'all',
        variable: createIdentifier('n'),
        collection: createIdentifier('numbers'),
        predicate: createBinaryExpr(
          createBinaryExpr(createIdentifier('n'), '%', createNumberLiteral(2)),
          '==',
          createNumberLiteral(0)
        ),
        location: createSourceLocation(),
      };
      
      expect(evaluate(expr, ctx)).toBe(true);
    });

    it('should evaluate any quantifier', () => {
      ctx.variables.set('numbers', [1, 3, 5, 6]);
      
      const expr: AST.QuantifierExpr = {
        kind: 'QuantifierExpr',
        quantifier: 'any',
        variable: createIdentifier('n'),
        collection: createIdentifier('numbers'),
        predicate: createBinaryExpr(
          createBinaryExpr(createIdentifier('n'), '%', createNumberLiteral(2)),
          '==',
          createNumberLiteral(0)
        ),
        location: createSourceLocation(),
      };
      
      expect(evaluate(expr, ctx)).toBe(true);
    });

    it('should evaluate count quantifier', () => {
      ctx.variables.set('numbers', [1, 2, 3, 4, 5, 6]);
      
      const expr: AST.QuantifierExpr = {
        kind: 'QuantifierExpr',
        quantifier: 'count',
        variable: createIdentifier('n'),
        collection: createIdentifier('numbers'),
        predicate: createBinaryExpr(
          createBinaryExpr(createIdentifier('n'), '%', createNumberLiteral(2)),
          '==',
          createNumberLiteral(0)
        ),
        location: createSourceLocation(),
      };
      
      expect(evaluate(expr, ctx)).toBe(3);
    });
  });
});

// ============================================================================
// INPUT GENERATION TESTS
// ============================================================================

describe('Input Generation', () => {
  it('should generate valid inputs', () => {
    const domain = createMinimalDomain();
    const behavior = domain.behaviors[0]!;
    
    const inputs = generateInputs(behavior, domain);
    
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.some(i => i.category === 'valid')).toBe(true);
  });

  it('should generate boundary inputs', () => {
    const domain = createMinimalDomain();
    const behavior = domain.behaviors[0]!;
    
    const inputs = generateInputs(behavior, domain);
    
    expect(inputs.some(i => i.category === 'boundary')).toBe(true);
  });

  it('should generate invalid inputs', () => {
    const domain = createMinimalDomain();
    const behavior = domain.behaviors[0]!;
    
    const inputs = generateInputs(behavior, domain);
    
    expect(inputs.some(i => i.category === 'invalid')).toBe(true);
  });
});

// ============================================================================
// PRECONDITION TESTS
// ============================================================================

describe('Precondition Checking', () => {
  it('should pass valid preconditions', () => {
    const domain = createMinimalDomain();
    const behavior = domain.behaviors[0]!;
    const store = createEntityStore();
    
    const ctx: EvaluationContext = {
      input: { email: 'test@example.com' },
      store,
      domain,
      now: new Date(),
      variables: new Map(),
    };
    
    const results = checkPreconditions(behavior, ctx);
    
    expect(results.every(r => r.passed)).toBe(true);
  });

  it('should fail invalid preconditions', () => {
    const domain = createMinimalDomain();
    const behavior = domain.behaviors[0]!;
    const store = createEntityStore();
    
    const ctx: EvaluationContext = {
      input: { email: '' }, // Empty email should fail length > 0
      store,
      domain,
      now: new Date(),
      variables: new Map(),
    };
    
    const results = checkPreconditions(behavior, ctx);
    
    expect(results.some(r => !r.passed)).toBe(true);
  });
});

// ============================================================================
// POSTCONDITION TESTS
// ============================================================================

describe('Postcondition Checking', () => {
  it('should check postconditions on success', () => {
    const domain = createMinimalDomain();
    const behavior = domain.behaviors[0]!;
    const store = createEntityStore();
    
    const ctx: EvaluationContext = {
      input: { email: 'test@example.com' },
      result: { id: 'user-123', email: 'test@example.com' },
      store,
      domain,
      now: new Date(),
      variables: new Map(),
    };
    
    const outcome = determineOutcome(ctx.result, undefined);
    const results = checkPostconditions(behavior, ctx, outcome);
    
    expect(results.every(r => r.passed)).toBe(true);
  });

  it('should fail when result does not match input', () => {
    const domain = createMinimalDomain();
    const behavior = domain.behaviors[0]!;
    const store = createEntityStore();
    
    const ctx: EvaluationContext = {
      input: { email: 'test@example.com' },
      result: { id: 'user-123', email: 'different@example.com' }, // Mismatch!
      store,
      domain,
      now: new Date(),
      variables: new Map(),
    };
    
    const outcome = determineOutcome(ctx.result, undefined);
    const results = checkPostconditions(behavior, ctx, outcome);
    
    expect(results.some(r => !r.passed)).toBe(true);
  });
});

// ============================================================================
// VERIFY TESTS
// ============================================================================

describe('Verification', () => {
  it('should verify a successful implementation', async () => {
    const domain = createMinimalDomain();
    const store = createEntityStore();
    
    const implementation = buildMockImplementation(
      async (input) => ({
        id: 'user-123',
        email: input.email,
        active: true,
      }),
      store
    );
    
    const result = await verify(implementation, domain, 'CreateUser', {
      input: { email: 'test@example.com' },
    });
    
    expect(result.success).toBe(true);
    expect(result.verdict).toBe('verified');
    expect(result.score).toBeGreaterThan(80);
  });

  it('should fail verification when postcondition fails', async () => {
    const domain = createMinimalDomain();
    const store = createEntityStore();
    
    const implementation = buildMockImplementation(
      async (_input) => ({
        id: 'user-123',
        email: 'wrong@example.com', // Wrong email!
        active: true,
      }),
      store
    );
    
    const result = await verify(implementation, domain, 'CreateUser', {
      input: { email: 'test@example.com' },
    });
    
    expect(result.success).toBe(false);
    expect(result.postconditions.some(p => !p.passed)).toBe(true);
  });

  it('should skip execution when preconditions fail', async () => {
    const domain = createMinimalDomain();
    const store = createEntityStore();
    
    const implementation = buildMockImplementation(
      async (input) => ({
        id: 'user-123',
        email: input.email,
        active: true,
      }),
      store
    );
    
    const result = await verify(implementation, domain, 'CreateUser', {
      input: { email: '' }, // Empty email fails precondition
    });
    
    expect(result.success).toBe(false);
    expect(result.preconditions.some(p => !p.passed)).toBe(true);
    expect(result.execution.error?.code).toBe('PRECONDITION_FAILED');
  });
});

// ============================================================================
// REPORTER TESTS
// ============================================================================

describe('Report Generation', () => {
  it('should generate text report', async () => {
    const domain = createMinimalDomain();
    const store = createEntityStore();
    
    const implementation = buildMockImplementation(
      async (input) => ({
        id: 'user-123',
        email: input.email,
        active: true,
      }),
      store
    );
    
    const result = await verify(implementation, domain, 'CreateUser', {
      input: { email: 'test@example.com' },
    });
    
    const report = generateReport(result, { format: 'text' });
    
    expect(report).toContain('Verification Report');
    expect(report).toContain('CreateUser');
    expect(report).toContain('verified');
  });

  it('should generate JSON report', async () => {
    const domain = createMinimalDomain();
    const store = createEntityStore();
    
    const implementation = buildMockImplementation(
      async (input) => ({
        id: 'user-123',
        email: input.email,
        active: true,
      }),
      store
    );
    
    const result = await verify(implementation, domain, 'CreateUser', {
      input: { email: 'test@example.com' },
    });
    
    const report = generateReport(result, { format: 'json' });
    const parsed = JSON.parse(report);
    
    expect(parsed.behaviorName).toBe('CreateUser');
    expect(parsed.success).toBe(true);
  });

  it('should generate markdown report', async () => {
    const domain = createMinimalDomain();
    const store = createEntityStore();
    
    const implementation = buildMockImplementation(
      async (input) => ({
        id: 'user-123',
        email: input.email,
        active: true,
      }),
      store
    );
    
    const result = await verify(implementation, domain, 'CreateUser', {
      input: { email: 'test@example.com' },
    });
    
    const report = generateReport(result, { format: 'markdown' });
    
    expect(report).toContain('# Verification Report');
    expect(report).toContain('CreateUser');
    expect(report).toContain('| Metric | Value |');
  });
});

// ============================================================================
// ENTITY STORE TESTS
// ============================================================================

describe('Entity Store', () => {
  let store: EntityStore;

  beforeEach(() => {
    store = createEntityStore();
  });

  it('should create and retrieve entities', () => {
    const user = store.create('User', {
      email: 'test@example.com',
      active: true,
    });
    
    expect(user.__entity__).toBe('User');
    expect(user.__id__).toBeDefined();
    expect(user.email).toBe('test@example.com');
    
    const found = store.lookup('User', { email: 'test@example.com' });
    expect(found).toEqual(user);
  });

  it('should count entities', () => {
    store.create('User', { email: 'a@example.com', active: true });
    store.create('User', { email: 'b@example.com', active: false });
    store.create('User', { email: 'c@example.com', active: true });
    
    expect(store.count('User')).toBe(3);
    expect(store.count('User', { active: true })).toBe(2);
  });

  it('should snapshot and restore state', () => {
    store.create('User', { email: 'test@example.com', active: true });
    
    const snapshot = store.snapshot();
    
    store.create('User', { email: 'new@example.com', active: true });
    expect(store.count('User')).toBe(2);
    
    store.restore(snapshot);
    expect(store.count('User')).toBe(1);
  });

  it('should update entities', () => {
    const user = store.create('User', {
      id: 'user-123',
      email: 'test@example.com',
      active: true,
    });
    
    store.update('User', user.__id__, { active: false });
    
    const updated = store.lookup('User', { id: 'user-123' });
    expect(updated?.active).toBe(false);
  });

  it('should delete entities', () => {
    const user = store.create('User', {
      email: 'test@example.com',
      active: true,
    });
    
    expect(store.exists('User', { email: 'test@example.com' })).toBe(true);
    
    store.delete('User', user.__id__);
    
    expect(store.exists('User', { email: 'test@example.com' })).toBe(false);
  });
});
