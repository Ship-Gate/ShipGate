// ============================================================================
// Security Policies - Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  SecurityPolicyChecker,
  createSecurityChecker,
  checkPolicies,
  noPIILogsRule,
  secretsAnnotationRule,
  secretsRedactionRule,
  webhookSignatureRequiredRule,
  authRateLimitRule,
} from '../src/index.js';
import type { Domain, Behavior, Field, Finding } from '../src/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

const loc = (line = 1, col = 1) => ({
  file: 'test.isl',
  line,
  column: col,
  endLine: line,
  endColumn: col + 10,
});

const id = (name: string) => ({
  kind: 'Identifier' as const,
  name,
  location: loc(),
});

const str = (value: string) => ({
  kind: 'StringLiteral' as const,
  value,
  location: loc(),
});

function createField(name: string, type: string, annotations: string[] = []): Field {
  return {
    kind: 'Field',
    name: id(name),
    type: { kind: 'PrimitiveType', name: type, location: loc() } as any,
    optional: false,
    annotations: annotations.map(a => ({
      kind: 'Annotation' as const,
      name: id(a),
      location: loc(),
    })),
    location: loc(),
  };
}

function createBehavior(name: string, overrides: Partial<Behavior> = {}): Behavior {
  return {
    kind: 'Behavior',
    name: id(name),
    description: str(`Test behavior ${name}`),
    input: {
      kind: 'InputSpec',
      fields: [],
      location: loc(),
    },
    output: {
      kind: 'OutputSpec',
      success: { kind: 'PrimitiveType', name: 'Boolean', location: loc() } as any,
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
    ...overrides,
  } as Behavior;
}

function createDomain(overrides: Partial<Domain> = {}): Domain {
  return {
    kind: 'Domain',
    name: id('TestDomain'),
    version: str('1.0.0'),
    types: [],
    entities: [],
    behaviors: [],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    location: loc(),
    ...overrides,
  } as Domain;
}

// ============================================================================
// Policy Tests
// ============================================================================

describe('SecurityPolicyChecker', () => {
  describe('initialization', () => {
    it('should create a checker with default options', () => {
      const checker = createSecurityChecker();
      expect(checker).toBeDefined();
      expect(checker.getEnabledPolicies()).toContain('pii-protection');
      expect(checker.getEnabledPolicies()).toContain('secrets-management');
    });

    it('should allow custom options', () => {
      const checker = createSecurityChecker({
        enabledPolicies: ['pii-protection'],
        minSeverity: 'warning',
      });
      expect(checker.getEnabledPolicies()).toEqual(['pii-protection']);
    });
  });

  describe('empty domain', () => {
    it('should pass for domain with no behaviors', () => {
      const domain = createDomain();
      const result = checkPolicies(domain);
      
      expect(result.passed).toBe(true);
      expect(result.findings).toHaveLength(0);
      expect(result.score).toBe(100);
    });
  });
});

// ============================================================================
// PII Protection Policy Tests
// ============================================================================

describe('PII Protection Policy', () => {
  describe('noPIILogsRule', () => {
    it('should detect PII fields without log exclusion', () => {
      const behavior = createBehavior('GetUser', {
        input: {
          kind: 'InputSpec',
          fields: [
            createField('email', 'String'),
            createField('phone', 'String'),
          ],
          location: loc(),
        },
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = noPIILogsRule.check({ domain });

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.fieldName === 'email')).toBe(true);
      expect(findings.some(f => f.fieldName === 'phone')).toBe(true);
    });

    it('should not flag non-PII fields', () => {
      const behavior = createBehavior('GetProduct', {
        input: {
          kind: 'InputSpec',
          fields: [
            createField('product_id', 'UUID'),
            createField('name', 'String'),
          ],
          location: loc(),
        },
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = noPIILogsRule.check({ domain });

      expect(findings).toHaveLength(0);
    });

    it('should detect SSN, passport, and other PII patterns', () => {
      const behavior = createBehavior('UpdateProfile', {
        input: {
          kind: 'InputSpec',
          fields: [
            createField('ssn', 'String'),
            createField('passport_number', 'String'),
            createField('date_of_birth', 'String'),
          ],
          location: loc(),
        },
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = noPIILogsRule.check({ domain });

      expect(findings.length).toBe(3);
    });

    it('should generate autofix suggestions', () => {
      const behavior = createBehavior('GetUser', {
        input: {
          kind: 'InputSpec',
          fields: [createField('email', 'String')],
          location: loc(),
        },
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = noPIILogsRule.check({ domain });

      expect(findings[0].autofix).toBeDefined();
      expect(findings[0].autofix?.operation).toBe('add');
      expect(findings[0].autofix?.patch.text).toContain('exclude');
    });
  });
});

// ============================================================================
// Secrets Management Policy Tests
// ============================================================================

describe('Secrets Management Policy', () => {
  describe('secretsAnnotationRule', () => {
    it('should detect password fields without secret annotation', () => {
      const behavior = createBehavior('Login', {
        input: {
          kind: 'InputSpec',
          fields: [
            createField('email', 'String'),
            createField('password', 'String'), // Missing [secret]
          ],
          location: loc(),
        },
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = secretsAnnotationRule.check({ domain });

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.fieldName === 'password')).toBe(true);
      expect(findings[0].severity).toBe('error');
    });

    it('should not flag fields with secret annotation', () => {
      const behavior = createBehavior('Login', {
        input: {
          kind: 'InputSpec',
          fields: [
            createField('email', 'String'),
            createField('password', 'String', ['secret']),
          ],
          location: loc(),
        },
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = secretsAnnotationRule.check({ domain });

      const passwordFindings = findings.filter(f => f.fieldName === 'password');
      expect(passwordFindings).toHaveLength(0);
    });

    it('should detect API key fields', () => {
      const behavior = createBehavior('SetApiKey', {
        input: {
          kind: 'InputSpec',
          fields: [
            createField('api_key', 'String'),
            createField('client_secret', 'String'),
          ],
          location: loc(),
        },
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = secretsAnnotationRule.check({ domain });

      expect(findings.length).toBe(2);
    });

    it('should generate autofix to add [secret] annotation', () => {
      const behavior = createBehavior('Login', {
        input: {
          kind: 'InputSpec',
          fields: [createField('password', 'String')],
          location: loc(),
        },
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = secretsAnnotationRule.check({ domain });

      expect(findings[0].autofix).toBeDefined();
      expect(findings[0].autofix?.patch.text).toContain('secret');
    });
  });

  describe('secretsRedactionRule', () => {
    it('should detect secrets without redaction invariant', () => {
      const behavior = createBehavior('Login', {
        input: {
          kind: 'InputSpec',
          fields: [createField('password', 'String', ['secret'])],
          location: loc(),
        },
        invariants: [], // Missing never_appears_in
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = secretsRedactionRule.check({ domain });

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].id).toBe('SEC-SECRET-002');
    });
  });
});

// ============================================================================
// Webhook Security Policy Tests
// ============================================================================

describe('Webhook Security Policy', () => {
  describe('webhookSignatureRequiredRule', () => {
    it('should detect webhooks without signature verification', () => {
      const behavior = createBehavior('StripeWebhook', {
        input: {
          kind: 'InputSpec',
          fields: [
            createField('event_type', 'String'),
            createField('payload', 'String'),
          ],
          location: loc(),
        },
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = webhookSignatureRequiredRule.check({ domain });

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].title).toContain('Signature');
    });

    it('should not flag non-webhook behaviors', () => {
      const behavior = createBehavior('GetProduct', {
        input: {
          kind: 'InputSpec',
          fields: [createField('id', 'UUID')],
          location: loc(),
        },
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = webhookSignatureRequiredRule.check({ domain });

      expect(findings).toHaveLength(0);
    });

    it('should detect callback endpoints', () => {
      const behavior = createBehavior('PaymentCallback', {
        input: {
          kind: 'InputSpec',
          fields: [createField('status', 'String')],
          location: loc(),
        },
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = webhookSignatureRequiredRule.check({ domain });

      expect(findings.length).toBeGreaterThan(0);
    });

    it('should generate autofix for signature verification', () => {
      const behavior = createBehavior('GithubWebhook', {
        input: {
          kind: 'InputSpec',
          fields: [createField('action', 'String')],
          location: loc(),
        },
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = webhookSignatureRequiredRule.check({ domain });

      const sigFinding = findings.find(f => f.title.includes('Signature'));
      expect(sigFinding?.autofix).toBeDefined();
      expect(sigFinding?.autofix?.patch.text).toContain('webhook_signature');
    });
  });
});

// ============================================================================
// Rate Limiting Policy Tests
// ============================================================================

describe('Rate Limiting Policy', () => {
  describe('authRateLimitRule', () => {
    it('should detect auth endpoints without rate limiting', () => {
      const behavior = createBehavior('Login', {
        input: {
          kind: 'InputSpec',
          fields: [
            createField('email', 'String'),
            createField('password', 'String'),
          ],
          location: loc(),
        },
        security: [], // No rate_limit
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = authRateLimitRule.check({ domain });

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].title).toContain('Rate Limit');
    });

    it('should not flag auth endpoints with rate limiting', () => {
      const behavior = createBehavior('Login', {
        input: {
          kind: 'InputSpec',
          fields: [createField('email', 'String')],
          location: loc(),
        },
        security: [
          {
            kind: 'SecuritySpec',
            type: 'rate_limit',
            details: { kind: 'NumberLiteral', value: 5, isFloat: false, location: loc() } as any,
            location: loc(),
          },
        ],
      });

      const domain = createDomain({ behaviors: [behavior] });
      const findings = authRateLimitRule.check({ domain });

      expect(findings).toHaveLength(0);
    });

    it('should detect registration endpoints', () => {
      const behavior = createBehavior('Register');
      const domain = createDomain({ behaviors: [behavior] });
      const findings = authRateLimitRule.check({ domain });

      expect(findings.length).toBeGreaterThan(0);
    });

    it('should detect password reset endpoints', () => {
      const behavior = createBehavior('ResetPassword');
      const domain = createDomain({ behaviors: [behavior] });
      const findings = authRateLimitRule.check({ domain });

      expect(findings.length).toBeGreaterThan(0);
    });

    it('should generate autofix for rate limiting', () => {
      const behavior = createBehavior('SignIn');
      const domain = createDomain({ behaviors: [behavior] });
      const findings = authRateLimitRule.check({ domain });

      expect(findings[0].autofix).toBeDefined();
      expect(findings[0].autofix?.patch.text).toContain('rate_limit');
    });
  });
});

// ============================================================================
// Full Security Check Tests
// ============================================================================

describe('Full Security Check', () => {
  it('should run all policy and lint checks', () => {
    const behavior = createBehavior('Login', {
      input: {
        kind: 'InputSpec',
        fields: [
          createField('email', 'String'),
          createField('password', 'String'),
        ],
        location: loc(),
      },
    });

    const domain = createDomain({ behaviors: [behavior] });
    const checker = createSecurityChecker();
    const result = checker.check(domain);

    expect(result.policyResult).toBeDefined();
    expect(result.lintResult).toBeDefined();
    expect(result.allFindings.length).toBeGreaterThan(0);
    expect(result.passed).toBe(false);
  });

  it('should generate comprehensive report', () => {
    const behavior = createBehavior('StripeWebhook');
    const domain = createDomain({ behaviors: [behavior] });
    const checker = createSecurityChecker();
    const result = checker.check(domain);
    const report = checker.generateReport(result);

    expect(report).toContain('Security Analysis Report');
    expect(report).toContain('Policy Checks');
    expect(report).toContain('Lint Checks');
  });

  it('should count fixable issues', () => {
    const behaviors = [
      createBehavior('Login'),
      createBehavior('StripeWebhook'),
      createBehavior('ProcessPayment'),
    ];

    const domain = createDomain({ behaviors });
    const checker = createSecurityChecker();
    const result = checker.check(domain);

    expect(result.totalFixable).toBeGreaterThan(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle behaviors with empty input', () => {
    const behavior = createBehavior('HealthCheck', {
      input: { kind: 'InputSpec', fields: [], location: loc() },
    });

    const domain = createDomain({ behaviors: [behavior] });
    const result = checkPolicies(domain);

    expect(result.findings).toHaveLength(0);
  });

  it('should handle multiple behaviors', () => {
    const behaviors = [
      createBehavior('Login'),
      createBehavior('Register'),
      createBehavior('Logout'),
    ];

    const domain = createDomain({ behaviors });
    const result = checkPolicies(domain);

    // Should have findings for Login and Register (auth without rate limit)
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('should respect severity filtering', () => {
    const behavior = createBehavior('Login');
    const domain = createDomain({ behaviors: [behavior] });
    
    const result = checkPolicies(domain, { minSeverity: 'error' });
    const errorFindings = result.findings.filter(f => f.severity === 'error');
    
    expect(result.findings).toEqual(errorFindings);
  });
});
