// ============================================================================
// Test Generator - Golden Snapshot Tests
// Verifies generated test files match expected output exactly.
// Ensures ZERO TODO comments in generated code.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate, generateWithSynthesis } from '../src/generator';
import {
  compileToAssertion,
  compileTemporalAssertion,
  compileSecurityAssertion,
  compileLifecycleAssertion,
  compileNegativeAssertion,
} from '../src/expected-outcome';
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

function createCallExpr(callee: AST.Expression, args: AST.Expression[]): AST.CallExpr {
  return { kind: 'CallExpr', callee, arguments: args, location: mockLocation() };
}

function createIdentifier(name: string): AST.Identifier {
  return { kind: 'Identifier', name, location: mockLocation() };
}

function createOldExpr(expr: AST.Expression): AST.OldExpr {
  return { kind: 'OldExpr', expression: expr, location: mockLocation() };
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

function createTemporalSpec(
  operator: AST.TemporalSpec['operator'],
  predicate: AST.Expression,
  duration?: { value: number; unit: AST.DurationLiteral['unit'] }
): AST.TemporalSpec {
  return {
    kind: 'TemporalSpec',
    operator,
    predicate,
    duration: duration ? { kind: 'DurationLiteral', value: duration.value, unit: duration.unit, location: mockLocation() } : undefined,
    location: mockLocation(),
  };
}

function createSecuritySpec(
  type: AST.SecuritySpec['type'],
  details: AST.Expression
): AST.SecuritySpec {
  return {
    kind: 'SecuritySpec',
    type,
    details,
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
  temporal?: AST.TemporalSpec[];
  security?: AST.SecuritySpec[];
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
    temporal: options.temporal || [],
    security: options.security || [],
    compliance: [],
    location: mockLocation(),
  };
}

function createDomain(name: string, behaviors: AST.Behavior[], entities: AST.Entity[] = []): AST.Domain {
  return {
    kind: 'Domain',
    name: { kind: 'Identifier', name, location: mockLocation() },
    version: { kind: 'StringLiteral', value: '1.0.0', location: mockLocation() },
    uses: [],
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
// ZERO TODO ASSERTION HELPER
// ============================================================================

function assertNoTodos(content: string, label: string) {
  const todoMatches = content.match(/\/\/\s*TODO/gi) || [];
  const todoLineMatches = content.match(/\/\*\s*TODO/gi) || [];
  const allTodos = [...todoMatches, ...todoLineMatches];
  expect(allTodos, `Found ${allTodos.length} TODO(s) in ${label}`).toHaveLength(0);
}

// ============================================================================
// AUTH-LOGIN SNAPSHOT
// ============================================================================

describe('Auth-Login Snapshot', () => {
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
          // Session.exists(result.session.id)
          createCallExpr(
            createMemberExpr(createIdentifier('Session'), 'exists'),
            [createMemberExpr(createResultExpr('session'), 'id')]
          ),
          // result.access_token != null
          createBinaryExpr(createResultExpr('access_token'), '!=', { kind: 'NullLiteral', location: mockLocation() }),
        ]),
      ],
      errors: [
        createErrorSpec('INVALID_CREDENTIALS', 'Email or password incorrect', true),
        createErrorSpec('ACCOUNT_LOCKED', 'Account locked', true),
      ],
    }),
  ], [
    createEntity('User', [createField('id', 'UUID'), createField('email', 'String')]),
    createEntity('Session', [createField('id', 'UUID'), createField('token', 'String')]),
  ]);

  it('generates correct test structure', () => {
    const result = generate(domain, { framework: 'vitest' });
    const testFile = result.files.find(f => f.path.includes('Login.test.ts'));
    expect(testFile).toBeDefined();
    expect(testFile!.content).toMatchSnapshot('auth-login-test');
  });

  it('produces zero TODO comments', () => {
    const result = generate(domain, { framework: 'vitest' });
    for (const file of result.files) {
      assertNoTodos(file.content, file.path);
    }
  });

  it('synthesis path generates smart assertions with proper matchers', () => {
    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      baseSeed: 42,
    });
    const testFile = result.files.find(f => f.type === 'test');
    expect(testFile).toBeDefined();
    // Synthesis path should use .not.toBe(null) for != null
    expect(testFile!.content).toContain('.not.toBe(');
    // Synthesis path should use await for entity methods
    expect(testFile!.content).toContain('await Session.exists');
  });
});

