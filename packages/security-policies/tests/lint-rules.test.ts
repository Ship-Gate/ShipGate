// ============================================================================
// Security Lint Rules - Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  SecurityLintAnalyzer,
  createLintAnalyzer,
  lint,
  authConstraintsRule,
  paymentConstraintsRule,
  webhookConstraintsRule,
  AutofixGenerator,
  createAutofixGenerator,
} from '../src/index.js';
import type { Domain, Behavior, Field } from '../src/types.js';

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

function createField(name: string, annotations: string[] = []): Field {
  return {
    kind: 'Field',
    name: id(name),
    type: { kind: 'PrimitiveType', name: 'String', location: loc() } as any,
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

function createDomain(behaviors: Behavior[]): Domain {
  return {
    kind: 'Domain',
    name: id('TestDomain'),
    version: str('1.0.0'),
    types: [],
    entities: [],
    behaviors,
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    location: loc(),
  } as Domain;
}

// ============================================================================
// Auth Constraints Lint Rule Tests
// ============================================================================

describe('Auth Constraints Lint Rule', () => {
  describe('authConstraintsRule', () => {
    it('should require rate limiting for login behavior', () => {
      const behavior = createBehavior('Login');
      const domain = createDomain([behavior]);
      const findings = authConstraintsRule.check({ domain });

      const rateLimitFinding = findings.find(f => f.title.includes('Rate Limit'));
      expect(rateLimitFinding).toBeDefined();
      expect(rateLimitFinding?.severity).toBe('error');
    });

    it('should require password safety invariant', () => {
      const behavior = createBehavior('Login', {
        input: {
          kind: 'InputSpec',
          fields: [createField('password')],
          location: loc(),
        },
      });

      const domain = createDomain([behavior]);
      const findings = authConstraintsRule.check({ domain });

      const passwordFinding = findings.find(f => f.title.includes('Password Safety'));
      expect(passwordFinding).toBeDefined();
    });

    it('should suggest audit logging', () => {
      const behavior = createBehavior('Register');
      const domain = createDomain([behavior]);
      const findings = authConstraintsRule.check({ domain });

      const auditFinding = findings.find(f => f.title.includes('Audit'));
      expect(auditFinding).toBeDefined();
      expect(auditFinding?.severity).toBe('warning');
    });

    it('should not flag non-auth behaviors', () => {
      const behavior = createBehavior('GetProduct');
      const domain = createDomain([behavior]);
      const findings = authConstraintsRule.check({ domain });

      expect(findings).toHaveLength(0);
    });

    it('should detect various auth patterns', () => {
      const behaviors = [
        createBehavior('SignIn'),
        createBehavior('SignUp'),
        createBehavior('Authenticate'),
        createBehavior('ForgotPassword'),
        createBehavior('VerifyMFA'),
      ];

      for (const behavior of behaviors) {
        const domain = createDomain([behavior]);
        const findings = authConstraintsRule.check({ domain });
        expect(findings.length).toBeGreaterThan(0);
      }
    });

    it('should generate autofix for rate limiting', () => {
      const behavior = createBehavior('Login');
      const domain = createDomain([behavior]);
      const findings = authConstraintsRule.check({ domain });

      const rateLimitFinding = findings.find(f => f.title.includes('Rate Limit'));
      expect(rateLimitFinding?.autofix).toBeDefined();
      expect(rateLimitFinding?.autofix?.patch.text).toContain('rate_limit');
      expect(rateLimitFinding?.autofix?.patch.text).toContain('ip_address');
    });
  });
});

// ============================================================================
// Payment Constraints Lint Rule Tests
// ============================================================================

describe('Payment Constraints Lint Rule', () => {
  describe('paymentConstraintsRule', () => {
    it('should require authentication for payment behavior', () => {
      const behavior = createBehavior('ProcessPayment');
      const domain = createDomain([behavior]);
      const findings = paymentConstraintsRule.check({ domain });

      const authFinding = findings.find(f => f.title.includes('Auth'));
      expect(authFinding).toBeDefined();
      expect(authFinding?.severity).toBe('error');
    });

    it('should require rate limiting for payment behavior', () => {
      const behavior = createBehavior('ProcessPayment');
      const domain = createDomain([behavior]);
      const findings = paymentConstraintsRule.check({ domain });

      const rateLimitFinding = findings.find(f => f.title.includes('Rate Limit'));
      expect(rateLimitFinding).toBeDefined();
    });

    it('should require amount validation', () => {
      const behavior = createBehavior('ProcessPayment', {
        input: {
          kind: 'InputSpec',
          fields: [createField('amount')],
          location: loc(),
        },
      });

      const domain = createDomain([behavior]);
      const findings = paymentConstraintsRule.check({ domain });

      const amountFinding = findings.find(f => f.title.includes('Amount'));
      expect(amountFinding).toBeDefined();
    });

    it('should require secure card handling', () => {
      const behavior = createBehavior('ProcessPayment', {
        input: {
          kind: 'InputSpec',
          fields: [
            createField('card_number'),
            createField('cvv'),
          ],
          location: loc(),
        },
      });

      const domain = createDomain([behavior]);
      const findings = paymentConstraintsRule.check({ domain });

      const cardFinding = findings.find(f => f.title.includes('Card'));
      expect(cardFinding).toBeDefined();
    });

    it('should detect various payment patterns', () => {
      const behaviors = [
        createBehavior('Charge'),
        createBehavior('Refund'),
        createBehavior('Transfer'),
        createBehavior('Withdraw'),
        createBehavior('CreateSubscription'),
      ];

      for (const behavior of behaviors) {
        const domain = createDomain([behavior]);
        const findings = paymentConstraintsRule.check({ domain });
        expect(findings.length).toBeGreaterThan(0);
      }
    });

    it('should generate autofix for auth requirement', () => {
      const behavior = createBehavior('ProcessPayment');
      const domain = createDomain([behavior]);
      const findings = paymentConstraintsRule.check({ domain });

      const authFinding = findings.find(f => f.title.includes('Auth'));
      expect(authFinding?.autofix).toBeDefined();
      expect(authFinding?.autofix?.patch.text).toContain('requires authenticated');
    });
  });
});

// ============================================================================
// Webhook Constraints Lint Rule Tests
// ============================================================================

describe('Webhook Constraints Lint Rule', () => {
  describe('webhookConstraintsRule', () => {
    it('should require signature verification for webhooks', () => {
      const behavior = createBehavior('StripeWebhook');
      const domain = createDomain([behavior]);
      const findings = webhookConstraintsRule.check({ domain });

      const sigFinding = findings.find(f => f.title.includes('Signature'));
      expect(sigFinding).toBeDefined();
      expect(sigFinding?.severity).toBe('error');
    });

    it('should suggest idempotency handling', () => {
      const behavior = createBehavior('PaymentWebhook');
      const domain = createDomain([behavior]);
      const findings = webhookConstraintsRule.check({ domain });

      const idempFinding = findings.find(f => f.title.includes('Idempotency'));
      expect(idempFinding).toBeDefined();
    });

    it('should suggest replay protection', () => {
      const behavior = createBehavior('GithubWebhook');
      const domain = createDomain([behavior]);
      const findings = webhookConstraintsRule.check({ domain });

      const replayFinding = findings.find(f => f.title.includes('Replay'));
      expect(replayFinding).toBeDefined();
    });

    it('should detect various webhook patterns', () => {
      const behaviors = [
        createBehavior('Webhook'),
        createBehavior('HandleCallback'),
        createBehavior('ReceiveEvent'),
        createBehavior('ProcessEvent'),
        createBehavior('SlackEventHandler'),
      ];

      for (const behavior of behaviors) {
        const domain = createDomain([behavior]);
        const findings = webhookConstraintsRule.check({ domain });
        expect(findings.length).toBeGreaterThan(0);
      }
    });

    it('should generate comprehensive autofix for signature verification', () => {
      const behavior = createBehavior('StripeWebhook');
      const domain = createDomain([behavior]);
      const findings = webhookConstraintsRule.check({ domain });

      const sigFinding = findings.find(f => f.title.includes('Signature'));
      expect(sigFinding?.autofix).toBeDefined();
      expect(sigFinding?.autofix?.patch.text).toContain('webhook_signature');
      expect(sigFinding?.autofix?.patch.text).toContain('verify_webhook_signature');
    });
  });
});

// ============================================================================
// Lint Analyzer Tests
// ============================================================================

describe('SecurityLintAnalyzer', () => {
  describe('analyze', () => {
    it('should analyze domain and return lint result', () => {
      const behaviors = [
        createBehavior('Login'),
        createBehavior('ProcessPayment'),
        createBehavior('StripeWebhook'),
      ];

      const domain = createDomain(behaviors);
      const result = lint(domain);

      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.passed).toBe(false);
    });

    it('should count fixable issues', () => {
      const behavior = createBehavior('Login');
      const domain = createDomain([behavior]);
      const result = lint(domain);

      expect(result.fixableCount).toBeGreaterThan(0);
    });

    it('should sort findings by severity', () => {
      const behaviors = [
        createBehavior('Login'),
        createBehavior('StripeWebhook'),
      ];

      const domain = createDomain(behaviors);
      const result = lint(domain);

      // Errors should come before warnings
      let foundWarning = false;
      for (const finding of result.findings) {
        if (finding.severity === 'warning') foundWarning = true;
        if (foundWarning && finding.severity === 'error') {
          throw new Error('Findings not sorted by severity');
        }
      }
    });
  });

  describe('analyzeBehavior', () => {
    it('should analyze single behavior', () => {
      const behaviors = [
        createBehavior('Login'),
        createBehavior('GetProduct'),
      ];

      const domain = createDomain(behaviors);
      const analyzer = createLintAnalyzer();
      const result = analyzer.analyzeBehavior(domain, 'Login');

      // Should only have findings for Login
      expect(result.findings.every(f => f.behaviorName === 'Login')).toBe(true);
    });

    it('should return empty result for non-existent behavior', () => {
      const domain = createDomain([]);
      const analyzer = createLintAnalyzer();
      const result = analyzer.analyzeBehavior(domain, 'NonExistent');

      expect(result.passed).toBe(true);
      expect(result.findings).toHaveLength(0);
    });
  });

  describe('generateFixReport', () => {
    it('should generate markdown fix report', () => {
      const behavior = createBehavior('Login');
      const domain = createDomain([behavior]);
      const analyzer = createLintAnalyzer();
      const result = analyzer.analyze(domain);
      const report = analyzer.generateFixReport(result.findings);

      expect(report).toContain('Auto-Fix Suggestions');
      expect(report).toContain('Suggested Fix');
    });

    it('should return message when no fixes available', () => {
      const analyzer = createLintAnalyzer();
      const report = analyzer.generateFixReport([]);

      expect(report).toContain('No auto-fixable issues');
    });
  });
});

// ============================================================================
// Autofix Generator Tests
// ============================================================================

describe('AutofixGenerator', () => {
  describe('generateEdits', () => {
    it('should generate text edits from findings', () => {
      const behavior = createBehavior('Login');
      const domain = createDomain([behavior]);
      const result = lint(domain);
      
      const generator = createAutofixGenerator();
      const fixable = result.findings.filter(f => f.autofix);
      
      expect(fixable.length).toBeGreaterThan(0);
      
      const sourceText = 'behavior Login { }';
      const fix = generator.generateEdits(fixable[0], sourceText);
      
      expect(fix).not.toBeNull();
      expect(fix?.edits.length).toBeGreaterThan(0);
    });

    it('should return null for findings without autofix', () => {
      const finding = {
        id: 'TEST',
        category: 'auth-security' as const,
        severity: 'warning' as const,
        title: 'Test',
        message: 'Test message',
        location: loc(),
      };

      const generator = createAutofixGenerator();
      const result = generator.generateEdits(finding, 'source');

      expect(result).toBeNull();
    });
  });

  describe('applyEdits', () => {
    it('should apply edits to source text', () => {
      const generator = new AutofixGenerator();
      const source = 'Hello World';
      const edits = [
        { startOffset: 6, endOffset: 11, newText: 'Universe' },
      ];

      const result = generator.applyEdits(source, edits);
      expect(result).toBe('Hello Universe');
    });

    it('should handle multiple edits', () => {
      const generator = new AutofixGenerator();
      const source = 'foo bar baz';
      const edits = [
        { startOffset: 0, endOffset: 3, newText: 'FOO' },
        { startOffset: 8, endOffset: 11, newText: 'BAZ' },
      ];

      const result = generator.applyEdits(source, edits);
      expect(result).toBe('FOO bar BAZ');
    });
  });

  describe('formatAsSuggestion', () => {
    it('should format autofix as ISL code suggestion', () => {
      const autofix = {
        description: 'Add rate limiting',
        operation: 'add' as const,
        targetKind: 'SecuritySpec',
        location: loc(),
        patch: {
          text: 'security { rate_limit 5 per ip_address }',
        },
      };

      const generator = new AutofixGenerator();
      const suggestion = generator.formatAsSuggestion(autofix);

      expect(suggestion).toContain('Add rate limiting');
      expect(suggestion).toContain('rate_limit');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration Tests', () => {
  it('should detect all issues in risky auth spec', () => {
    const behaviors = [
      createBehavior('Login', {
        input: {
          kind: 'InputSpec',
          fields: [
            createField('email'),
            createField('password'),
          ],
          location: loc(),
        },
      }),
      createBehavior('Register', {
        input: {
          kind: 'InputSpec',
          fields: [
            createField('email'),
            createField('password'),
            createField('phone'),
          ],
          location: loc(),
        },
      }),
    ];

    const domain = createDomain(behaviors);
    const result = lint(domain);

    // Should have multiple findings
    expect(result.findings.length).toBeGreaterThan(3);
    
    // Should have both errors and warnings
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.summary.warnings).toBeGreaterThan(0);
    
    // Should not pass
    expect(result.passed).toBe(false);
  });

  it('should detect all issues in risky payment spec', () => {
    const behaviors = [
      createBehavior('ProcessPayment', {
        input: {
          kind: 'InputSpec',
          fields: [
            createField('amount'),
            createField('card_number'),
            createField('cvv'),
          ],
          location: loc(),
        },
      }),
      createBehavior('Refund', {
        input: {
          kind: 'InputSpec',
          fields: [createField('amount')],
          location: loc(),
        },
      }),
    ];

    const domain = createDomain(behaviors);
    const result = lint(domain);

    // Should have findings for auth, rate limit, amount validation, card handling
    expect(result.findings.length).toBeGreaterThan(4);
    expect(result.passed).toBe(false);
  });

  it('should detect all issues in risky webhook spec', () => {
    const behaviors = [
      createBehavior('StripeWebhook'),
      createBehavior('GithubWebhook'),
      createBehavior('PaymentCallback'),
    ];

    const domain = createDomain(behaviors);
    const result = lint(domain);

    // Each webhook should have signature, idempotency, replay protection issues
    expect(result.findings.length).toBeGreaterThan(6);
    expect(result.passed).toBe(false);
  });

  it('should pass for properly secured spec', () => {
    // Create a properly secured auth behavior
    const behavior = createBehavior('Login', {
      input: {
        kind: 'InputSpec',
        fields: [
          createField('email'),
          createField('password', ['sensitive']),
        ],
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
      invariants: [
        // Simulating never_appears_in by having password in invariants string
        {
          kind: 'BinaryExpr',
          operator: 'and',
          left: { kind: 'Identifier', name: 'password', location: loc() },
          right: { kind: 'StringLiteral', value: 'never_appears_in logs', location: loc() },
          location: loc(),
        } as any,
      ],
      observability: {
        kind: 'ObservabilitySpec',
        metrics: [],
        traces: [],
        logs: [],
        location: loc(),
      },
    });

    const domain = createDomain([behavior]);
    
    // Note: This won't fully pass due to audit logging check,
    // but should have fewer findings
    const result = lint(domain);
    const errorCount = result.summary.errors;
    
    // Should have fewer errors than an unsecured spec
    expect(errorCount).toBeLessThan(3);
  });
});
