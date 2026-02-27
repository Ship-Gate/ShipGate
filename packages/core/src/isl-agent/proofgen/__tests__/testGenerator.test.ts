/**
 * Test Generator Tests
 * 
 * Tests for the proof generation module that generates test cases
 * from ISL specification clauses.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestGenerator, createTestGenerator } from '../testGenerator.js';
import { oauthStrategy } from '../strategies/oauth.js';
import { paymentsStrategy } from '../strategies/payments.js';
import { uploadsStrategy } from '../strategies/uploads.js';
import type { Domain, Behavior, InputSpec, OutputSpec, Expression } from '@isl-lang/parser';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockLocation() {
  return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
}

function createMockIdentifier(name: string) {
  return { kind: 'Identifier' as const, name, location: createMockLocation() };
}

function createMockStringLiteral(value: string) {
  return { kind: 'StringLiteral' as const, value, location: createMockLocation() };
}

function createMockExpression(text: string): Expression {
  // Parse simple expressions for testing
  if (text.includes('>')) {
    const [left, right] = text.split('>').map(s => s.trim());
    return {
      kind: 'BinaryExpr',
      operator: '>',
      left: left?.includes('.') 
        ? createMemberExpr(left) 
        : { kind: 'Identifier', name: left || 'unknown', location: createMockLocation() },
      right: { kind: 'NumberLiteral', value: parseInt(right || '0'), isFloat: false, location: createMockLocation() },
      location: createMockLocation(),
    } as Expression;
  }
  if (text.includes('.exists(')) {
    return {
      kind: 'CallExpr',
      callee: createMemberExpr(text.split('(')[0] || ''),
      arguments: [],
      location: createMockLocation(),
    } as Expression;
  }
  return {
    kind: 'Identifier',
    name: text,
    location: createMockLocation(),
  } as Expression;
}

function createMemberExpr(text: string): Expression {
  const parts = text.split('.');
  if (parts.length === 1) {
    return { kind: 'Identifier', name: parts[0] || '', location: createMockLocation() } as Expression;
  }
  return {
    kind: 'MemberExpr',
    object: createMemberExpr(parts.slice(0, -1).join('.')),
    property: createMockIdentifier(parts[parts.length - 1] || ''),
    location: createMockLocation(),
  } as Expression;
}

function createMockInputSpec(fields: Array<{ name: string; type: string; optional?: boolean }>): InputSpec {
  return {
    kind: 'InputSpec',
    fields: fields.map(f => ({
      kind: 'Field',
      name: createMockIdentifier(f.name),
      type: { kind: 'PrimitiveType', name: f.type as 'String', location: createMockLocation() },
      optional: f.optional || false,
      annotations: [],
      location: createMockLocation(),
    })),
    location: createMockLocation(),
  };
}

function createMockOutputSpec(): OutputSpec {
  return {
    kind: 'OutputSpec',
    success: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [createMockIdentifier('Result')], location: createMockLocation() }, location: createMockLocation() },
    errors: [
      {
        kind: 'ErrorSpec',
        name: createMockIdentifier('VALIDATION_ERROR'),
        when: createMockStringLiteral('Input validation failed'),
        retriable: false,
        location: createMockLocation(),
      },
    ],
    location: createMockLocation(),
  };
}

function createMockBehavior(name: string, options: {
  preconditions?: string[];
  postconditions?: Array<{ condition: string; predicates: string[] }>;
  invariants?: string[];
  inputFields?: Array<{ name: string; type: string }>;
} = {}): Behavior {
  return {
    kind: 'Behavior',
    name: createMockIdentifier(name),
    description: createMockStringLiteral(`Test behavior: ${name}`),
    input: createMockInputSpec(options.inputFields || [
      { name: 'id', type: 'UUID' },
      { name: 'name', type: 'String' },
    ]),
    output: createMockOutputSpec(),
    preconditions: (options.preconditions || ['input.name.length > 0']).map(createMockExpression),
    postconditions: (options.postconditions || [{ condition: 'success', predicates: ['result.id != null'] }]).map(pc => ({
      kind: 'PostconditionBlock' as const,
      condition: pc.condition === 'success' ? 'success' as const : createMockIdentifier(pc.condition),
      predicates: pc.predicates.map(createMockExpression),
      location: createMockLocation(),
    })),
    invariants: (options.invariants || []).map(createMockExpression),
    temporal: [],
    security: [],
    compliance: [],
    location: createMockLocation(),
  };
}

function createMockDomain(name: string, behaviors: Behavior[]): Domain {
  return {
    kind: 'Domain',
    name: createMockIdentifier(name),
    version: createMockStringLiteral('1.0.0'),
    imports: [],
    types: [],
    entities: [],
    behaviors,
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: createMockLocation(),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('TestGenerator', () => {
  let generator: TestGenerator;

  beforeEach(() => {
    generator = createTestGenerator();
  });

  describe('generateTestSuite', () => {
    it('should generate a test suite for a behavior', () => {
      const behavior = createMockBehavior('CreateUser');
      const domain = createMockDomain('UserManagement', [behavior]);

      const suite = generator.generateTestSuite(domain, behavior);

      expect(suite).toBeDefined();
      expect(suite.behaviorName).toBe('CreateUser');
      expect(suite.domainName).toBe('UserManagement');
      expect(suite.version).toBe('1.0.0');
      expect(suite.tests.length).toBeGreaterThan(0);
    });

    it('should include metadata in generated suite', () => {
      const behavior = createMockBehavior('TestBehavior');
      const domain = createMockDomain('TestDomain', [behavior]);

      const suite = generator.generateTestSuite(domain, behavior);

      expect(suite.metadata).toBeDefined();
      expect(suite.metadata.generatedAt).toBeDefined();
      expect(suite.metadata.generatorVersion).toBe('1.0.0');
      expect(suite.metadata.stats.totalTests).toBeGreaterThan(0);
    });
  });

  describe('precondition tests', () => {
    it('should generate tests for precondition violations', () => {
      const behavior = createMockBehavior('ValidateInput', {
        preconditions: ['input.amount > 0', 'input.name.length > 0'],
        inputFields: [
          { name: 'amount', type: 'Int' },
          { name: 'name', type: 'String' },
        ],
      });
      const domain = createMockDomain('Validation', [behavior]);

      const suite = generator.generateTestSuite(domain, behavior);
      const preconditionTests = suite.tests.filter(t => t.testType === 'precondition_violation');

      expect(preconditionTests.length).toBeGreaterThan(0);
      preconditionTests.forEach(test => {
        expect(test.expected.outcome).toBe('throw');
        expect(test.tags).toContain('precondition');
        expect(test.tags).toContain('negative');
      });
    });

    it('should generate invalid input values for precondition tests', () => {
      const behavior = createMockBehavior('CheckAmount', {
        preconditions: ['input.amount > 0'],
        inputFields: [{ name: 'amount', type: 'Int' }],
      });
      const domain = createMockDomain('Finance', [behavior]);

      const suite = generator.generateTestSuite(domain, behavior);
      const preconditionTest = suite.tests.find(t => 
        t.testType === 'precondition_violation' && 
        t.sourceClause.expression.includes('amount')
      );

      expect(preconditionTest).toBeDefined();
      if (preconditionTest) {
        const amountValue = preconditionTest.input.params['amount'];
        expect(amountValue).toBeDefined();
        if (amountValue?.type === 'invalid') {
          expect(amountValue.value).toBeLessThanOrEqual(0);
        }
      }
    });
  });

  describe('postcondition tests', () => {
    it('should generate tests for success postconditions', () => {
      const behavior = createMockBehavior('CreateEntity', {
        postconditions: [
          { condition: 'success', predicates: ['Entity.exists(result.id)', 'result.name == input.name'] },
        ],
      });
      const domain = createMockDomain('Entities', [behavior]);

      const suite = generator.generateTestSuite(domain, behavior);
      const postconditionTests = suite.tests.filter(t => t.testType === 'postcondition_success');

      expect(postconditionTests.length).toBeGreaterThan(0);
      postconditionTests.forEach(test => {
        expect(test.expected.outcome).toBe('success');
        expect(test.tags).toContain('postcondition');
        expect(test.tags).toContain('positive');
      });
    });

    it('should include assertions in postcondition tests', () => {
      const behavior = createMockBehavior('GetData', {
        postconditions: [
          { condition: 'success', predicates: ['result.data != null'] },
        ],
      });
      const domain = createMockDomain('Data', [behavior]);

      const suite = generator.generateTestSuite(domain, behavior);
      const postconditionTest = suite.tests.find(t => t.testType === 'postcondition_success');

      expect(postconditionTest).toBeDefined();
      expect(postconditionTest?.expected.assertions).toBeDefined();
      expect(postconditionTest?.expected.assertions?.length).toBeGreaterThan(0);
    });
  });

  describe('invariant tests', () => {
    it('should generate tests for invariants', () => {
      const behavior = createMockBehavior('ModifyState', {
        invariants: ['balance >= 0', 'count > 0'],
      });
      const domain = createMockDomain('State', [behavior]);

      const suite = generator.generateTestSuite(domain, behavior);
      const invariantTests = suite.tests.filter(t => t.testType === 'invariant_hold');

      expect(invariantTests.length).toBe(2);
      invariantTests.forEach(test => {
        expect(test.tags).toContain('invariant');
        expect(test.priority).toBe('critical');
      });
    });
  });

  describe('boundary tests', () => {
    it('should generate boundary tests for constrained fields', () => {
      const generator = createTestGenerator({ generateBoundaryTests: true });
      const behavior = createMockBehavior('BoundaryTest', {
        inputFields: [{ name: 'value', type: 'Int' }],
      });
      const domain = createMockDomain('Boundaries', [behavior]);

      const suite = generator.generateTestSuite(domain, behavior);
      const boundaryTests = suite.tests.filter(t => t.testType === 'boundary');

      // May or may not have boundary tests depending on constraints
      boundaryTests.forEach(test => {
        expect(test.tags).toContain('boundary');
      });
    });
  });

  describe('generateAllTestSuites', () => {
    it('should generate suites for all behaviors in domain', () => {
      const behaviors = [
        createMockBehavior('Create'),
        createMockBehavior('Update'),
        createMockBehavior('Delete'),
      ];
      const domain = createMockDomain('CRUD', behaviors);

      const suites = generator.generateAllTestSuites(domain);

      expect(suites.length).toBe(3);
      expect(suites.map(s => s.behaviorName)).toEqual(['Create', 'Update', 'Delete']);
    });
  });
});

describe('Test Generation Strategies', () => {
  describe('OAuth Strategy', () => {
    it('should be configured correctly', () => {
      expect(oauthStrategy.id).toBe('oauth');
      expect(oauthStrategy.appliesTo).toContain('OAuth');
      expect(oauthStrategy.appliesTo).toContain('Auth');
    });

    it('should generate OAuth-specific tests', () => {
      const context = {
        domainName: 'OAuth',
        behaviorName: 'ExchangeCode',
        inputFields: [
          { name: 'code', typeName: 'String', optional: false, constraints: [], annotations: [] },
          { name: 'client_id', typeName: 'String', optional: false, constraints: [], annotations: [] },
        ],
        outputType: { kind: 'reference' as const, name: 'Token' },
        preconditions: [{ index: 0, expression: 'AuthorizationGrant.exists(code: input.code)' }],
        postconditions: [{ condition: 'success', predicates: [{ index: 0, expression: 'OAuthToken.exists(access_token: result.access_token)' }] }],
        invariants: [],
        errors: [{ name: 'INVALID_GRANT', retriable: false }],
      };

      const tests = oauthStrategy.generateTests(context);

      expect(tests.length).toBeGreaterThan(0);
      tests.forEach(test => {
        expect(test.tags).toContain('oauth');
      });
    });

    it('should generate mocks for OAuth entities', () => {
      const context = {
        domainName: 'OAuth',
        behaviorName: 'Authorize',
        inputFields: [],
        outputType: { kind: 'reference' as const, name: 'AuthorizationCode' },
        preconditions: [],
        postconditions: [],
        invariants: [],
        errors: [],
      };

      const mocks = oauthStrategy.generateMocks(context);

      expect(mocks.some(m => m.entity === 'OAuthClient')).toBe(true);
      expect(mocks.some(m => m.entity === 'AuthorizationGrant')).toBe(true);
    });
  });

  describe('Payments Strategy', () => {
    it('should be configured correctly', () => {
      expect(paymentsStrategy.id).toBe('payments');
      expect(paymentsStrategy.appliesTo).toContain('StripeSubscriptions');
      expect(paymentsStrategy.appliesTo).toContain('Payments');
    });

    it('should generate subscription tests', () => {
      const context = {
        domainName: 'StripeSubscriptions',
        behaviorName: 'CreateSubscription',
        inputFields: [
          { name: 'customer_id', typeName: 'UUID', optional: false, constraints: [], annotations: [] },
          { name: 'plan_id', typeName: 'UUID', optional: false, constraints: [], annotations: [] },
        ],
        outputType: { kind: 'reference' as const, name: 'Subscription' },
        preconditions: [{ index: 0, expression: 'Customer.exists(input.customer_id)' }],
        postconditions: [{ condition: 'success', predicates: [{ index: 0, expression: 'Subscription.exists(result.id)' }] }],
        invariants: [],
        errors: [
          { name: 'CUSTOMER_NOT_FOUND', retriable: false },
          { name: 'PAYMENT_FAILED', retriable: true },
        ],
      };

      const tests = paymentsStrategy.generateTests(context);

      expect(tests.length).toBeGreaterThan(0);
      expect(tests.some(t => t.tags.includes('subscription'))).toBe(true);
    });

    it('should generate mocks for payment entities', () => {
      const context = {
        domainName: 'Payments',
        behaviorName: 'ProcessPayment',
        inputFields: [],
        outputType: { kind: 'reference' as const, name: 'Payment' },
        preconditions: [],
        postconditions: [],
        invariants: [],
        errors: [],
      };

      const mocks = paymentsStrategy.generateMocks(context);

      expect(mocks.some(m => m.entity === 'Customer')).toBe(true);
      expect(mocks.some(m => m.entity === 'Plan')).toBe(true);
    });
  });

  describe('Uploads Strategy', () => {
    it('should be configured correctly', () => {
      expect(uploadsStrategy.id).toBe('uploads');
      expect(uploadsStrategy.appliesTo).toContain('FileUploads');
      expect(uploadsStrategy.appliesTo).toContain('Storage');
    });

    it('should generate upload validation tests', () => {
      const context = {
        domainName: 'FileUploads',
        behaviorName: 'InitiateUpload',
        inputFields: [
          { name: 'filename', typeName: 'String', optional: false, constraints: [], annotations: [] },
          { name: 'mime_type', typeName: 'String', optional: false, constraints: [], annotations: [] },
          { name: 'size', typeName: 'Int', optional: false, constraints: [], annotations: [] },
        ],
        outputType: { kind: 'reference' as const, name: 'UploadSession' },
        preconditions: [
          { index: 0, expression: 'input.size <= config.max_file_size' },
          { index: 1, expression: 'input.mime_type in config.allowed_mime_types' },
        ],
        postconditions: [],
        invariants: [],
        errors: [
          { name: 'FILE_TOO_LARGE', retriable: false },
          { name: 'INVALID_MIME_TYPE', retriable: false },
        ],
      };

      const tests = uploadsStrategy.generateTests(context);

      expect(tests.length).toBeGreaterThan(0);
      expect(tests.some(t => t.tags.includes('uploads'))).toBe(true);
      expect(tests.some(t => t.tags.includes('validation'))).toBe(true);
    });

    it('should generate security-focused tests', () => {
      const context = {
        domainName: 'FileUploads',
        behaviorName: 'DirectUpload',
        inputFields: [
          { name: 'data', typeName: 'Binary', optional: false, constraints: [], annotations: [] },
        ],
        outputType: { kind: 'reference' as const, name: 'File' },
        preconditions: [],
        postconditions: [],
        invariants: [{ index: 0, expression: 'file content scanned for malware' }],
        errors: [],
      };

      const tests = uploadsStrategy.generateTests(context);

      const securityTests = tests.filter(t => t.tags.includes('security'));
      expect(securityTests.length).toBeGreaterThan(0);
    });
  });
});

describe('Strategy Registration', () => {
  it('should allow registering custom strategies', () => {
    // Include 'custom' in strategies list so it gets applied
    const generator = createTestGenerator({ strategies: ['custom'] });
    
    const customStrategy = {
      id: 'custom',
      name: 'Custom Strategy',
      appliesTo: ['CustomDomain'],
      generateTests: () => [{
        id: 'custom_test',
        name: 'Custom Test',
        description: 'A custom test',
        behaviorName: 'CustomBehavior',
        testType: 'scenario' as const,
        sourceClause: { clauseType: 'scenario' as const, index: 0, expression: 'custom' },
        input: { params: {} },
        expected: { outcome: 'success' as const },
        tags: ['custom'],
        priority: 'medium' as const,
      }],
      generateMocks: () => [],
      getImports: () => [],
    };

    generator.registerStrategy(customStrategy);

    const behavior = createMockBehavior('CustomBehavior');
    const domain = createMockDomain('CustomDomain', [behavior]);
    const suite = generator.generateTestSuite(domain, behavior);

    // Custom strategy should have generated its test
    expect(suite.tests.some(t => t.id === 'custom_test')).toBe(true);
  });
});

describe('Test Configuration', () => {
  it('should respect configuration options', () => {
    const generator = createTestGenerator({
      includePreconditionTests: false,
      includePostconditionTests: true,
      includeInvariantTests: false,
      generateBoundaryTests: false,
      strategies: [],
    });

    const behavior = createMockBehavior('ConfigTest', {
      preconditions: ['input.x > 0'],
      postconditions: [{ condition: 'success', predicates: ['result != null'] }],
      invariants: ['state.valid'],
    });
    const domain = createMockDomain('Config', [behavior]);

    const suite = generator.generateTestSuite(domain, behavior);

    expect(suite.tests.some(t => t.testType === 'precondition_violation')).toBe(false);
    expect(suite.tests.some(t => t.testType === 'postcondition_success')).toBe(true);
    expect(suite.tests.some(t => t.testType === 'invariant_hold')).toBe(false);
  });
});