// ============================================================================
// USER-CREATE SNAPSHOT
// ============================================================================

describe('User-Create Snapshot', () => {
  const domain = createDomain('UserManagement', [
    createBehavior('CreateUser', {
      description: 'Create a new user account',
      inputFields: [
        createField('email', 'String'),
        createField('name', 'String'),
        createField('password', 'String', true),
      ],
      preconditions: [
        createBinaryExpr(createMemberExpr(createInputExpr('email'), 'length'), '>', createNumberLiteral(0)),
        createBinaryExpr(createMemberExpr(createInputExpr('name'), 'length'), '>', createNumberLiteral(0)),
        createBinaryExpr(createMemberExpr(createInputExpr('password'), 'length'), '>=', createNumberLiteral(8)),
      ],
      postconditions: [
        createPostconditionBlock('success', [
          // User.exists(result.id)
          createCallExpr(
            createMemberExpr(createIdentifier('User'), 'exists'),
            [createResultExpr('id')]
          ),
          // result.email == input.email
          createBinaryExpr(createResultExpr('email'), '==', createInputExpr('email')),
          // result.name == input.name
          createBinaryExpr(createResultExpr('name'), '==', createInputExpr('name')),
          // result.status == "ACTIVE"
          createBinaryExpr(createResultExpr('status'), '==', createStringLiteral('ACTIVE')),
        ]),
        createPostconditionBlock('EMAIL_ALREADY_EXISTS', [
          // User.count == old(User.count)
          createBinaryExpr(
            createCallExpr(createMemberExpr(createIdentifier('User'), 'count'), []),
            '==',
            createOldExpr(createCallExpr(createMemberExpr(createIdentifier('User'), 'count'), []))
          ),
        ]),
      ],
      errors: [
        createErrorSpec('EMAIL_ALREADY_EXISTS', 'Email already registered', false),
        createErrorSpec('INVALID_EMAIL', 'Email format invalid', false),
      ],
    }),
  ], [
    createEntity('User', [
      createField('id', 'UUID'),
      createField('email', 'String'),
      createField('name', 'String'),
      createField('status', 'String'),
    ]),
  ]);

  it('generates correct test structure', () => {
    const result = generate(domain, { framework: 'vitest' });
    const testFile = result.files.find(f => f.path.includes('CreateUser.test.ts'));
    expect(testFile).toBeDefined();
    expect(testFile!.content).toMatchSnapshot('user-create-test');
  });

  it('produces zero TODO comments', () => {
    const result = generate(domain, { framework: 'vitest' });
    for (const file of result.files) {
      assertNoTodos(file.content, file.path);
    }
  });

  it('synthesis path generates proper equality assertions', () => {
    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      baseSeed: 42,
    });
    const testFile = result.files.find(f => f.type === 'test');
    expect(testFile).toBeDefined();
    // Synthesis path should use .toBe() for == comparisons
    expect(testFile!.content).toContain('.toBe(');
  });
});

// ============================================================================
// PAYMENT-CHARGE SNAPSHOT
// ============================================================================

