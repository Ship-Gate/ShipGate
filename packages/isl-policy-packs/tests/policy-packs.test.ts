/**
 * ISL Policy Packs - Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRegistry,
  loadBuiltinPacks,
  authPolicyPack,
  paymentsPolicyPack,
  piiPolicyPack,
  rateLimitPolicyPack,
  explainRule,
  getAllExplanations,
  formatExplanationMarkdown,
  formatExplanationTerminal,
  type RuleContext,
  type PolicyPackRegistry,
} from '../src/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    claims: [],
    evidence: [],
    filePath: 'test.ts',
    content: '',
    truthpack: {},
    ...overrides,
  };
}

// ============================================================================
// Registry Tests
// ============================================================================

describe('ISL Policy Packs - Registry', () => {
  let registry: PolicyPackRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('should create an empty registry', () => {
    expect(registry.getAllPacks()).toHaveLength(0);
  });

  it('should register a policy pack', () => {
    registry.registerPack(authPolicyPack);
    expect(registry.getAllPacks()).toHaveLength(1);
    expect(registry.getPack('auth')).toBe(authPolicyPack);
  });

  it('should load all builtin packs', async () => {
    await loadBuiltinPacks(registry);
    
    expect(registry.getAllPacks()).toHaveLength(4);
    expect(registry.getPack('auth')).toBeDefined();
    expect(registry.getPack('payments')).toBeDefined();
    expect(registry.getPack('pii')).toBeDefined();
    expect(registry.getPack('rate-limit')).toBeDefined();
  });

  it('should get enabled rules', async () => {
    await loadBuiltinPacks(registry);
    
    const rules = registry.getEnabledRules();
    expect(rules.length).toBeGreaterThan(0);
  });

  it('should respect pack disable config', async () => {
    await loadBuiltinPacks(registry);
    
    const allRules = registry.getEnabledRules();
    const filteredRules = registry.getEnabledRules({
      auth: { enabled: false },
    });

    expect(filteredRules.length).toBeLessThan(allRules.length);
  });

  it('should respect rule disable config', async () => {
    await loadBuiltinPacks(registry);
    
    const allRules = registry.getEnabledRules();
    const filteredRules = registry.getEnabledRules({
      auth: {
        enabled: true,
        ruleOverrides: {
          'auth/bypass-detected': { enabled: false },
        },
      },
    });

    expect(filteredRules.find(r => r.id === 'auth/bypass-detected')).toBeUndefined();
  });

  it('should prevent duplicate pack registration', () => {
    registry.registerPack(authPolicyPack);
    expect(() => registry.registerPack(authPolicyPack)).toThrow();
  });
});

// ============================================================================
// Auth Policy Pack Tests
// ============================================================================

describe('ISL Policy Packs - Auth', () => {
  it('should have correct pack metadata', () => {
    expect(authPolicyPack.id).toBe('auth');
    expect(authPolicyPack.name).toBe('Authentication & Authorization');
    expect(authPolicyPack.rules.length).toBeGreaterThan(0);
  });

  it('should detect auth bypass patterns', () => {
    const rule = authPolicyPack.rules.find(r => r.id === 'auth/bypass-detected');
    expect(rule).toBeDefined();

    const ctx = createTestContext({
      content: 'const config = { auth: false, route: "/api/users" }',
    });

    const violation = rule!.evaluate(ctx);
    expect(violation).not.toBeNull();
    expect(violation?.tier).toBe('hard_block');
  });

  it('should not flag normal auth code', () => {
    const rule = authPolicyPack.rules.find(r => r.id === 'auth/bypass-detected');

    const ctx = createTestContext({
      content: 'const isAuthenticated = checkAuth(user);',
    });

    const violation = rule!.evaluate(ctx);
    expect(violation).toBeNull();
  });

  it('should detect hardcoded credentials', () => {
    const rule = authPolicyPack.rules.find(r => r.id === 'auth/hardcoded-credentials');
    expect(rule).toBeDefined();

    const ctx = createTestContext({
      content: 'const api_key = "sk_live_abc123def456ghi789";',
    });

    const violation = rule!.evaluate(ctx);
    expect(violation).not.toBeNull();
    expect(violation?.tier).toBe('hard_block');
  });
});

// ============================================================================
// Payments Policy Pack Tests
// ============================================================================

describe('ISL Policy Packs - Payments', () => {
  it('should have correct pack metadata', () => {
    expect(paymentsPolicyPack.id).toBe('payments');
    expect(paymentsPolicyPack.rules.length).toBeGreaterThan(0);
  });

  it('should detect payment bypass patterns', () => {
    const rule = paymentsPolicyPack.rules.find(r => r.id === 'payments/bypass-detected');
    expect(rule).toBeDefined();

    const ctx = createTestContext({
      content: 'const payment = { amount: 0, skipPayment: true };',
    });

    const violation = rule!.evaluate(ctx);
    expect(violation).not.toBeNull();
    expect(violation?.tier).toBe('hard_block');
  });

  it('should detect missing webhook signature verification', () => {
    const rule = paymentsPolicyPack.rules.find(r => r.id === 'payments/webhook-signature');
    expect(rule).toBeDefined();

    const ctx = createTestContext({
      filePath: 'webhook-handler.ts',
      content: `
        app.post('/webhook', (req, res) => {
          const event = req.body;
          handleStripeEvent(event);
        });
      `,
    });

    const violation = rule!.evaluate(ctx);
    expect(violation).not.toBeNull();
  });

  it('should pass when webhook has signature verification', () => {
    const rule = paymentsPolicyPack.rules.find(r => r.id === 'payments/webhook-signature');

    const ctx = createTestContext({
      filePath: 'webhook-handler.ts',
      content: `
        app.post('/webhook', (req, res) => {
          const event = stripe.webhooks.constructEvent(req.body, sig, secret);
          handleStripeEvent(event);
        });
      `,
    });

    const violation = rule!.evaluate(ctx);
    expect(violation).toBeNull();
  });
});

// ============================================================================
// PII Policy Pack Tests
// ============================================================================

describe('ISL Policy Packs - PII', () => {
  it('should have correct pack metadata', () => {
    expect(piiPolicyPack.id).toBe('pii');
    expect(piiPolicyPack.rules.length).toBeGreaterThan(0);
  });

  it('should detect PII in logs', () => {
    const rule = piiPolicyPack.rules.find(r => r.id === 'pii/logged-sensitive-data');
    expect(rule).toBeDefined();

    const ctx = createTestContext({
      content: 'console.log("User email:", user.email);',
    });

    const violation = rule!.evaluate(ctx);
    expect(violation).not.toBeNull();
    expect(violation?.tier).toBe('hard_block');
  });

  it('should detect console.log in production code', () => {
    const rule = piiPolicyPack.rules.find(r => r.id === 'pii/console-in-production');
    expect(rule).toBeDefined();

    const ctx = createTestContext({
      filePath: 'src/api/users.ts',
      content: 'console.log("Processing request");',
    });

    const violation = rule!.evaluate(ctx);
    expect(violation).not.toBeNull();
  });

  it('should skip console.log check in test files', () => {
    const rule = piiPolicyPack.rules.find(r => r.id === 'pii/console-in-production');

    const ctx = createTestContext({
      filePath: 'src/api/users.test.ts',
      content: 'console.log("Test output");',
    });

    const violation = rule!.evaluate(ctx);
    expect(violation).toBeNull();
  });
});

// ============================================================================
// Rate Limit Policy Pack Tests
// ============================================================================

describe('ISL Policy Packs - Rate Limit', () => {
  it('should have correct pack metadata', () => {
    expect(rateLimitPolicyPack.id).toBe('rate-limit');
    expect(rateLimitPolicyPack.rules.length).toBeGreaterThan(0);
  });

  it('should detect auth endpoint without rate limit', () => {
    const rule = rateLimitPolicyPack.rules.find(r => r.id === 'rate-limit/auth-endpoint');
    expect(rule).toBeDefined();

    const ctx = createTestContext({
      filePath: 'src/auth/login.ts',
      content: `
        app.post('/login', async (req, res) => {
          const user = await authenticate(req.body);
          res.json(user);
        });
      `,
    });

    const violation = rule!.evaluate(ctx);
    expect(violation).not.toBeNull();
    expect(violation?.tier).toBe('hard_block');
  });

  it('should pass when auth endpoint has rate limiting', () => {
    const rule = rateLimitPolicyPack.rules.find(r => r.id === 'rate-limit/auth-endpoint');

    const ctx = createTestContext({
      filePath: 'src/auth/login.ts',
      content: `
        const limiter = rateLimit({ windowMs: 60000, max: 5 });
        app.post('/login', limiter, async (req, res) => {
          const user = await authenticate(req.body);
          res.json(user);
        });
      `,
    });

    const violation = rule!.evaluate(ctx);
    expect(violation).toBeNull();
  });

  it('should detect weak rate limit configuration', () => {
    const rule = rateLimitPolicyPack.rules.find(r => r.id === 'rate-limit/weak-config');
    expect(rule).toBeDefined();

    const ctx = createTestContext({
      content: 'const limiter = rateLimit({ windowMs: 100, max: 50000 });',
    });

    const violation = rule!.evaluate(ctx);
    expect(violation).not.toBeNull();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('ISL Policy Packs - Integration', () => {
  it('should evaluate all rules against code', async () => {
    const registry = createRegistry();
    await loadBuiltinPacks(registry);

    const rules = registry.getEnabledRules();
    const ctx = createTestContext({
      filePath: 'src/api/checkout.ts',
      content: `
        // Insecure checkout handler
        app.post('/checkout', async (req, res) => {
          console.log('Processing payment for:', req.user.email);
          const payment = { amount: 0, skipPayment: true };
          res.json({ success: true });
        });
      `,
    });

    const violations = rules
      .map(rule => rule.evaluate(ctx))
      .filter((v): v is NonNullable<typeof v> => v !== null);

    // Should detect multiple issues
    expect(violations.length).toBeGreaterThan(0);
    
    // Should have violations from different packs
    const ruleIds = violations.map(v => v.ruleId);
    expect(ruleIds.some(id => id.startsWith('payments/'))).toBe(true);
    expect(ruleIds.some(id => id.startsWith('pii/'))).toBe(true);
  });
});

// ============================================================================
// Rule Explanation Tests
// ============================================================================

describe('ISL Policy Packs - Rule Explanations', () => {
  it('should explain auth/bypass-detected rule', () => {
    const explanation = explainRule('auth/bypass-detected');
    
    expect(explanation).not.toBeNull();
    expect(explanation!.ruleId).toBe('auth/bypass-detected');
    expect(explanation!.why).toBeTruthy();
    expect(explanation!.triggers.length).toBeGreaterThan(0);
    expect(explanation!.fixes.length).toBeGreaterThan(0);
  });

  it('should explain pii/logged-sensitive-data rule', () => {
    const explanation = explainRule('pii/logged-sensitive-data');
    
    expect(explanation).not.toBeNull();
    expect(explanation!.ruleId).toBe('pii/logged-sensitive-data');
    expect(explanation!.examples.length).toBeGreaterThan(0);
    expect(explanation!.docs.length).toBeGreaterThan(0);
  });

  it('should explain rate-limit/auth-endpoint rule', () => {
    const explanation = explainRule('rate-limit/auth-endpoint');
    
    expect(explanation).not.toBeNull();
    expect(explanation!.fixes[0].code).toBeTruthy();
  });

  it('should return null for unknown rules', () => {
    const explanation = explainRule('unknown/nonexistent-rule');
    expect(explanation).toBeNull();
  });

  it('should get all explanations', () => {
    const all = getAllExplanations();
    expect(all.length).toBeGreaterThan(5);
  });

  it('should format explanation as markdown', () => {
    const explanation = explainRule('auth/hardcoded-credentials');
    expect(explanation).not.toBeNull();
    
    const md = formatExplanationMarkdown(explanation!);
    expect(md).toContain('## auth/hardcoded-credentials');
    expect(md).toContain('### Why This Matters');
    expect(md).toContain('### How to Fix');
    expect(md).toContain('```typescript');
  });

  it('should format explanation for terminal', () => {
    const explanation = explainRule('payments/webhook-signature');
    expect(explanation).not.toBeNull();
    
    const terminal = formatExplanationTerminal(explanation!);
    expect(terminal).toContain('payments/webhook-signature');
    expect(terminal).toContain('WHY:');
    expect(terminal).toContain('FIX:');
  });
});
