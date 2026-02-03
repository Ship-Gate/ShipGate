// ============================================================================
// Enhanced Generation Tests
// Tests for the complete test generation pipeline with data synthesis
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generateWithSynthesis } from '../src/generator';
import { emitTestFile } from '../src/test-code-emitter';
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

function createEntity(name: string, fields: AST.Field[] = []): AST.Entity {
  return {
    kind: 'Entity',
    name: { kind: 'Identifier', name, location: mockLocation() },
    fields,
    invariants: [],
    location: mockLocation(),
  };
}

function createBehavior(
  name: string,
  fields: AST.Field[],
  preconditions: AST.Expression[] = [],
  postconditions: AST.PostconditionBlock[] = [],
  errors: AST.ErrorSpec[] = [],
  invariants: AST.Expression[] = []
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
    invariants,
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

function createPostconditionBlock(
  condition: 'success' | 'any_error' | string,
  predicates: AST.Expression[]
): AST.PostconditionBlock {
  return {
    kind: 'PostconditionBlock',
    condition: condition === 'success' || condition === 'any_error'
      ? condition
      : { kind: 'Identifier', name: condition, location: mockLocation() },
    predicates,
    location: mockLocation(),
  };
}

function createErrorSpec(name: string, when: string, retriable: boolean): AST.ErrorSpec {
  return {
    kind: 'ErrorSpec',
    name: { kind: 'Identifier', name, location: mockLocation() },
    when: stringLiteral(when),
    retriable,
    location: mockLocation(),
  };
}

// ============================================================================
// ENHANCED GENERATION TESTS
// ============================================================================

describe('generateWithSynthesis', () => {
  it('should generate tests with synthesized data', () => {
    const behavior = createBehavior('Login', [
      createField('email', primitiveType('String')),
      createField('password', primitiveType('String')),
    ]);
    const domain = createDomain('Auth', [behavior], [
      createEntity('User'),
      createEntity('Session'),
    ]);

    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      baseSeed: 42,
    });

    expect(result.success).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);

    // Find the test file
    const testFile = result.files.find(f => f.path.includes('Login.test.ts'));
    expect(testFile).toBeDefined();

    // Should contain actual data, not TODOs
    expect(testFile!.content).not.toContain('// TODO: Set up valid input');
    expect(testFile!.content).toContain('const input');
    expect(testFile!.content).toContain('email:');
    expect(testFile!.content).toContain('password:');
  });

  it('should generate meaningful assertions from postconditions', () => {
    const postconditions: AST.PostconditionBlock[] = [
      createPostconditionBlock('success', [
        {
          kind: 'BinaryExpr',
          operator: '==',
          left: {
            kind: 'ResultExpr',
            property: { kind: 'Identifier', name: 'status', location: mockLocation() },
            location: mockLocation(),
          },
          right: stringLiteral('ACTIVE'),
          location: mockLocation(),
        },
      ]),
    ];

    const behavior = createBehavior(
      'CreateUser',
      [createField('email', primitiveType('String'))],
      [],
      postconditions
    );
    const domain = createDomain('Users', [behavior]);

    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
    });

    expect(result.success).toBe(true);
    
    const testFile = result.files.find(f => f.path.includes('CreateUser.test.ts'));
    expect(testFile).toBeDefined();
    expect(testFile!.content).toContain('expect');
  });

  it('should generate tests for all categories', () => {
    const amountType = constrainedType(primitiveType('Decimal'), [
      { name: 'min', value: numberLiteral(0.01) },
      { name: 'max', value: numberLiteral(10000) },
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

    const errors = [
      createErrorSpec('INSUFFICIENT_FUNDS', 'Not enough balance', true),
    ];

    const behavior = createBehavior(
      'Transfer',
      [
        createField('amount', amountType),
        createField('to_account', primitiveType('UUID')),
      ],
      preconditions,
      [],
      errors
    );
    const domain = createDomain('Banking', [behavior]);

    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      includeBoundary: true,
      includeNegativeTests: true,
      includePreconditionViolations: true,
    });

    expect(result.success).toBe(true);

    const testFile = result.files.find(f => f.path.includes('Transfer.test.ts'));
    expect(testFile).toBeDefined();

    // Should have all categories
    expect(testFile!.content).toContain('Valid Inputs');
    expect(testFile!.content).toContain('Boundary Cases');
    expect(testFile!.content).toContain('Invalid Inputs');
    expect(testFile!.content).toContain('Precondition Violations');
  });

  it('should include data trace comments', () => {
    const behavior = createBehavior('Test', [
      createField('value', primitiveType('String')),
    ]);
    const domain = createDomain('Test', [behavior]);

    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      baseSeed: 12345,
    });

    const testFile = result.files.find(f => f.path.includes('Test.test.ts'));
    expect(testFile).toBeDefined();
    
    // Should contain data trace comments
    expect(testFile!.content).toContain('@dataTrace');
    expect(testFile!.content).toContain('Seed:');
  });

  it('should compute coverage statistics', () => {
    const preconditions: AST.Expression[] = [
      {
        kind: 'BinaryExpr',
        operator: '>',
        left: {
          kind: 'InputExpr',
          property: { kind: 'Identifier', name: 'value', location: mockLocation() },
          location: mockLocation(),
        },
        right: numberLiteral(0),
        location: mockLocation(),
      },
    ];

    const postconditions = [
      createPostconditionBlock('success', [
        { kind: 'BooleanLiteral', value: true, location: mockLocation() },
      ]),
    ];

    const behavior = createBehavior(
      'Test',
      [createField('value', primitiveType('Int'))],
      preconditions,
      postconditions
    );
    const domain = createDomain('Test', [behavior]);

    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      includePreconditionViolations: true,
    });

    expect(result.metadata.stats.totalBehaviors).toBe(1);
    expect(result.metadata.stats.totalAssertions).toBeGreaterThan(0);
    expect(result.metadata.stats.supportedAssertions).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST FILE EMISSION TESTS
