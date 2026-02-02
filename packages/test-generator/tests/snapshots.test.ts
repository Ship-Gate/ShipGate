// ============================================================================
// Test Generator - Golden Snapshot Tests
// Verifies generated test files match expected output exactly
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator';
import type * as AST from '@isl-lang/parser';

// ============================================================================
// SNAPSHOT TEST HELPERS
// ============================================================================

function mockLocation(): AST.SourceLocation {
  return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
}

function createField(name: string, type: AST.PrimitiveType['name'], sensitive = false): AST.Field {
  return {
    kind: 'Field',
    name: { kind: 'Identifier', name, location: mockLocation() },
    type: { kind: 'PrimitiveType', name: type, location: mockLocation() },
    optional: false,
    annotations: sensitive ? [{ kind: 'Annotation', name: { kind: 'Identifier', name: 'sensitive', location: mockLocation() }, location: mockLocation() }] : [],
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

function createBinaryExpr(left: AST.Expression, op: AST.BinaryOperator, right: AST.Expression): AST.BinaryExpr {
  return { kind: 'BinaryExpr', operator: op, left, right, location: mockLocation() };
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

function createResultExpr(property?: string): AST.ResultExpr {
  return {
    kind: 'ResultExpr',
    property: property ? { kind: 'Identifier', name: property, location: mockLocation() } : undefined,
    location: mockLocation(),
  };
}

function createNumberLiteral(value: number): AST.NumberLiteral {
  return { kind: 'NumberLiteral', value, isFloat: value % 1 !== 0, location: mockLocation() };
}

function createStringLiteral(value: string): AST.StringLiteral {
  return { kind: 'StringLiteral', value, location: mockLocation() };
}

function createPostconditionBlock(condition: 'success' | 'any_error' | string, predicates: AST.Expression[]): AST.PostconditionBlock {
  return {
    kind: 'PostconditionBlock',
    condition: condition === 'success' || condition === 'any_error' ? condition : { kind: 'Identifier', name: condition, location: mockLocation() },
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

function createBehavior(name: string, options: {
  description?: string;
  inputFields?: AST.Field[];
  preconditions?: AST.Expression[];
  postconditions?: AST.PostconditionBlock[];
  errors?: AST.ErrorSpec[];
  invariants?: AST.Expression[];
}): AST.Behavior {
  return {
    kind: 'Behavior',
    name: { kind: 'Identifier', name, location: mockLocation() },
    description: options.description ? { kind: 'StringLiteral', value: options.description, location: mockLocation() } : undefined,
    input: { kind: 'InputSpec', fields: options.inputFields || [], location: mockLocation() },
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

function createDomain(name: string, behaviors: AST.Behavior[], entities: AST.Entity[] = []): AST.Domain {
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

// ============================================================================
// AUTH DOMAIN SNAPSHOTS
// ============================================================================

describe('Auth Domain Snapshots', () => {
  it('should generate correct login test structure', () => {
    const domain = createDomain('Auth', [
      createBehavior('Login', {
        description: 'Authenticate user',
        inputFields: [
          createField('email', 'String'),
          createField('password', 'String', true),
        ],
        preconditions: [
          createBinaryExpr(createMemberExpr(createInputExpr('email'), 'length'), '>', createNumberLiteral(0)),
          createBinaryExpr(createMemberExpr(createInputExpr('password'), 'length'), '>=', createNumberLiteral(8)),
        ],
        postconditions: [
          createPostconditionBlock('success', [
            createBinaryExpr(createResultExpr('access_token'), '!=', { kind: 'NullLiteral', location: mockLocation() }),
          ]),
        ],
        errors: [
          createErrorSpec('INVALID_CREDENTIALS', 'Email or password incorrect', true),
          createErrorSpec('ACCOUNT_LOCKED', 'Account locked', true),
        ],
      }),
    ], [
      createEntity('User'),
      createEntity('Session'),
    ]);

    const result = generate(domain, { framework: 'vitest' });
    const testFile = result.files.find(f => f.path.includes('Login.test.ts'));

    expect(testFile).toBeDefined();
    expect(testFile!.content).toMatchSnapshot('auth-login-test');
  });

  it('should generate correct register test structure', () => {
    const domain = createDomain('Auth', [
      createBehavior('Register', {
        description: 'Register new user',
        inputFields: [
          createField('email', 'String'),
          createField('password', 'String', true),
          createField('name', 'String'),
        ],
        preconditions: [
          createBinaryExpr(createMemberExpr(createInputExpr('email'), 'length'), '>', createNumberLiteral(0)),
          createBinaryExpr(createMemberExpr(createInputExpr('password'), 'length'), '>=', createNumberLiteral(8)),
        ],
        errors: [
          createErrorSpec('EMAIL_EXISTS', 'Email already registered', false),
          createErrorSpec('WEAK_PASSWORD', 'Password too weak', true),
        ],
      }),
    ], [createEntity('User')]);

    const result = generate(domain, { framework: 'vitest' });
    const testFile = result.files.find(f => f.path.includes('Register.test.ts'));

    expect(testFile).toBeDefined();
    expect(testFile!.content).toMatchSnapshot('auth-register-test');
  });
});

// ============================================================================
// PAYMENTS DOMAIN SNAPSHOTS
// ============================================================================

describe('Payments Domain Snapshots', () => {
  it('should generate correct payment test structure', () => {
    const domain = createDomain('Payment', [
      createBehavior('CreatePayment', {
        description: 'Process payment',
        inputFields: [
          createField('amount', 'Decimal'),
          createField('currency', 'String'),
          createField('idempotency_key', 'String'),
        ],
        preconditions: [
          createBinaryExpr(createInputExpr('amount'), '>', createNumberLiteral(0)),
        ],
        postconditions: [
          createPostconditionBlock('success', [
            createBinaryExpr(createResultExpr('status'), '==', createStringLiteral('COMPLETED')),
          ]),
        ],
        errors: [
          createErrorSpec('DUPLICATE_IDEMPOTENCY_KEY', 'Key already used', false),
          createErrorSpec('CARD_DECLINED', 'Card declined', true),
          createErrorSpec('INSUFFICIENT_FUNDS', 'Not enough funds', true),
        ],
      }),
    ], [createEntity('Payment')]);

    const result = generate(domain, { framework: 'vitest' });
    const testFile = result.files.find(f => f.path.includes('CreatePayment.test.ts'));

    expect(testFile).toBeDefined();
    expect(testFile!.content).toMatchSnapshot('payment-create-test');
  });

  it('should generate correct refund test structure', () => {
    const domain = createDomain('Payment', [
      createBehavior('RefundPayment', {
        description: 'Refund payment',
        inputFields: [
          createField('payment_id', 'UUID'),
          createField('amount', 'Decimal'),
          createField('idempotency_key', 'String'),
        ],
        preconditions: [
          createBinaryExpr(createInputExpr('amount'), '>', createNumberLiteral(0)),
        ],
        errors: [
          createErrorSpec('PAYMENT_NOT_FOUND', 'Payment not found', false),
          createErrorSpec('REFUND_EXCEEDS_AMOUNT', 'Refund too large', false),
        ],
      }),
    ], [createEntity('Payment'), createEntity('Refund')]);

    const result = generate(domain, { framework: 'vitest' });
    const testFile = result.files.find(f => f.path.includes('RefundPayment.test.ts'));

    expect(testFile).toBeDefined();
    expect(testFile!.content).toMatchSnapshot('payment-refund-test');
  });
});

// ============================================================================
// UPLOADS DOMAIN SNAPSHOTS
// ============================================================================

describe('Uploads Domain Snapshots', () => {
  it('should generate correct upload test structure', () => {
    const domain = createDomain('Storage', [
      createBehavior('UploadFile', {
        description: 'Upload file to storage',
        inputFields: [
          createField('filename', 'String'),
          createField('content_type', 'String'),
        ],
        postconditions: [
          createPostconditionBlock('success', [
            createBinaryExpr(createResultExpr('url'), '!=', { kind: 'NullLiteral', location: mockLocation() }),
          ]),
        ],
        errors: [
          createErrorSpec('INVALID_FILE_TYPE', 'File type not allowed', false),
          createErrorSpec('FILE_TOO_LARGE', 'File exceeds limit', false),
        ],
      }),
    ], [createEntity('File')]);

    const result = generate(domain, { framework: 'vitest' });
    const testFile = result.files.find(f => f.path.includes('UploadFile.test.ts'));

    expect(testFile).toBeDefined();
    expect(testFile!.content).toMatchSnapshot('upload-file-test');
  });
});

// ============================================================================
// WEBHOOKS DOMAIN SNAPSHOTS
// ============================================================================

describe('Webhooks Domain Snapshots', () => {
  it('should generate correct webhook test structure', () => {
    const domain = createDomain('Webhooks', [
      createBehavior('ReceiveWebhook', {
        description: 'Process incoming webhook',
        inputFields: [
          createField('webhook_id', 'String'),
          createField('signature', 'String'),
          createField('payload', 'String'),
          createField('timestamp', 'Timestamp'),
        ],
        postconditions: [
          createPostconditionBlock('success', [
            createBinaryExpr(createResultExpr('processed'), '==', { kind: 'BooleanLiteral', value: true, location: mockLocation() }),
          ]),
        ],
        errors: [
          createErrorSpec('INVALID_SIGNATURE', 'Signature invalid', false),
          createErrorSpec('REPLAY_ATTACK', 'Duplicate webhook', false),
        ],
      }),
    ], [createEntity('WebhookLog')]);

    const result = generate(domain, { framework: 'vitest' });
    const testFile = result.files.find(f => f.path.includes('ReceiveWebhook.test.ts'));

    expect(testFile).toBeDefined();
    expect(testFile!.content).toMatchSnapshot('webhook-receive-test');
  });
});

// ============================================================================
// METADATA SNAPSHOTS
// ============================================================================

describe('Metadata Snapshots', () => {
  it('should generate correct metadata structure', () => {
    const domain = createDomain('Auth', [
      createBehavior('Login', {
        inputFields: [createField('email', 'String')],
        preconditions: [
          createBinaryExpr(createMemberExpr(createInputExpr('email'), 'length'), '>', createNumberLiteral(0)),
        ],
        errors: [createErrorSpec('INVALID_CREDENTIALS', 'Invalid', true)],
      }),
    ]);

    const result = generate(domain, { framework: 'vitest', emitMetadata: true });
    const metadataFile = result.files.find(f => f.path.includes('test-metadata.json'));

    expect(metadataFile).toBeDefined();
    const metadata = JSON.parse(metadataFile!.content);
    
    expect(metadata).toMatchSnapshot('metadata-structure');
  });
});

// ============================================================================
// HELPER FILE SNAPSHOTS
// ============================================================================

describe('Helper File Snapshots', () => {
  it('should generate correct test utilities', () => {
    const domain = createDomain('Auth', [
      createBehavior('Login', {
        inputFields: [
          createField('email', 'String'),
          createField('password', 'String'),
        ],
      }),
    ]);

    const result = generate(domain, { framework: 'vitest', includeHelpers: true });
    const utilsFile = result.files.find(f => f.path.includes('test-utils.ts'));

    expect(utilsFile).toBeDefined();
    expect(utilsFile!.content).toMatchSnapshot('test-utils');
  });

  it('should generate correct fixtures', () => {
    const domain = createDomain('Auth', [
      createBehavior('Login', { inputFields: [] }),
    ], [
      createEntity('User', [
        createField('id', 'UUID'),
        createField('email', 'String'),
      ]),
      createEntity('Session', [
        createField('id', 'UUID'),
        createField('token', 'String'),
      ]),
    ]);

    const result = generate(domain, { framework: 'vitest', includeHelpers: true });
    const fixturesFile = result.files.find(f => f.path.includes('fixtures.ts'));

    expect(fixturesFile).toBeDefined();
    expect(fixturesFile!.content).toMatchSnapshot('fixtures');
  });
});
