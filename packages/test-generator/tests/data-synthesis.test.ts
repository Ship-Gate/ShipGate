// ============================================================================
// Data Synthesis Tests
// Tests for constraint-aware input data generation
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  synthesizeInputs,
  generateSeed,
  SeededRandom,
  extractConstraints,
} from '../src/data-synthesizer';
import type * as AST from '@isl-lang/parser';

// ============================================================================
// TEST HELPERS
// ============================================================================

function mockLocation(): AST.SourceLocation {
  return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
}

function createDomain(
  name: string,
  behaviors: AST.Behavior[],
  entities: AST.Entity[] = [],
  types: AST.TypeAlias[] = []
): AST.Domain {
  return {
    kind: 'Domain',
    name: { kind: 'Identifier', name, location: mockLocation() },
    version: { kind: 'StringLiteral', value: '1.0.0', location: mockLocation() },
    imports: [],
    types,
    entities,
    behaviors,
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: mockLocation(),
  };
}

function createBehavior(
  name: string,
  fields: AST.Field[],
  preconditions: AST.Expression[] = [],
  postconditions: AST.PostconditionBlock[] = [],
  errors: AST.ErrorSpec[] = []
): AST.Behavior {
  return {
    kind: 'Behavior',
    name: { kind: 'Identifier', name, location: mockLocation() },
    description: { kind: 'StringLiteral', value: `${name} behavior`, location: mockLocation() },
    input: {
      kind: 'InputSpec',
      fields,
      location: mockLocation(),
    },
    output: {
      kind: 'OutputSpec',
      success: { kind: 'PrimitiveType', name: 'Boolean', location: mockLocation() },
      errors,
      location: mockLocation(),
    },
    preconditions,
    postconditions,
    invariants: [],
    temporal: [],
    security: [],
    compliance: [],
    location: mockLocation(),
  };
}

function createField(
  name: string,
  type: AST.TypeDefinition,
  optional = false
): AST.Field {
  return {
    kind: 'Field',
    name: { kind: 'Identifier', name, location: mockLocation() },
    type,
    optional,
    annotations: [],
    location: mockLocation(),
  };
}

function primitiveType(name: AST.PrimitiveType['name']): AST.PrimitiveType {
  return { kind: 'PrimitiveType', name, location: mockLocation() };
}

function constrainedType(
  base: AST.TypeDefinition,
  constraints: Array<{ name: string; value: AST.Expression }>
): AST.ConstrainedType {
  return {
    kind: 'ConstrainedType',
    base,
    constraints: constraints.map(c => ({
      name: c.name,
      value: c.value,
    })),
    location: mockLocation(),
  };
}

function numberLiteral(value: number): AST.NumberLiteral {
  return { kind: 'NumberLiteral', value, isFloat: value % 1 !== 0, location: mockLocation() };
}

function stringLiteral(value: string): AST.StringLiteral {
  return { kind: 'StringLiteral', value, location: mockLocation() };
}

// ============================================================================
// SEEDED RANDOM TESTS
// ============================================================================

describe('SeededRandom', () => {
  it('should produce deterministic sequences', () => {
    const rng1 = new SeededRandom(12345);
    const rng2 = new SeededRandom(12345);

    const seq1 = [rng1.next(), rng1.next(), rng1.next()];
    const seq2 = [rng2.next(), rng2.next(), rng2.next()];

    expect(seq1).toEqual(seq2);
  });

  it('should produce different sequences for different seeds', () => {
    const rng1 = new SeededRandom(12345);
    const rng2 = new SeededRandom(54321);

    expect(rng1.next()).not.toBe(rng2.next());
  });

  it('should generate integers in range', () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      const value = rng.int(10, 20);
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThanOrEqual(20);
    }
  });

  it('should generate strings of specified length', () => {
    const rng = new SeededRandom(42);

    const str = rng.string(10);
    expect(str.length).toBe(10);
  });
});

describe('generateSeed', () => {
  it('should generate same seed for same input', () => {
    expect(generateSeed('Login')).toBe(generateSeed('Login'));
  });

  it('should generate different seeds for different inputs', () => {
    expect(generateSeed('Login')).not.toBe(generateSeed('Logout'));
  });
});

// ============================================================================
// INPUT SYNTHESIS TESTS
// ============================================================================