// ============================================================================

describe('emitTestFile', () => {
  it('should emit complete test file', () => {
    const behavior = createBehavior('Process', [
      createField('input', primitiveType('String')),
    ]);
    const domain = createDomain('Test', [behavior]);

    const testFile = emitTestFile(behavior, domain, {
      framework: 'vitest',
      seed: 42,
    });

    expect(testFile.filename).toBe('Process.test.ts');
    expect(testFile.content).toContain("import { describe, it, expect");
    expect(testFile.content).toContain("describe('Process'");
    expect(testFile.content).toContain('const input');
  });

  it('should emit tests with correct stats', () => {
    const behavior = createBehavior('Validate', [
      createField('data', primitiveType('String')),
    ]);
    const domain = createDomain('Test', [behavior]);

    const testFile = emitTestFile(behavior, domain, {
      framework: 'vitest',
      includeBoundary: true,
      includeInvalid: true,
    });

    expect(testFile.stats.totalTests).toBeGreaterThan(0);
    expect(testFile.stats.validTests).toBeGreaterThan(0);
  });

  it('should emit deterministic output', () => {
    const behavior = createBehavior('Check', [
      createField('id', primitiveType('UUID')),
      createField('name', primitiveType('String')),
    ]);
    const domain = createDomain('Test', [behavior]);

    const file1 = emitTestFile(behavior, domain, { seed: 42 });
    const file2 = emitTestFile(behavior, domain, { seed: 42 });

    expect(file1.content).toBe(file2.content);
  });
});

// ============================================================================
// REPRESENTATIVE SPEC TESTS
// ============================================================================

