/**
 * Intent Coherence Validator Tests
 * 
 * Demonstrates validation failures and fixes for:
 * - encryption-required: requires sensitive fields
 * - audit-required: requires auditable action label
 * - rate-limit-required: requires endpoint classification
 */

import { describe, it, expect } from 'vitest';
import {
  validateSingleIntent,
  extractSensitiveFields,
  extractSecurityConfig,
  extractIntentDeclarations,
  INTENT_ENCRYPTION_REQUIRED,
  INTENT_AUDIT_REQUIRED,
  INTENT_RATE_LIMIT_REQUIRED,
  type IntentDeclaration,
} from './intent-coherence.js';

// ============================================================================
// Test Helpers - Create minimal AST structures
// ============================================================================

function createBehavior(overrides: Partial<TestBehavior> = {}): TestBehavior {
  return {
    kind: 'BehaviorDeclaration',
    name: { kind: 'Identifier', name: 'TestBehavior', span: createSpan() },
    span: createSpan(),
    input: { kind: 'InputBlock', fields: [], span: createSpan() },
    output: { kind: 'OutputBlock', success: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'Boolean', span: createSpan() }, span: createSpan() }, errors: [], span: createSpan() },
    preconditions: null,
    postconditions: null,
    invariants: [],
    temporal: null,
    security: null,
    compliance: null,
    ...overrides,
  } as TestBehavior;
}

function createSpan() {
  return {
    file: 'test.isl',
    start: { line: 1, column: 0, offset: 0 },
    end: { line: 1, column: 10, offset: 10 },
  };
}

function createLocation() {
  return {
    file: 'test.isl',
    line: 1,
    column: 0,
    endLine: 1,
    endColumn: 10,
  };
}

function createIntent(name: string, behaviorName = 'TestBehavior'): IntentDeclaration {
  return {
    name,
    location: createLocation(),
    behavior: behaviorName,
  };
}

function createField(name: string, annotations: string[] = [], constraints: string[] = []): TestField {
  return {
    kind: 'FieldDeclaration',
    name: { kind: 'Identifier', name, span: createSpan() },
    type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'String', span: createSpan() }, span: createSpan() },
    optional: false,
    annotations: annotations.map(a => ({
      kind: 'Annotation',
      name: { kind: 'Identifier', name: a, span: createSpan() },
      span: createSpan(),
    })),
    constraints: constraints.map(c => ({
      kind: 'TypeConstraint',
      name: { kind: 'Identifier', name: c, span: createSpan() },
      value: { kind: 'BooleanLiteral', value: true, span: createSpan() },
      span: createSpan(),
    })),
    span: createSpan(),
  } as TestField;
}

function createSecurityRequirement(type: string, expression: string): TestSecurityRequirement {
  return {
    kind: 'SecurityRequirement',
    type,
    expression: { kind: 'Identifier', name: expression, span: createSpan() },
    span: createSpan(),
  };
}

// Type definitions for test structures
interface TestBehavior {
  kind: 'BehaviorDeclaration';
  name: { kind: 'Identifier'; name: string; span: object };
  span: object;
  input: { kind: 'InputBlock'; fields: TestField[]; span: object } | null;
  output: object | null;
  preconditions: object | null;
  postconditions: object | null;
  invariants: object[];
  temporal: object | null;
  security: { kind: 'SecurityBlock'; requirements: TestSecurityRequirement[] } | null;
  compliance: object | null;
}

interface TestField {
  kind: 'FieldDeclaration';
  name: { kind: 'Identifier'; name: string; span: object };
  type: object;
  optional: boolean;
  annotations: object[];
  constraints: object[];
  span: object;
}

interface TestSecurityRequirement {
  kind: 'SecurityRequirement';
  type: string;
  expression: object;
  span: object;
}

// ============================================================================
// encryption-required Tests
// ============================================================================