describe('Payment-Charge Snapshot', () => {
  const domain = createDomain('Billing', [
    createBehavior('ChargePayment', {
      description: 'Charge a payment',
      inputFields: [
        createField('customer_id', 'UUID'),
        createField('amount', 'Decimal'),
        createField('currency', 'String'),
        createField('description', 'String'),
      ],
      preconditions: [
        createBinaryExpr(createInputExpr('amount'), '>', createNumberLiteral(0)),
      ],
      postconditions: [
        createPostconditionBlock('success', [
          // Charge.exists(result.id)
          createCallExpr(
            createMemberExpr(createIdentifier('Charge'), 'exists'),
            [createResultExpr('id')]
          ),
          // result.amount == input.amount
          createBinaryExpr(createResultExpr('amount'), '==', createInputExpr('amount')),
          // result.currency == input.currency
          createBinaryExpr(createResultExpr('currency'), '==', createInputExpr('currency')),
          // result.status == "COMPLETED"
          createBinaryExpr(createResultExpr('status'), '==', createStringLiteral('COMPLETED')),
        ]),
      ],
      errors: [
        createErrorSpec('INSUFFICIENT_FUNDS', 'Not enough funds', false),
        createErrorSpec('INVALID_AMOUNT', 'Amount not positive', false),
        createErrorSpec('CUSTOMER_NOT_FOUND', 'Customer does not exist', false),
      ],
      temporal: [
        createTemporalSpec('within', createIdentifier('true'), { value: 5, unit: 'seconds' }),
      ],
    }),
  ], [
    createEntity('Charge', [
      createField('id', 'UUID'),
      createField('amount', 'Decimal'),
      createField('currency', 'String'),
      createField('status', 'String'),
    ]),
    createEntity('Customer', [
      createField('id', 'UUID'),
      createField('balance', 'Decimal'),
    ]),
  ]);

  it('generates correct test structure with temporal', () => {
    const result = generate(domain, { framework: 'vitest' });
    const testFile = result.files.find(f => f.path.includes('ChargePayment.test.ts'));
    expect(testFile).toBeDefined();
    expect(testFile!.content).toMatchSnapshot('payment-charge-test');
  });

  it('produces zero TODO comments', () => {
    const result = generate(domain, { framework: 'vitest' });
    for (const file of result.files) {
      assertNoTodos(file.content, file.path);
    }
  });

  it('synthesis path generates equality and entity assertions', () => {
    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      baseSeed: 42,
    });
    const testFile = result.files.find(f => f.type === 'test');
    expect(testFile).toBeDefined();
    const content = testFile!.content;
    // Synthesis path should use .toBe() for == comparisons
    expect(content).toContain('.toBe(');
  });
});

// ============================================================================
// FILE-UPLOAD SNAPSHOT
// ============================================================================

describe('File-Upload Snapshot', () => {
  const domain = createDomain('FileStorage', [
    createBehavior('UploadFile', {
      description: 'Upload a file',
      inputFields: [
        createField('filename', 'String'),
        createField('content_type', 'String'),
        createField('size', 'Int'),
        createField('data', 'String'),
      ],
      preconditions: [
        createBinaryExpr(createInputExpr('size'), '>', createNumberLiteral(0)),
        createBinaryExpr(createInputExpr('size'), '<=', createNumberLiteral(10485760)),
        createBinaryExpr(createMemberExpr(createInputExpr('filename'), 'length'), '>', createNumberLiteral(0)),
      ],
      postconditions: [
        createPostconditionBlock('success', [
          // StoredFile.exists(result.id)
          createCallExpr(
            createMemberExpr(createIdentifier('StoredFile'), 'exists'),
            [createResultExpr('id')]
          ),
          // result.filename == input.filename
          createBinaryExpr(createResultExpr('filename'), '==', createInputExpr('filename')),
          // result.content_type == input.content_type
          createBinaryExpr(createResultExpr('content_type'), '==', createInputExpr('content_type')),
          // result.size == input.size
          createBinaryExpr(createResultExpr('size'), '==', createInputExpr('size')),
          // result.url.length > 0
          createBinaryExpr(createMemberExpr(createResultExpr('url'), 'length'), '>', createNumberLiteral(0)),
          // result.checksum.length > 0
          createBinaryExpr(createMemberExpr(createResultExpr('checksum'), 'length'), '>', createNumberLiteral(0)),
        ]),
      ],
      errors: [
        createErrorSpec('FILE_TOO_LARGE', 'File exceeds maximum size', false),
        createErrorSpec('INVALID_TYPE', 'File type not allowed', false),
        createErrorSpec('EMPTY_FILE', 'File has zero bytes', false),
      ],
    }),
  ], [
    createEntity('StoredFile', [
      createField('id', 'UUID'),
      createField('filename', 'String'),
      createField('url', 'String'),
      createField('size', 'Int'),
    ]),
  ]);

  it('generates correct test structure', () => {
    const result = generate(domain, { framework: 'vitest' });
    const testFile = result.files.find(f => f.path.includes('UploadFile.test.ts'));
    expect(testFile).toBeDefined();
    expect(testFile!.content).toMatchSnapshot('file-upload-test');
  });

  it('produces zero TODO comments', () => {
    const result = generate(domain, { framework: 'vitest' });
    for (const file of result.files) {
      assertNoTodos(file.content, file.path);
    }
  });

  it('synthesis path generates toBeGreaterThan for > comparisons', () => {
    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      baseSeed: 42,
    });
    const testFile = result.files.find(f => f.type === 'test');
    expect(testFile).toBeDefined();
    // Synthesis path should use .toBeGreaterThan for > comparisons
    expect(testFile!.content).toContain('.toBeGreaterThan(');
  });
});

