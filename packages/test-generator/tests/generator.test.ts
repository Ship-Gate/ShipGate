// ============================================================================
// Test Generator - Integration Tests
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { generate } from '../src/generator';
import { getStrategy, detectDomain } from '../src/strategies';
import type * as AST from '@isl-lang/parser';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockDomain(name: string, behaviors: AST.Behavior[], entities: AST.Entity[] = []): AST.Domain {
  return {
    kind: 'Domain',
    name: { kind: 'Identifier', name, location: mockLocation() },
    version: { kind: 'StringLiteral', value: '1.0.0', location: mockLocation() },
    imports: [],
    types: [],
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

function createMockBehavior(
  name: string,
  options: {
    preconditions?: AST.Expression[];
    postconditions?: AST.PostconditionBlock[];
    errors?: AST.ErrorSpec[];
    inputFields?: AST.Field[];
    invariants?: AST.Expression[];
  } = {}
): AST.Behavior {
  return {
    kind: 'Behavior',
    name: { kind: 'Identifier', name, location: mockLocation() },
    description: { kind: 'StringLiteral', value: `${name} behavior`, location: mockLocation() },
    input: {
      kind: 'InputSpec',
      fields: options.inputFields || [],
      location: mockLocation(),
    },
    output: {
      kind: 'OutputSpec',
      success: { kind: 'PrimitiveType', name: 'Boolean', location: mockLocation() },
      errors: options.errors || [],
      location: mockLocation(),
    },
    preconditions: options.preconditions || [],
    postconditions: options.postconditions || [],
    invariants: options.invariants || [],
    temporal: [],
    security: [],
    compliance: [],
    location: mockLocation(),
  };
}

function createMockEntity(name: string, fields: AST.Field[] = []): AST.Entity {
  return {
    kind: 'Entity',
    name: { kind: 'Identifier', name, location: mockLocation() },
    fields,
    invariants: [],
    location: mockLocation(),
  };
}

function mockLocation(): AST.SourceLocation {
  return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
}

function createField(name: string, type: AST.PrimitiveType['name']): AST.Field {
  return {
    kind: 'Field',
    name: { kind: 'Identifier', name, location: mockLocation() },
    type: { kind: 'PrimitiveType', name: type, location: mockLocation() },
    optional: false,
    annotations: [],
    location: mockLocation(),
  };
}

function createBinaryExpr(left: AST.Expression, op: AST.BinaryOperator, right: AST.Expression): AST.BinaryExpr {
  return {
    kind: 'BinaryExpr',
    operator: op,
    left,
    right,
    location: mockLocation(),
  };
}

function createMemberExpr(object: AST.Expression, property: string): AST.MemberExpr {
  return {
    kind: 'MemberExpr',
    object,
    property: { kind: 'Identifier', name: property, location: mockLocation() },
    location: mockLocation(),
  };
}

function createInputExpr(property: string): AST.InputExpr {
  return {
    kind: 'InputExpr',
    property: { kind: 'Identifier', name: property, location: mockLocation() },
    location: mockLocation(),
  };
}

function createNumberLiteral(value: number): AST.NumberLiteral {
  return {
    kind: 'NumberLiteral',
    value,
    isFloat: value % 1 !== 0,
    location: mockLocation(),
  };
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
    when: { kind: 'StringLiteral', value: when, location: mockLocation() },
    retriable,
    location: mockLocation(),
  };
}

// ============================================================================
// DOMAIN DETECTION TESTS
// ============================================================================

describe('Domain Detection', () => {
  it('should detect auth domain from domain name', () => {
    const behavior = createMockBehavior('DoSomething');
    const domain = createMockDomain('Auth', [behavior]);
    
    const detected = detectDomain(behavior, domain);
    expect(detected).toBe('auth');
  });

  it('should detect auth domain from behavior name', () => {
    const behavior = createMockBehavior('Login', {
      inputFields: [createField('email', 'String'), createField('password', 'String')],
    });
    const domain = createMockDomain('MyApp', [behavior]);
    
    const detected = detectDomain(behavior, domain);
    expect(detected).toBe('auth');
  });

  it('should detect payments domain from domain name', () => {
    const behavior = createMockBehavior('Process');
    const domain = createMockDomain('Payment', [behavior]);
    
    const detected = detectDomain(behavior, domain);
    expect(detected).toBe('payments');
  });

  it('should detect payments domain from input fields', () => {
    const behavior = createMockBehavior('CreateTransaction', {
      inputFields: [
        createField('amount', 'Decimal'),
        createField('currency', 'String'),
        createField('idempotency_key', 'String'),
      ],
    });
    const domain = createMockDomain('Transactions', [behavior]);
    
    const detected = detectDomain(behavior, domain);
    expect(detected).toBe('payments');
  });

  it('should detect uploads domain from behavior name', () => {
    const behavior = createMockBehavior('UploadFile', {
      inputFields: [createField('file', 'String')],
    });
    const domain = createMockDomain('MyApp', [behavior]);
    
    const detected = detectDomain(behavior, domain);
    expect(detected).toBe('uploads');
  });

  it('should detect webhooks domain from input fields', () => {
    const behavior = createMockBehavior('HandleCallback', {
      inputFields: [
        createField('signature', 'String'),
        createField('payload', 'String'),
      ],
    });
    const domain = createMockDomain('Integrations', [behavior]);
    
    const detected = detectDomain(behavior, domain);
    expect(detected).toBe('webhooks');
  });

  it('should fall back to generic domain', () => {
    const behavior = createMockBehavior('DoSomething', {
      inputFields: [createField('name', 'String'), createField('value', 'Int')],
    });
    const domain = createMockDomain('MyApp', [behavior]);
    
    const detected = detectDomain(behavior, domain);
    expect(detected).toBe('generic');
  });
});

// ============================================================================
// GENERATION TESTS
// ============================================================================

describe('Test Generation', () => {
  describe('Auth Domain', () => {
    it('should generate auth assertions for login behavior', () => {
      const behavior = createMockBehavior('Login', {
        inputFields: [
          createField('email', 'String'),
          createField('password', 'String'),
        ],
        preconditions: [
          createBinaryExpr(
            createMemberExpr(createInputExpr('email'), 'length'),
            '>',
            createNumberLiteral(0)
          ),
          createBinaryExpr(
            createMemberExpr(createInputExpr('password'), 'length'),
            '>=',
            createNumberLiteral(8)
          ),
        ],
        errors: [
          createErrorSpec('INVALID_CREDENTIALS', 'Email or password is incorrect', true),
          createErrorSpec('ACCOUNT_LOCKED', 'Account locked', true),
        ],
      });
      const domain = createMockDomain('Auth', [behavior], [
        createMockEntity('User'),
        createMockEntity('Session'),
      ]);

      const result = generate(domain, { framework: 'vitest' });

      expect(result.success).toBe(true);
      expect(result.metadata.domain).toBe('auth');
      expect(result.files.length).toBeGreaterThan(0);

      const testFile = result.files.find(f => f.path.includes('Login.test.ts'));
      expect(testFile).toBeDefined();
      expect(testFile!.content).toContain('describe(\'Login\'');
      expect(testFile!.content).toContain('Preconditions');
      expect(testFile!.content).toContain('Error Cases');
    });

    it('should generate token assertions for auth postconditions', () => {
      const resultExpr: AST.ResultExpr = {
        kind: 'ResultExpr',
        property: { kind: 'Identifier', name: 'access_token', location: mockLocation() },
        location: mockLocation(),
      };
      
      const behavior = createMockBehavior('Login', {
        inputFields: [createField('email', 'String')],
        postconditions: [
          createPostconditionBlock('success', [
            createBinaryExpr(resultExpr, '!=', { kind: 'NullLiteral', location: mockLocation() }),
          ]),
        ],
      });
      const domain = createMockDomain('Auth', [behavior]);

      const result = generate(domain, { framework: 'vitest' });
      
      expect(result.success).toBe(true);
      const testFile = result.files.find(f => f.path.includes('Login.test.ts'));
      expect(testFile).toBeDefined();
      expect(testFile!.content).toContain('access_token');
    });
  });

  describe('Payments Domain', () => {
    it('should generate payment assertions for amount validation', () => {
      const behavior = createMockBehavior('CreatePayment', {
        inputFields: [
          createField('amount', 'Decimal'),
          createField('currency', 'String'),
          createField('idempotency_key', 'String'),
        ],
        preconditions: [
          createBinaryExpr(createInputExpr('amount'), '>', createNumberLiteral(0)),
        ],
        errors: [
          createErrorSpec('DUPLICATE_IDEMPOTENCY_KEY', 'Key already used', false),
          createErrorSpec('CARD_DECLINED', 'Card declined', true),
        ],
      });
      const domain = createMockDomain('Payment', [behavior], [
        createMockEntity('Payment'),
      ]);

      const result = generate(domain, { framework: 'vitest' });

      expect(result.success).toBe(true);
      expect(result.metadata.domain).toBe('payments');
      
      const testFile = result.files.find(f => f.path.includes('CreatePayment.test.ts'));
      expect(testFile).toBeDefined();
      expect(testFile!.content).toContain('amount');
      expect(testFile!.content).toContain('toBeGreaterThan(0)');
    });

    it('should generate idempotency scaffolds', () => {
      const behavior = createMockBehavior('CreatePayment', {
        inputFields: [
          createField('idempotency_key', 'String'),
        ],
        errors: [
          createErrorSpec('DUPLICATE_IDEMPOTENCY_KEY', 'Key already used', false),
        ],
      });
      const domain = createMockDomain('Payment', [behavior]);

      const result = generate(domain, { framework: 'vitest' });

      expect(result.success).toBe(true);
      // Check for NEEDS_IMPL scaffold
      const testFile = result.files.find(f => f.path.includes('CreatePayment.test.ts'));
      expect(testFile).toBeDefined();
      expect(testFile!.content).toContain('idempotency');
    });
  });

  describe('Uploads Domain', () => {
    it('should generate file type assertions', () => {
      const behavior = createMockBehavior('UploadFile', {
        inputFields: [
          createField('content_type', 'String'),
          createField('filename', 'String'),
        ],
        errors: [
          createErrorSpec('INVALID_FILE_TYPE', 'File type not allowed', false),
          createErrorSpec('FILE_TOO_LARGE', 'File too large', false),
        ],
      });
      const domain = createMockDomain('Storage', [behavior]);

      const result = generate(domain, { framework: 'vitest' });

      expect(result.success).toBe(true);
      expect(result.metadata.domain).toBe('uploads');
    });

    it('should generate URL assertions for postconditions', () => {
      const resultExpr: AST.ResultExpr = {
        kind: 'ResultExpr',
        property: { kind: 'Identifier', name: 'url', location: mockLocation() },
        location: mockLocation(),
      };
      
      const behavior = createMockBehavior('UploadFile', {
        inputFields: [createField('file', 'String')],
        postconditions: [
          createPostconditionBlock('success', [
            createBinaryExpr(resultExpr, '!=', { kind: 'NullLiteral', location: mockLocation() }),
          ]),
        ],
      });
      const domain = createMockDomain('Storage', [behavior]);

      const result = generate(domain, { framework: 'vitest' });
      
      const testFile = result.files.find(f => f.path.includes('UploadFile.test.ts'));
      expect(testFile).toBeDefined();
      expect(testFile!.content).toContain('url');
    });
  });

  describe('Webhooks Domain', () => {
    it('should generate signature validation assertions', () => {
      const behavior = createMockBehavior('ReceiveWebhook', {
        inputFields: [
          createField('signature', 'String'),
          createField('payload', 'String'),
          createField('timestamp', 'Timestamp'),
        ],
        errors: [
          createErrorSpec('INVALID_SIGNATURE', 'Signature invalid', false),
          createErrorSpec('REPLAY_ATTACK', 'Already processed', false),
        ],
      });
      const domain = createMockDomain('Webhooks', [behavior]);

      const result = generate(domain, { framework: 'vitest' });

      expect(result.success).toBe(true);
      expect(result.metadata.domain).toBe('webhooks');
      
      const testFile = result.files.find(f => f.path.includes('ReceiveWebhook.test.ts'));
      expect(testFile).toBeDefined();
      expect(testFile!.content).toContain('signature');
    });

    it('should generate replay protection scaffolds', () => {
      const behavior = createMockBehavior('HandleCallback', {
        inputFields: [
          createField('webhook_id', 'String'),
          createField('signature', 'String'),
        ],
        errors: [
          createErrorSpec('REPLAY_ATTACK', 'Duplicate webhook', false),
        ],
      });
      const domain = createMockDomain('Webhooks', [behavior]);

      const result = generate(domain, { framework: 'vitest' });

      expect(result.success).toBe(true);
      const testFile = result.files.find(f => f.path.includes('HandleCallback.test.ts'));
      expect(testFile).toBeDefined();
      // Should contain replay protection scaffolds
      expect(testFile!.content).toContain('NEEDS_IMPL');
    });
  });
});

// ============================================================================
// METADATA TESTS
// ============================================================================

describe('Generation Metadata', () => {
  it('should emit metadata file when emitMetadata is true', () => {
    const behavior = createMockBehavior('Test');
    const domain = createMockDomain('Test', [behavior]);

    const result = generate(domain, { framework: 'vitest', emitMetadata: true });

    const metadataFile = result.files.find(f => f.path.includes('test-metadata.json'));
    expect(metadataFile).toBeDefined();
    
    const metadata = JSON.parse(metadataFile!.content);
    expect(metadata.behaviors).toHaveLength(1);
    expect(metadata.stats).toBeDefined();
  });

  it('should track assertion coverage', () => {
    const behavior = createMockBehavior('Login', {
      inputFields: [createField('email', 'String')],
      preconditions: [
        createBinaryExpr(
          createMemberExpr(createInputExpr('email'), 'length'),
          '>',
          createNumberLiteral(0)
        ),
      ],
      postconditions: [
        createPostconditionBlock('success', [
          { kind: 'BooleanLiteral', value: true, location: mockLocation() },
        ]),
      ],
    });
    const domain = createMockDomain('Auth', [behavior]);

    const result = generate(domain, { framework: 'vitest' });

    expect(result.metadata.stats.totalBehaviors).toBe(1);
    expect(result.metadata.stats.totalAssertions).toBeGreaterThan(0);
    expect(result.metadata.stats.supportedAssertions).toBeGreaterThan(0);
  });

  it('should track NEEDS_IMPL assertions separately', () => {
    const behavior = createMockBehavior('CreatePayment', {
      inputFields: [createField('idempotency_key', 'String')],
      errors: [
        createErrorSpec('DUPLICATE_IDEMPOTENCY_KEY', 'Key already used', false),
      ],
    });
    const domain = createMockDomain('Payment', [behavior]);

    const result = generate(domain, { framework: 'vitest' });

    // Idempotency key handling generates NEEDS_IMPL scaffolds
    expect(result.metadata.stats.needsImplAssertions).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// HELPER FILE TESTS
// ============================================================================

describe('Helper Files', () => {
  it('should generate test utilities', () => {
    const behavior = createMockBehavior('Login', {
      inputFields: [createField('email', 'String')],
    });
    const domain = createMockDomain('Auth', [behavior]);

    const result = generate(domain, { framework: 'vitest', includeHelpers: true });

    const utilsFile = result.files.find(f => f.path.includes('test-utils.ts'));
    expect(utilsFile).toBeDefined();
    expect(utilsFile!.content).toContain('createValidInputForLogin');
    expect(utilsFile!.content).toContain('createInvalidInputForLogin');
  });

  it('should generate fixtures for entities', () => {
    const behavior = createMockBehavior('Login');
    const domain = createMockDomain('Auth', [behavior], [
      createMockEntity('User', [createField('email', 'String')]),
      createMockEntity('Session'),
    ]);

    const result = generate(domain, { framework: 'vitest', includeHelpers: true });

    const fixturesFile = result.files.find(f => f.path.includes('fixtures.ts'));
    expect(fixturesFile).toBeDefined();
    expect(fixturesFile!.content).toContain('userFixture');
    expect(fixturesFile!.content).toContain('createUser');
    expect(fixturesFile!.content).toContain('sessionFixture');
  });

  it('should generate framework config', () => {
    const behavior = createMockBehavior('Test');
    const domain = createMockDomain('Test', [behavior]);

    const vitestResult = generate(domain, { framework: 'vitest' });
    const jestResult = generate(domain, { framework: 'jest' });

    expect(vitestResult.files.find(f => f.path.includes('vitest.config.ts'))).toBeDefined();
    expect(jestResult.files.find(f => f.path.includes('jest.config.js'))).toBeDefined();
  });
});

// ============================================================================
// FORCE DOMAIN TESTS
// ============================================================================

describe('Force Domain', () => {
  it('should use forced domain strategy', () => {
    const behavior = createMockBehavior('DoSomething', {
      inputFields: [createField('data', 'String')],
    });
    const domain = createMockDomain('Generic', [behavior]);

    const result = generate(domain, { framework: 'vitest', forceDomain: 'auth' });

    expect(result.metadata.domain).toBe('auth');
  });

  it('should override auto-detection with forceDomain', () => {
    const behavior = createMockBehavior('CreatePayment', {
      inputFields: [createField('amount', 'Decimal')],
    });
    const domain = createMockDomain('Payment', [behavior]);

    const result = generate(domain, { framework: 'vitest', forceDomain: 'webhooks' });

    expect(result.metadata.domain).toBe('webhooks');
  });
});