describe('encryption-required validation', () => {
  describe('FAILURES - when sensitive fields are missing', () => {
    it('should fail when behavior has no sensitive fields', () => {
      const behavior = createBehavior({
        input: {
          kind: 'InputBlock',
          fields: [
            createField('username'),
            createField('email'),
          ],
          span: createSpan(),
        },
      });

      const intent = createIntent(INTENT_ENCRYPTION_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(false);
      expect(result.missingRequirements).toContain('No sensitive fields declared');
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.includes('[sensitive]'))).toBe(true);
    });

    it('should fail when fields have non-sensitive annotations', () => {
      const behavior = createBehavior({
        input: {
          kind: 'InputBlock',
          fields: [
            createField('id', ['unique', 'indexed']),
            createField('name', ['required']),
          ],
          span: createSpan(),
        },
      });

      const intent = createIntent(INTENT_ENCRYPTION_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(false);
      expect(result.missingRequirements.length).toBeGreaterThan(0);
    });
  });

  describe('FIXES - when sensitive fields exist', () => {
    it('should pass when field has [sensitive] annotation', () => {
      const behavior = createBehavior({
        input: {
          kind: 'InputBlock',
          fields: [
            createField('email'),
            createField('password', ['sensitive']),
          ],
          span: createSpan(),
        },
      });

      const intent = createIntent(INTENT_ENCRYPTION_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(true);
      expect(result.missingRequirements).toHaveLength(0);
    });

    it('should pass when field has sensitive constraint', () => {
      const behavior = createBehavior({
        input: {
          kind: 'InputBlock',
          fields: [
            createField('api_key', [], ['sensitive']),
          ],
          span: createSpan(),
        },
      });

      const intent = createIntent(INTENT_ENCRYPTION_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(true);
    });

    it('should pass when field type name implies sensitivity', () => {
      const behavior = createBehavior({
        input: {
          kind: 'InputBlock',
          fields: [{
            kind: 'FieldDeclaration',
            name: { kind: 'Identifier', name: 'userPassword', span: createSpan() },
            type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'Password', span: createSpan() }, span: createSpan() },
            optional: false,
            annotations: [],
            constraints: [],
            span: createSpan(),
          }],
          span: createSpan(),
        },
      });

      const intent = createIntent(INTENT_ENCRYPTION_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(true);
    });

    it('should pass when field type is Secret/Token/ApiKey', () => {
      const secretTypes = ['Secret', 'ApiKey', 'Token', 'Credential'];
      
      for (const typeName of secretTypes) {
        const behavior = createBehavior({
          input: {
            kind: 'InputBlock',
            fields: [{
              kind: 'FieldDeclaration',
              name: { kind: 'Identifier', name: 'value', span: createSpan() },
              type: { kind: 'SimpleType', name: { kind: 'Identifier', name: typeName, span: createSpan() }, span: createSpan() },
              optional: false,
              annotations: [],
              constraints: [],
              span: createSpan(),
            }],
            span: createSpan(),
          },
        });

        const intent = createIntent(INTENT_ENCRYPTION_REQUIRED);
        const result = validateSingleIntent(behavior as never, intent);

        expect(result.valid).toBe(true);
      }
    });
  });
});

// ============================================================================
// audit-required Tests
// ============================================================================

describe('audit-required validation', () => {
  describe('FAILURES - when audit configuration is missing', () => {
    it('should fail when behavior has no security block', () => {
      const behavior = createBehavior({
        security: null,
      });

      const intent = createIntent(INTENT_AUDIT_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(false);
      expect(result.missingRequirements).toContain('No audit configuration declared');
      expect(result.suggestions.some(s => s.includes('audit_log required'))).toBe(true);
    });

    it('should fail when security block has only rate_limit', () => {
      const behavior = createBehavior({
        security: {
          kind: 'SecurityBlock',
          requirements: [
            createSecurityRequirement('rate_limit', '10 per hour per email'),
          ],
        },
      });

      const intent = createIntent(INTENT_AUDIT_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(false);
      expect(result.missingRequirements.length).toBeGreaterThan(0);
    });

    it('should fail when security block has only auth requirements', () => {
      const behavior = createBehavior({
        security: {
          kind: 'SecurityBlock',
          requirements: [
            createSecurityRequirement('requires', 'authentication'),
          ],
        },
      });

      const intent = createIntent(INTENT_AUDIT_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(false);
    });
  });

  describe('FIXES - when audit is properly configured', () => {
    it('should pass when security block has audit_log required', () => {
      const behavior = createBehavior({
        security: {
          kind: 'SecurityBlock',
          requirements: [
            {
              kind: 'SecurityRequirement',
              type: 'requires',
              expression: { kind: 'Identifier', name: 'audit_log required', span: createSpan() },
              span: createSpan(),
            },
          ],
        },
      });

      const intent = createIntent(INTENT_AUDIT_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(true);
    });
  });
});

// ============================================================================
// rate-limit-required Tests
// ============================================================================

describe('rate-limit-required validation', () => {
  describe('FAILURES - when rate limit is missing', () => {
    it('should fail when behavior has no security block', () => {
      const behavior = createBehavior({
        security: null,
      });

      const intent = createIntent(INTENT_RATE_LIMIT_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(false);
      expect(result.missingRequirements).toContain('No rate limit configuration declared');
      expect(result.suggestions.some(s => s.includes('rate_limit'))).toBe(true);
    });

    it('should fail when security block has only auth requirements', () => {
      const behavior = createBehavior({
        security: {
          kind: 'SecurityBlock',
          requirements: [
            createSecurityRequirement('requires', 'authentication'),
          ],
        },
      });

      const intent = createIntent(INTENT_RATE_LIMIT_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(false);
    });

    it('should fail when security block has only audit_log', () => {
      const behavior = createBehavior({
        security: {
          kind: 'SecurityBlock',
          requirements: [
            {
              kind: 'SecurityRequirement',
              type: 'requires',
              expression: { kind: 'Identifier', name: 'audit_log required', span: createSpan() },
              span: createSpan(),
            },
          ],
        },
      });

      const intent = createIntent(INTENT_RATE_LIMIT_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(false);
    });
  });

  describe('FIXES - when rate limit is properly configured', () => {
    it('should pass when security block has rate_limit', () => {
      const behavior = createBehavior({
        security: {
          kind: 'SecurityBlock',
          requirements: [
            {
              kind: 'SecurityRequirement',
              type: 'rate_limit',
              expression: { kind: 'Identifier', name: '10 per hour per email', span: createSpan() },
              span: createSpan(),
            },
          ],
        },
      });

      const intent = createIntent(INTENT_RATE_LIMIT_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(true);
      expect(result.missingRequirements).toHaveLength(0);
    });

    it('should pass when security block has multiple rate limits', () => {
      const behavior = createBehavior({
        security: {
          kind: 'SecurityBlock',
          requirements: [
            {
              kind: 'SecurityRequirement',
              type: 'rate_limit',
              expression: { kind: 'Identifier', name: '5 per 15 minutes per email', span: createSpan() },
              span: createSpan(),
            },
            {
              kind: 'SecurityRequirement',
              type: 'rate_limit',
              expression: { kind: 'Identifier', name: '100 per hour per ip_address', span: createSpan() },
              span: createSpan(),
            },
          ],
        },
      });

      const intent = createIntent(INTENT_RATE_LIMIT_REQUIRED);
      const result = validateSingleIntent(behavior as never, intent);

      expect(result.valid).toBe(true);
    });
  });
});

// ============================================================================
// extractSensitiveFields Tests
// ============================================================================

describe('extractSensitiveFields', () => {
  it('should find fields with [sensitive] annotation', () => {
    const behavior = createBehavior({
      input: {
        kind: 'InputBlock',
        fields: [
          createField('password', ['sensitive']),
          createField('username'),
        ],
        span: createSpan(),
      },
    });

    const fields = extractSensitiveFields(behavior as never);

    expect(fields).toHaveLength(1);
    expect(fields[0].fieldName).toBe('password');
    expect(fields[0].sensitivityType).toBe('annotation');
  });

  it('should find fields with sensitive constraint', () => {
    const behavior = createBehavior({
      input: {
        kind: 'InputBlock',
        fields: [
          createField('api_key', [], ['sensitive']),
        ],
        span: createSpan(),
      },
    });

    const fields = extractSensitiveFields(behavior as never);

    expect(fields).toHaveLength(1);
    expect(fields[0].fieldName).toBe('api_key');
    expect(fields[0].sensitivityType).toBe('constraint');
  });

  it('should find fields with sensitive type name', () => {
    const behavior = createBehavior({
      input: {
        kind: 'InputBlock',
        fields: [{
          kind: 'FieldDeclaration',
          name: { kind: 'Identifier', name: 'secret', span: createSpan() },
          type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'Secret', span: createSpan() }, span: createSpan() },
          optional: false,
          annotations: [],
          constraints: [],
          span: createSpan(),
        }],
        span: createSpan(),
      },
    });

    const fields = extractSensitiveFields(behavior as never);

    expect(fields).toHaveLength(1);
    expect(fields[0].fieldName).toBe('secret');
    expect(fields[0].sensitivityType).toBe('type_name');
  });

  it('should return empty array when no sensitive fields', () => {
    const behavior = createBehavior({
      input: {
        kind: 'InputBlock',
        fields: [
          createField('id'),
          createField('name'),
        ],
        span: createSpan(),
      },
    });

    const fields = extractSensitiveFields(behavior as never);

    expect(fields).toHaveLength(0);
  });
});

// ============================================================================
// extractSecurityConfig Tests
// ============================================================================

describe('extractSecurityConfig', () => {
  it('should detect audit_log requirement', () => {
    const behavior = createBehavior({
      security: {
        kind: 'SecurityBlock',
        requirements: [
          {
            kind: 'SecurityRequirement',
            type: 'requires',
            expression: { kind: 'Identifier', name: 'audit_log required', span: createSpan() },
            span: createSpan(),
          },
        ],
      },
    });

    const config = extractSecurityConfig(behavior as never);

    expect(config.hasAuditLog).toBe(true);
  });

  it('should detect rate_limit', () => {
    const behavior = createBehavior({
      security: {
        kind: 'SecurityBlock',
        requirements: [
          {
            kind: 'SecurityRequirement',
            type: 'rate_limit',
            expression: { kind: 'Identifier', name: '10 per hour per email', span: createSpan() },
            span: createSpan(),
          },
        ],
      },
    });

    const config = extractSecurityConfig(behavior as never);

    expect(config.hasRateLimit).toBe(true);
    expect(config.rateLimitSpecs).toHaveLength(1);
  });

  it('should detect auth requirements', () => {
    const behavior = createBehavior({
      security: {
        kind: 'SecurityBlock',
        requirements: [
          createSecurityRequirement('requires', 'authentication'),
        ],
      },
    });

    const config = extractSecurityConfig(behavior as never);

    expect(config.authRequirements).toHaveLength(1);
  });

  it('should return defaults when no security block', () => {
    const behavior = createBehavior({
      security: null,
    });

    const config = extractSecurityConfig(behavior as never);

    expect(config.hasAuditLog).toBe(false);
    expect(config.hasRateLimit).toBe(false);
    expect(config.rateLimitSpecs).toHaveLength(0);
    expect(config.authRequirements).toHaveLength(0);
  });
});

// ============================================================================
// extractIntentDeclarations Tests
// ============================================================================

describe('extractIntentDeclarations', () => {
  it('should extract @intent encryption-required', () => {
    const behavior = createBehavior({
      name: { kind: 'Identifier', name: 'Login', span: { ...createSpan(), start: { line: 5, column: 0, offset: 50 } } },
      span: { ...createSpan(), start: { line: 5, column: 0, offset: 50 } },
    });

    const sourceContent = `
// Authentication behavior
// @intent encryption-required
// @intent audit-required
behavior Login {
  input { ... }
}
`;

    const intents = extractIntentDeclarations(behavior as never, sourceContent);

    expect(intents.length).toBeGreaterThanOrEqual(1);
    expect(intents.some(i => i.name === INTENT_ENCRYPTION_REQUIRED)).toBe(true);
  });

  it('should extract multiple intents', () => {
    const behavior = createBehavior({
      name: { kind: 'Identifier', name: 'ProcessPayment', span: { ...createSpan(), start: { line: 6, column: 0, offset: 100 } } },
      span: { ...createSpan(), start: { line: 6, column: 0, offset: 100 } },
    });

    const sourceContent = `
// Payment processing
// @intent encryption-required
// @intent audit-required
// @intent rate-limit-required
behavior ProcessPayment {
  input { ... }
}
`;

    const intents = extractIntentDeclarations(behavior as never, sourceContent);

    expect(intents).toHaveLength(3);
    expect(intents.map(i => i.name)).toContain(INTENT_ENCRYPTION_REQUIRED);
    expect(intents.map(i => i.name)).toContain(INTENT_AUDIT_REQUIRED);
    expect(intents.map(i => i.name)).toContain(INTENT_RATE_LIMIT_REQUIRED);
  });

  it('should ignore non-coherence intents', () => {
    const behavior = createBehavior({
      name: { kind: 'Identifier', name: 'Test', span: { ...createSpan(), start: { line: 4, column: 0, offset: 50 } } },
      span: { ...createSpan(), start: { line: 4, column: 0, offset: 50 } },
    });

    const sourceContent = `
// @intent unknown-intent
// @intent custom-requirement
behavior Test {
  input { ... }
}
`;

    const intents = extractIntentDeclarations(behavior as never, sourceContent);

    expect(intents).toHaveLength(0);
  });

  it('should return empty array when no intents', () => {
    const behavior = createBehavior({
      name: { kind: 'Identifier', name: 'Simple', span: { ...createSpan(), start: { line: 2, column: 0, offset: 20 } } },
      span: { ...createSpan(), start: { line: 2, column: 0, offset: 20 } },
    });

    const sourceContent = `
behavior Simple {
  input { ... }
}
`;

    const intents = extractIntentDeclarations(behavior as never, sourceContent);

    expect(intents).toHaveLength(0);
  });
});

// ============================================================================
// Integration Tests - Real-world Scenarios
// ============================================================================

describe('Real-world Scenarios', () => {
  it('should validate a proper login behavior with all intents', () => {
    // Login behavior with sensitive fields, audit, and rate limit
    const behavior = createBehavior({
      name: { kind: 'Identifier', name: 'Login', span: createSpan() },
      input: {
        kind: 'InputBlock',
        fields: [
          createField('email'),
          createField('password', ['sensitive']),
        ],
        span: createSpan(),
      },
      security: {
        kind: 'SecurityBlock',
        requirements: [
          {
            kind: 'SecurityRequirement',
            type: 'rate_limit',
            expression: { kind: 'Identifier', name: '5 per 15 minutes per email', span: createSpan() },
            span: createSpan(),
          },
          {
            kind: 'SecurityRequirement',
            type: 'requires',
            expression: { kind: 'Identifier', name: 'audit_log required', span: createSpan() },
            span: createSpan(),
          },
        ],
      },
    });

    // All three intents should pass
    const intents = [
      createIntent(INTENT_ENCRYPTION_REQUIRED, 'Login'),
      createIntent(INTENT_AUDIT_REQUIRED, 'Login'),
      createIntent(INTENT_RATE_LIMIT_REQUIRED, 'Login'),
    ];

    for (const intent of intents) {
      const result = validateSingleIntent(behavior as never, intent);
      expect(result.valid).toBe(true);
    }
  });

  it('should fail incomplete payment behavior', () => {
    // Payment behavior missing encryption-required (no sensitive fields)
    const behavior = createBehavior({
      name: { kind: 'Identifier', name: 'ProcessPayment', span: createSpan() },
      input: {
        kind: 'InputBlock',
        fields: [
          createField('amount'),
          createField('description'),
          // Missing: card_number [sensitive]
        ],
        span: createSpan(),
      },
      security: {
        kind: 'SecurityBlock',
        requirements: [
          // Has rate limit
          {
            kind: 'SecurityRequirement',
            type: 'rate_limit',
            expression: { kind: 'Identifier', name: '100 per hour per api_key', span: createSpan() },
            span: createSpan(),
          },
          // Missing: audit_log required
        ],
      },
    });

    // encryption-required should fail
    const encryptionResult = validateSingleIntent(
      behavior as never,
      createIntent(INTENT_ENCRYPTION_REQUIRED, 'ProcessPayment')
    );
    expect(encryptionResult.valid).toBe(false);
    expect(encryptionResult.suggestions.some(s => s.includes('[sensitive]'))).toBe(true);

    // audit-required should fail
    const auditResult = validateSingleIntent(
      behavior as never,
      createIntent(INTENT_AUDIT_REQUIRED, 'ProcessPayment')
    );
    expect(auditResult.valid).toBe(false);
    expect(auditResult.suggestions.some(s => s.includes('audit_log'))).toBe(true);

    // rate-limit-required should pass
    const rateLimitResult = validateSingleIntent(
      behavior as never,
      createIntent(INTENT_RATE_LIMIT_REQUIRED, 'ProcessPayment')
    );
    expect(rateLimitResult.valid).toBe(true);
  });
});

// ============================================================================
// Diagnostic Output Tests
// ============================================================================

describe('Diagnostic Output', () => {
  it('should provide actionable suggestions for encryption-required failure', () => {
    const behavior = createBehavior({
      input: {
        kind: 'InputBlock',
        fields: [createField('data')],
        span: createSpan(),
      },
    });

    const intent = createIntent(INTENT_ENCRYPTION_REQUIRED);
    const result = validateSingleIntent(behavior as never, intent);

    expect(result.valid).toBe(false);
    expect(result.suggestions).toContain('Add [sensitive] annotation to fields containing PII or secrets');
    expect(result.suggestions.some(s => s.includes('password: String [sensitive]'))).toBe(true);
  });

  it('should provide actionable suggestions for audit-required failure', () => {
    const behavior = createBehavior({
      security: null,
    });

    const intent = createIntent(INTENT_AUDIT_REQUIRED);
    const result = validateSingleIntent(behavior as never, intent);

    expect(result.valid).toBe(false);
    expect(result.suggestions.some(s => s.includes('audit_log required'))).toBe(true);
    expect(result.suggestions.some(s => s.includes('AuditRecord'))).toBe(true);
  });

  it('should provide actionable suggestions for rate-limit-required failure', () => {
    const behavior = createBehavior({
      security: null,
    });

    const intent = createIntent(INTENT_RATE_LIMIT_REQUIRED);
    const result = validateSingleIntent(behavior as never, intent);

    expect(result.valid).toBe(false);
    expect(result.suggestions.some(s => s.includes('rate_limit'))).toBe(true);
    expect(result.suggestions.some(s => s.includes('per'))).toBe(true);
  });
});