// ============================================================================
// RATE-LIMIT SNAPSHOT
// ============================================================================

describe('Rate-Limit Snapshot', () => {
  const domain = createDomain('APIGateway', [
    createBehavior('HandleRequest', {
      description: 'Handle API request with rate limiting',
      inputFields: [
        createField('client_id', 'String'),
        createField('endpoint', 'String'),
        createField('method', 'String'),
      ],
      preconditions: [
        createBinaryExpr(createMemberExpr(createInputExpr('client_id'), 'length'), '>', createNumberLiteral(0)),
        createBinaryExpr(createMemberExpr(createInputExpr('endpoint'), 'length'), '>', createNumberLiteral(0)),
      ],
      postconditions: [
        createPostconditionBlock('success', [
          // result.allowed == true
          createBinaryExpr(createResultExpr('allowed'), '==', { kind: 'BooleanLiteral', value: true, location: mockLocation() }),
          // result.remaining >= 0
          createBinaryExpr(createResultExpr('remaining'), '>=', createNumberLiteral(0)),
        ]),
        createPostconditionBlock('RATE_LIMITED', [
          // result.allowed == false
          createBinaryExpr(createResultExpr('allowed'), '==', { kind: 'BooleanLiteral', value: false, location: mockLocation() }),
          // result.remaining == 0
          createBinaryExpr(createResultExpr('remaining'), '==', createNumberLiteral(0)),
        ]),
      ],
      errors: [
        createErrorSpec('RATE_LIMITED', 'Rate limit exceeded', true),
        createErrorSpec('INVALID_ENDPOINT', 'Endpoint does not exist', false),
      ],
      security: [
        createSecuritySpec('rate_limit', createNumberLiteral(100)),
      ],
      temporal: [
        createTemporalSpec('within', createIdentifier('true'), { value: 50, unit: 'ms' }),
      ],
    }),
  ], [
    createEntity('RateLimitEntry', [
      createField('id', 'UUID'),
      createField('client_id', 'String'),
      createField('request_count', 'Int'),
    ]),
  ]);

  it('generates correct test structure with security and temporal', () => {
    const result = generate(domain, { framework: 'vitest' });
    const testFile = result.files.find(f => f.path.includes('HandleRequest.test.ts'));
    expect(testFile).toBeDefined();
    expect(testFile!.content).toMatchSnapshot('rate-limit-test');
  });

  it('produces zero TODO comments', () => {
    const result = generate(domain, { framework: 'vitest' });
    for (const file of result.files) {
      assertNoTodos(file.content, file.path);
    }
  });

  it('synthesis path generates proper comparison assertions', () => {
    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      baseSeed: 42,
    });
    const testFile = result.files.find(f => f.type === 'test');
    expect(testFile).toBeDefined();
    const content = testFile!.content;
    // Synthesis path should use .toBeGreaterThanOrEqual for >=
    expect(content).toContain('.toBeGreaterThanOrEqual(');
    // Synthesis path should use .toBe(true)
    expect(content).toContain('.toBe(true)');
  });
});

// ============================================================================
// SYNTHESIS PATH SNAPSHOTS
// ============================================================================