describe('synthesizeInputs', () => {
  it('should generate valid inputs for simple types', () => {
    const behavior = createBehavior('TestBehavior', [
      createField('name', primitiveType('String')),
      createField('age', primitiveType('Int')),
    ]);
    const domain = createDomain('TestDomain', [behavior]);

    const inputs = synthesizeInputs(behavior, domain);

    // Should have valid inputs
    const validInputs = inputs.filter(i => i.category === 'valid');
    expect(validInputs.length).toBeGreaterThan(0);

    // Check that values are populated
    for (const input of validInputs) {
      expect(input.values.name).toBeDefined();
      expect(input.values.age).toBeDefined();
      expect(typeof input.values.name).toBe('string');
      expect(typeof input.values.age).toBe('number');
    }
  });

  it('should respect numeric constraints', () => {
    const amountType = constrainedType(primitiveType('Decimal'), [
      { name: 'min', value: numberLiteral(0) },
      { name: 'max', value: numberLiteral(1000) },
    ]);

    const behavior = createBehavior('Payment', [
      createField('amount', amountType),
    ]);
    const domain = createDomain('Payments', [behavior]);

    const inputs = synthesizeInputs(behavior, domain);

    const validInputs = inputs.filter(i => i.category === 'valid');
    for (const input of validInputs) {
      const amount = input.values.amount as number;
      expect(amount).toBeGreaterThanOrEqual(0);
      expect(amount).toBeLessThanOrEqual(1000);
    }
  });

  it('should respect string length constraints', () => {
    const usernameType = constrainedType(primitiveType('String'), [
      { name: 'min_length', value: numberLiteral(3) },
      { name: 'max_length', value: numberLiteral(20) },
    ]);

    const behavior = createBehavior('CreateUser', [
      createField('username', usernameType),
    ]);
    const domain = createDomain('Users', [behavior]);

    const inputs = synthesizeInputs(behavior, domain);

    const validInputs = inputs.filter(i => i.category === 'valid');
    for (const input of validInputs) {
      const username = input.values.username as string;
      expect(username.length).toBeGreaterThanOrEqual(3);
      expect(username.length).toBeLessThanOrEqual(20);
    }
  });

  it('should generate boundary values', () => {
    const amountType = constrainedType(primitiveType('Int'), [
      { name: 'min', value: numberLiteral(1) },
      { name: 'max', value: numberLiteral(100) },
    ]);

    const behavior = createBehavior('Quantity', [
      createField('quantity', amountType),
    ]);
    const domain = createDomain('Orders', [behavior]);

    const inputs = synthesizeInputs(behavior, domain, { includeBoundary: true });

    const boundaryInputs = inputs.filter(i => i.category === 'boundary');
    expect(boundaryInputs.length).toBeGreaterThan(0);

    // Should have min and max boundary tests
    const quantities = boundaryInputs.map(i => i.values.quantity as number);
    expect(quantities).toContain(1);   // min
    expect(quantities).toContain(100); // max
  });

  it('should generate invalid inputs', () => {
    const amountType = constrainedType(primitiveType('Int'), [
      { name: 'min', value: numberLiteral(1) },
      { name: 'max', value: numberLiteral(100) },
    ]);

    const behavior = createBehavior('Quantity', [
      createField('quantity', amountType),
    ]);
    const domain = createDomain('Orders', [behavior]);

    const inputs = synthesizeInputs(behavior, domain, { includeInvalid: true });

    const invalidInputs = inputs.filter(i => i.category === 'invalid');
    expect(invalidInputs.length).toBeGreaterThan(0);

    // Should have below-min and above-max tests
    const quantities = invalidInputs
      .filter(i => typeof i.values.quantity === 'number')
      .map(i => i.values.quantity as number);
    
    expect(quantities.some(q => q < 1)).toBe(true);   // below min
    expect(quantities.some(q => q > 100)).toBe(true); // above max
  });

  it('should include data trace for reproducibility', () => {
    const behavior = createBehavior('Test', [
      createField('value', primitiveType('String')),
    ]);
    const domain = createDomain('Test', [behavior]);

    const inputs = synthesizeInputs(behavior, domain, { seed: 42 });

    for (const input of inputs) {
      expect(input.dataTrace).toBeDefined();
      expect(input.dataTrace.seed).toBe(42);
      expect(input.dataTrace.strategy).toBeDefined();
      expect(input.dataTrace.generatedAt).toBeDefined();
    }
  });

  it('should be deterministic with same seed', () => {
    const behavior = createBehavior('Test', [
      createField('value', primitiveType('String')),
      createField('number', primitiveType('Int')),
    ]);
    const domain = createDomain('Test', [behavior]);

    const inputs1 = synthesizeInputs(behavior, domain, { seed: 12345 });
    const inputs2 = synthesizeInputs(behavior, domain, { seed: 12345 });

    // Same seed should produce same values
    expect(inputs1.length).toBe(inputs2.length);
    for (let i = 0; i < inputs1.length; i++) {
      expect(inputs1[i]!.values).toEqual(inputs2[i]!.values);
    }
  });

  it('should generate email format strings', () => {
    const emailType = constrainedType(primitiveType('String'), [
      { name: 'format', value: stringLiteral('email') },
    ]);

    const behavior = createBehavior('Register', [
      createField('email', emailType),
    ]);
    const domain = createDomain('Auth', [behavior]);

    const inputs = synthesizeInputs(behavior, domain);

    const validInputs = inputs.filter(i => i.category === 'valid');
    for (const input of validInputs) {
      const email = input.values.email as string;
      expect(email).toContain('@');
      expect(email).toContain('.');
    }
  });
});

// ============================================================================
// PRECONDITION VIOLATION TESTS
// ============================================================================