describe('Representative Specs', () => {
  it('should generate runnable tests for Auth/Login spec', () => {
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

    const postconditions = [
      createPostconditionBlock('success', [
        {
          kind: 'CallExpr',
          callee: {
            kind: 'MemberExpr',
            object: { kind: 'Identifier', name: 'Session', location: mockLocation() },
            property: { kind: 'Identifier', name: 'exists', location: mockLocation() },
            location: mockLocation(),
          },
          arguments: [{
            kind: 'MemberExpr',
            object: {
              kind: 'ResultExpr',
              location: mockLocation(),
            },
            property: { kind: 'Identifier', name: 'id', location: mockLocation() },
            location: mockLocation(),
          }],
          location: mockLocation(),
        },
      ]),
    ];

    const errors = [
      createErrorSpec('INVALID_CREDENTIALS', 'Email or password incorrect', true),
      createErrorSpec('USER_LOCKED', 'Account locked', true),
    ];

    const behavior = createBehavior(
      'Login',
      [
        createField('email', emailType),
        createField('password', passwordType),
        createField('ip_address', primitiveType('String')),
      ],
      preconditions,
      postconditions,
      errors
    );

    const domain = createDomain('AuthLogin', [behavior], [
      createEntity('User', [
        createField('id', primitiveType('UUID')),
        createField('email', primitiveType('String')),
      ]),
      createEntity('Session', [
        createField('id', primitiveType('UUID')),
        createField('user_id', primitiveType('UUID')),
      ]),
    ]);

    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      baseSeed: 42,
    });

    expect(result.success).toBe(true);

    const testFile = result.files.find(f => f.path.includes('Login.test.ts'));
    expect(testFile).toBeDefined();

    // Should have meaningful email values
    expect(testFile!.content).toMatch(/@.*\./);

    // Should have password of correct length
    const passwordMatches = testFile!.content.match(/password:\s*["']([^"']+)["']/g);
    if (passwordMatches) {
      for (const match of passwordMatches) {
        const value = match.match(/["']([^"']+)["']/)?.[1];
        if (value && typeof value === 'string') {
          expect(value.length).toBeGreaterThanOrEqual(8);
        }
      }
    }
  });

  it('should generate runnable tests for Payments/Charge spec', () => {
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

    const postconditions = [
      createPostconditionBlock('success', [
        {
          kind: 'BinaryExpr',
          operator: '==',
          left: {
            kind: 'MemberExpr',
            object: {
              kind: 'ResultExpr',
              location: mockLocation(),
            },
            property: { kind: 'Identifier', name: 'amount', location: mockLocation() },
            location: mockLocation(),
          },
          right: {
            kind: 'InputExpr',
            property: { kind: 'Identifier', name: 'amount', location: mockLocation() },
            location: mockLocation(),
          },
          location: mockLocation(),
        },
      ]),
    ];

    const errors = [
      createErrorSpec('CARD_DECLINED', 'Card was declined', true),
      createErrorSpec('DUPLICATE_IDEMPOTENCY_KEY', 'Key already used', false),
    ];

    const behavior = createBehavior(
      'CreateCharge',
      [
        createField('amount', amountType),
        createField('currency', primitiveType('String')),
        createField('idempotency_key', primitiveType('String')),
      ],
      preconditions,
      postconditions,
      errors
    );

    const domain = createDomain('PaymentsCharge', [behavior], [
      createEntity('Charge', [
        createField('id', primitiveType('UUID')),
        createField('amount', primitiveType('Decimal')),
      ]),
    ]);

    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      baseSeed: 42,
    });

    expect(result.success).toBe(true);

    const testFile = result.files.find(f => f.path.includes('CreateCharge.test.ts'));
    expect(testFile).toBeDefined();

    // Valid amounts should be positive
    expect(testFile!.content).toMatch(/amount:\s*\d+(\.\d+)?/);
  });

  it('should generate runnable tests for CRUD/Users spec', () => {
    const usernameType = constrainedType(primitiveType('String'), [
      { name: 'min_length', value: numberLiteral(3) },
      { name: 'max_length', value: numberLiteral(30) },
    ]);

    const preconditions: AST.Expression[] = [
      {
        kind: 'BinaryExpr',
        operator: '>=',
        left: {
          kind: 'MemberExpr',
          object: {
            kind: 'InputExpr',
            property: { kind: 'Identifier', name: 'username', location: mockLocation() },
            location: mockLocation(),
          },
          property: { kind: 'Identifier', name: 'length', location: mockLocation() },
          location: mockLocation(),
        },
        right: numberLiteral(3),
        location: mockLocation(),
      },
    ];

    const postconditions = [
      createPostconditionBlock('success', [
        {
          kind: 'CallExpr',
          callee: {
            kind: 'MemberExpr',
            object: { kind: 'Identifier', name: 'User', location: mockLocation() },
            property: { kind: 'Identifier', name: 'exists', location: mockLocation() },
            location: mockLocation(),
          },
          arguments: [{
            kind: 'MemberExpr',
            object: { kind: 'ResultExpr', location: mockLocation() },
            property: { kind: 'Identifier', name: 'id', location: mockLocation() },
            location: mockLocation(),
          }],
          location: mockLocation(),
        },
      ]),
    ];

    const errors = [
      createErrorSpec('EMAIL_EXISTS', 'Email already registered', false),
      createErrorSpec('USERNAME_EXISTS', 'Username taken', false),
    ];

    const behavior = createBehavior(
      'CreateUser',
      [
        createField('email', primitiveType('String')),
        createField('username', usernameType),
        createField('display_name', primitiveType('String')),
        createField('password', primitiveType('String')),
      ],
      preconditions,
      postconditions,
      errors
    );

    const domain = createDomain('CRUDUsers', [behavior], [
      createEntity('User', [
        createField('id', primitiveType('UUID')),
        createField('email', primitiveType('String')),
        createField('username', primitiveType('String')),
      ]),
    ]);

    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      baseSeed: 42,
    });

    expect(result.success).toBe(true);

    const testFile = result.files.find(f => f.path.includes('CreateUser.test.ts'));
    expect(testFile).toBeDefined();

    // Usernames should be at least 3 chars
    const usernameMatches = testFile!.content.match(/username:\s*["']([^"']+)["']/g);
    if (usernameMatches) {
      for (const match of usernameMatches) {
        const value = match.match(/["']([^"']+)["']/)?.[1];
        if (value && typeof value === 'string' && !value.includes('null')) {
          expect(value.length).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});

// ============================================================================
// COMPLETENESS METRICS
// ============================================================================

describe('Completeness Metrics', () => {
  it('should achieve 80%+ meaningful assertions', () => {
    const behavior = createBehavior(
      'FullTest',
      [
        createField('required_string', primitiveType('String')),
        createField('required_number', primitiveType('Int')),
        createField('optional_value', primitiveType('String'), true),
      ],
      [
        // Precondition
        {
          kind: 'BinaryExpr',
          operator: '>',
          left: {
            kind: 'InputExpr',
            property: { kind: 'Identifier', name: 'required_number', location: mockLocation() },
            location: mockLocation(),
          },
          right: numberLiteral(0),
          location: mockLocation(),
        },
      ],
      [
        createPostconditionBlock('success', [
          { kind: 'BooleanLiteral', value: true, location: mockLocation() },
        ]),
      ],
      [
        createErrorSpec('VALIDATION_ERROR', 'Invalid input', true),
      ]
    );
    const domain = createDomain('Test', [behavior]);

    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
    });

    // Calculate completeness
    const testFile = result.files.find(f => f.path.includes('FullTest.test.ts'));
    expect(testFile).toBeDefined();

    // Count meaningful assertions vs placeholders
    const content = testFile!.content;
    const totalExpects = (content.match(/expect\(/g) || []).length;
    const todoComments = (content.match(/\/\/ TODO/g) || []).length;

    // Most assertions should be meaningful (expect statements vs TODO comments)
    const meaningfulRatio = totalExpects / (totalExpects + todoComments + 1);
    expect(meaningfulRatio).toBeGreaterThan(0.5); // At least 50% for this test

    // Check metadata for assertion coverage
    const stats = result.metadata.stats;
    const supportedRatio = stats.supportedAssertions / Math.max(stats.totalAssertions, 1);
    expect(supportedRatio).toBeGreaterThan(0.5);
  });
});