describe('Synthesis Path Snapshots', () => {
  const domain = createDomain('Auth', [
    createBehavior('Login', {
      description: 'Authenticate user',
      inputFields: [
        createField('email', 'String'),
        createField('password', 'String', true),
      ],
      preconditions: [
        createBinaryExpr(createMemberExpr(createInputExpr('email'), 'length'), '>', createNumberLiteral(0)),
      ],
      postconditions: [
        createPostconditionBlock('success', [
          createBinaryExpr(createResultExpr('access_token'), '!=', { kind: 'NullLiteral', location: mockLocation() }),
        ]),
      ],
      errors: [
        createErrorSpec('INVALID_CREDENTIALS', 'Invalid', true),
      ],
    }),
  ], [
    createEntity('User', [createField('id', 'UUID'), createField('email', 'String')]),
    createEntity('Session', [createField('id', 'UUID')]),
  ]);

  it('generates synthesized tests with zero TODOs', () => {
    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      baseSeed: 42,
    });
    expect(result.success).toBe(true);
    for (const file of result.files) {
      assertNoTodos(file.content, file.path);
    }
  });

  it('generates synthesized test file snapshot', () => {
    const result = generateWithSynthesis(domain, {
      framework: 'vitest',
      useSynthesis: true,
      baseSeed: 42,
    });
    const testFile = result.files.find(f => f.type === 'test');
    expect(testFile).toBeDefined();
    // Strip timestamps and generation dates for deterministic snapshot
    const sanitized = testFile!.content
      .replace(/Generated: \d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'Generated: TIMESTAMP')
      .replace(/Seed: \d+/g, 'Seed: SEED');
    expect(sanitized).toMatchSnapshot('synthesis-auth-login');
  });
});

// ============================================================================
// ASSERTION COMPILATION UNIT TESTS
// ============================================================================

describe('Assertion Compilation (direct)', () => {
  it('compiles result.email == input.email to proper toBe', () => {
    const expr = createBinaryExpr(createResultExpr('email'), '==', createInputExpr('email'));
    const code = compileToAssertion(expr, [], []);
    expect(code).toBe('expect(result.data.email).toBe(input.email);');
  });

  it('compiles result.token.length > 0 to toBeGreaterThan', () => {
    const expr = createBinaryExpr(
      createMemberExpr(createResultExpr('token'), 'length'),
      '>',
      createNumberLiteral(0)
    );
    const code = compileToAssertion(expr, [], []);
    expect(code).toBe('expect(result.data.token.length).toBeGreaterThan(0);');
  });

  it('compiles Entity.exists(result.id) to await entity check', () => {
    const expr = createCallExpr(
      createMemberExpr(createIdentifier('User'), 'exists'),
      [createResultExpr('id')]
    );
    const code = compileToAssertion(expr, ['User'], []);
    expect(code).toContain('expect(await User.exists(');
    expect(code).toContain('.toBe(true)');
  });

  it('compiles != null to .not.toBe(null)', () => {
    const expr = createBinaryExpr(
      createResultExpr('token'),
      '!=',
      { kind: 'NullLiteral', location: mockLocation() }
    );
    const code = compileToAssertion(expr, [], []);
    expect(code).toBe('expect(result.data.token).not.toBe(null);');
  });

  it('compiles >= to toBeGreaterThanOrEqual', () => {
    const expr = createBinaryExpr(createResultExpr('count'), '>=', createNumberLiteral(1));
    const code = compileToAssertion(expr, [], []);
    expect(code).toBe('expect(result.data.count).toBeGreaterThanOrEqual(1);');
  });

  it('compiles <= to toBeLessThanOrEqual', () => {
    const expr = createBinaryExpr(createResultExpr('latency'), '<=', createNumberLiteral(100));
    const code = compileToAssertion(expr, [], []);
    expect(code).toBe('expect(result.data.latency).toBeLessThanOrEqual(100);');
  });

  it('compiles "and" to two separate assertions', () => {
    const expr = createBinaryExpr(
      createBinaryExpr(createResultExpr('a'), '==', createNumberLiteral(1)),
      'and',
      createBinaryExpr(createResultExpr('b'), '==', createNumberLiteral(2))
    );
    const code = compileToAssertion(expr, [], []);
    expect(code).toContain('expect(result.data.a).toBe(1);');
    expect(code).toContain('expect(result.data.b).toBe(2);');
  });

  it('compiles "or" to expect(x || y).toBe(true)', () => {
    const expr = createBinaryExpr(
      createBinaryExpr(createResultExpr('status'), '==', createStringLiteral('A')),
      'or',
      createBinaryExpr(createResultExpr('status'), '==', createStringLiteral('B'))
    );
    const code = compileToAssertion(expr, [], []);
    expect(code).toContain('||');
    expect(code).toContain('.toBe(true)');
  });

  it('compiles old() expression with captures', () => {
    const captures: string[] = [];
    const expr = createBinaryExpr(
      createOldExpr(
        createCallExpr(createMemberExpr(createIdentifier('User'), 'count'), [])
      ),
      '==',
      createCallExpr(createMemberExpr(createIdentifier('User'), 'count'), [])
    );
    const code = compileToAssertion(expr, ['User'], captures);
    expect(captures.length).toBeGreaterThan(0);
    expect(code).toContain('__old__');
    expect(code).toContain('.toBe(');
  });

  it('never produces TODO in any compiled assertion', () => {
    const expressions = [
      createBinaryExpr(createResultExpr('x'), '==', createNumberLiteral(1)),
      createBinaryExpr(createResultExpr('x'), '!=', createStringLiteral('bad')),
      createBinaryExpr(createResultExpr('x'), '>', createNumberLiteral(0)),
      createBinaryExpr(createResultExpr('x'), '>=', createNumberLiteral(0)),
      createBinaryExpr(createResultExpr('x'), '<', createNumberLiteral(100)),
      createBinaryExpr(createResultExpr('x'), '<=', createNumberLiteral(100)),
      createCallExpr(createMemberExpr(createIdentifier('E'), 'exists'), [createResultExpr('id')]),
    ];
    for (const expr of expressions) {
      const code = compileToAssertion(expr, ['E'], []);
      expect(code).not.toContain('TODO');
    }
  });
});