describe('Precondition Violations', () => {
  it('should generate inputs that violate preconditions', () => {
    const precondition: AST.BinaryExpr = {
      kind: 'BinaryExpr',
      operator: '>',
      left: {
        kind: 'InputExpr',
        property: { kind: 'Identifier', name: 'amount', location: mockLocation() },
        location: mockLocation(),
      },
      right: numberLiteral(0),
      location: mockLocation(),
    };

    const behavior = createBehavior(
      'CreatePayment',
      [createField('amount', primitiveType('Decimal'))],
      [precondition]
    );
    const domain = createDomain('Payments', [behavior]);

    const inputs = synthesizeInputs(behavior, domain, {
      includePreconditionViolations: true,
    });

    const violations = inputs.filter(i => i.category === 'precondition_violation');
    expect(violations.length).toBeGreaterThan(0);

    // Should have a violation with amount <= 0
    const amounts = violations.map(v => v.values.amount as number);
    expect(amounts.some(a => a <= 0)).toBe(true);
  });
});

// ============================================================================
// SNAPSHOT TESTS
// ============================================================================

describe('Snapshot Tests', () => {
  it('should generate consistent output for Login behavior', () => {
    const emailType = constrainedType(primitiveType('String'), [
      { name: 'format', value: stringLiteral('email') },
      { name: 'max_length', value: numberLiteral(254) },
    ]);

    const passwordType = constrainedType(primitiveType('String'), [
      { name: 'min_length', value: numberLiteral(8) },
      { name: 'max_length', value: numberLiteral(128) },
    ]);

    const preconditions: AST.Expression[] = [
      {
        kind: 'MemberExpr',
        object: {
          kind: 'InputExpr',
          property: { kind: 'Identifier', name: 'email', location: mockLocation() },
          location: mockLocation(),
        },
        property: { kind: 'Identifier', name: 'is_valid_format', location: mockLocation() },
        location: mockLocation(),
      },
      {
        kind: 'BinaryExpr',
        operator: '>=',
        left: {
          kind: 'MemberExpr',
          object: {
            kind: 'InputExpr',
            property: { kind: 'Identifier', name: 'password', location: mockLocation() },
            location: mockLocation(),
          },
          property: { kind: 'Identifier', name: 'length', location: mockLocation() },
          location: mockLocation(),
        },
        right: numberLiteral(8),
        location: mockLocation(),
      },
    ];

    const errors: AST.ErrorSpec[] = [
      {
        kind: 'ErrorSpec',
        name: { kind: 'Identifier', name: 'INVALID_CREDENTIALS', location: mockLocation() },
        when: stringLiteral('Email or password is incorrect'),
        retriable: true,
        location: mockLocation(),
      },
    ];

    const behavior = createBehavior(
      'Login',
      [
        createField('email', emailType),
        createField('password', passwordType),
        createField('ip_address', primitiveType('String')),
      ],
      preconditions,
      [],
      errors
    );
    const domain = createDomain('Auth', [behavior]);

    const inputs = synthesizeInputs(behavior, domain, { seed: 42 });

    // Snapshot the structure
    expect(inputs.length).toBeGreaterThan(0);
    
    // Check categories are present
    const categories = new Set(inputs.map(i => i.category));
    expect(categories.has('valid')).toBe(true);
    expect(categories.has('boundary')).toBe(true);
    expect(categories.has('invalid')).toBe(true);

    // Validate data traces
    for (const input of inputs) {
      expect(input.dataTrace.seed).toBe(42);
      expect(input.dataTrace.constraints.length).toBeGreaterThan(0);
    }
  });

  it('should generate consistent output for Payment behavior', () => {
    const amountType = constrainedType(primitiveType('Decimal'), [
      { name: 'min', value: numberLiteral(0) },
      { name: 'precision', value: numberLiteral(2) },
    ]);

    const preconditions: AST.Expression[] = [
      {
        kind: 'BinaryExpr',
        operator: '>',
        left: {
          kind: 'InputExpr',
          property: { kind: 'Identifier', name: 'amount', location: mockLocation() },
          location: mockLocation(),
        },
        right: numberLiteral(0),
        location: mockLocation(),
      },
    ];

    const behavior = createBehavior(
      'CreateCharge',
      [
        createField('amount', amountType),
        createField('currency', primitiveType('String')),
        createField('idempotency_key', primitiveType('String')),
      ],
      preconditions
    );
    const domain = createDomain('Payments', [behavior]);

    const inputs = synthesizeInputs(behavior, domain, { seed: 42 });

    // All valid amounts should be positive
    const validInputs = inputs.filter(i => i.category === 'valid');
    for (const input of validInputs) {
      expect(input.values.amount).toBeGreaterThan(0);
    }

    // Precondition violations should have non-positive amounts
    const violations = inputs.filter(i => i.category === 'precondition_violation');
    for (const violation of violations) {
      expect(violation.values.amount).toBeLessThanOrEqual(0);
    }
  });
});