// ============================================================================
// TEMPORAL & SECURITY ASSERTION TESTS
// ============================================================================

describe('Temporal Assertion Compilation', () => {
  it('compiles within to timing check', () => {
    const spec = createTemporalSpec('within', createIdentifier('true'), { value: 200, unit: 'ms' });
    const assertion = compileTemporalAssertion(spec, 'TestBehavior');
    expect(assertion.code).toContain('performance.now()');
    expect(assertion.code).toContain('toBeLessThanOrEqual(200)');
    expect(assertion.code).not.toContain('TODO');
  });

  it('compiles eventually to polling loop', () => {
    const spec = createTemporalSpec('eventually', createIdentifier('completed'), { value: 5, unit: 'seconds' });
    const assertion = compileTemporalAssertion(spec, 'TestBehavior');
    expect(assertion.code).toContain('deadline');
    expect(assertion.code).toContain('setTimeout');
    expect(assertion.code).toContain('expect(satisfied).toBe(true)');
    expect(assertion.code).not.toContain('TODO');
  });
});

describe('Security Assertion Compilation', () => {
  it('compiles rate_limit to repeated call test', () => {
    const spec = createSecuritySpec('rate_limit', createNumberLiteral(100));
    const assertion = compileSecurityAssertion(spec, 'TestBehavior');
    expect(assertion.code).toContain('for (let i = 0; i < 101; i++)');
    expect(assertion.code).toContain('toBeLessThanOrEqual(100)');
    expect(assertion.code).not.toContain('TODO');
  });

  it('compiles requires to auth check', () => {
    const spec = createSecuritySpec('requires', createIdentifier('authenticated'));
    const assertion = compileSecurityAssertion(spec, 'TestBehavior');
    expect(assertion.code).toContain('auth: undefined');
    expect(assertion.code).toContain('UNAUTHORIZED');
    expect(assertion.code).not.toContain('TODO');
  });
});

describe('Lifecycle Assertion Compilation', () => {
  it('compiles state transition to assertion', () => {
    const assertion = compileLifecycleAssertion('PENDING', 'ACTIVE', 'Order', 'ProcessOrder');
    expect(assertion.code).toContain("status: 'PENDING'");
    expect(assertion.code).toContain("expect(updated?.status).toBe('ACTIVE')");
    expect(assertion.code).not.toContain('TODO');
  });
});

describe('Negative Assertion Compilation', () => {
  it('compiles must_not to toBeFalsy', () => {
    const expr = createBinaryExpr(createResultExpr('deleted'), '==', { kind: 'BooleanLiteral', value: true, location: mockLocation() });
    const assertion = compileNegativeAssertion(expr, []);
    expect(assertion.code).toContain('toBeFalsy');
    expect(assertion.code).not.toContain('TODO');
  });
});

// ============================================================================
// METADATA SNAPSHOTS
// ============================================================================

describe('Metadata Snapshots', () => {
  it('generates correct metadata structure', () => {
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
  it('generates correct test utilities', () => {
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

  it('generates correct fixtures', () => {
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
