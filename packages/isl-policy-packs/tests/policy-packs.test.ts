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
  qualityPolicyPack,
  securityPolicyPack,
  securityRules,
  explainRule,
  getAllExplanations,
  formatExplanationMarkdown,
  formatExplanationTerminal,
  isAllowedStubFile,
  DEFAULT_STUB_ALLOWLIST,
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
    
    expect(registry.getAllPacks()).toHaveLength(7);
    expect(registry.getPack('auth')).toBeDefined();
    expect(registry.getPack('payments')).toBeDefined();
    expect(registry.getPack('pii')).toBeDefined();
    expect(registry.getPack('rate-limit')).toBeDefined();
    expect(registry.getPack('intent')).toBeDefined();
    expect(registry.getPack('quality')).toBeDefined();
    expect(registry.getPack('security')).toBeDefined();
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

  describe('pii/console-in-production - Safe Logging', () => {
    const getRule = () => piiPolicyPack.rules.find(r => r.id === 'pii/console-in-production');

    // ================================================================
    // VIOLATION TESTS: console.* triggers violation
    // ================================================================
    
    it('should detect console.log in production code', () => {
      const rule = getRule();
      expect(rule).toBeDefined();

      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: 'console.log("Processing request");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('console.log');
    });

    it('should detect console.error in production code', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: 'console.error("Something went wrong:", error);',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('console.error');
    });

    it('should detect console.warn in production code', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: 'console.warn("Deprecation warning");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('console.warn');
    });

    it('should detect console.info in production code', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: 'console.info("Server started on port 3000");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('console.info');
    });

    it('should detect console.debug in production code', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: 'console.debug("Debug data:", data);',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('console.debug');
    });

    it('should detect console.trace in production code', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: 'console.trace("Stack trace here");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('console.trace');
    });

    it('should detect console.dir in production code', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: 'console.dir(complexObject);',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('console.dir');
    });

    it('should detect console.table in production code', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: 'console.table(users);',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('console.table');
    });

    it('should detect multiple console methods', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: `
          console.log("Start");
          console.error("Error:", err);
          console.warn("Warning");
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('3 occurrences');
    });

    // ================================================================
    // PASS TESTS: logger wrapper passes
    // ================================================================

    it('should PASS when using safe logger instead of console', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: `
          import { createSafeLogger, safeError, redact } from '@isl-lang/pipeline';
          
          const logger = createSafeLogger({ service: 'users-api' });
          
          export async function getUser(id: string) {
            logger.info('Fetching user', { userId: id });
            try {
              const user = await db.users.findById(id);
              logger.debug('User found', redact({ userId: id }));
              return user;
            } catch (error) {
              logger.error('Failed to fetch user', error as Error, { userId: id });
              throw error;
            }
          }
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should PASS when using safeLog utility', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/auth.ts',
        content: `
          import { safeLog, safeError, redact } from '@isl-lang/pipeline';
          
          export async function login(email: string, password: string) {
            safeLog('Login attempt', redact({ email }));
            // ... login logic
          }
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should PASS when using process.stdout/stderr (safe logger pattern)', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/lib/logger.ts',
        content: `
          export function safeOutput(message: string) {
            const json = JSON.stringify({ message, timestamp: new Date().toISOString() });
            process.stdout.write(json + '\\n');
          }
          
          export function safeErrorOutput(message: string) {
            const json = JSON.stringify({ level: 'error', message });
            process.stderr.write(json + '\\n');
          }
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    // ================================================================
    // SKIP TESTS: test files and directories
    // ================================================================

    it('should skip console.log check in test files (.test.ts)', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/users.test.ts',
        content: 'console.log("Test output");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should skip console.log check in spec files (.spec.ts)', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/users.spec.ts',
        content: 'console.log("Spec output");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should skip console.log check in __tests__ directory', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/__tests__/users.ts',
        content: 'console.log("Test output");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should skip console.log check in __mocks__ directory', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/__mocks__/database.ts',
        content: 'console.log("Mock output");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should skip console.log check in fixtures directory', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'tests/fixtures/helpers.ts',
        content: 'console.log("Fixture output");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should skip console.log check in test-fixtures directory', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'test-fixtures/setup.ts',
        content: 'console.log("Test fixture output");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should skip console.log check in CLI files (cli.ts)', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/cli.ts',
        content: 'console.log("CLI output");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should skip console.log check in CLI files (bin.ts)', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'bin/index.ts',
        content: 'console.log("CLI output");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should skip console.log check in files with shebang', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/script.ts',
        content: '#!/usr/bin/env node\nconsole.log("CLI output");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    // ================================================================
    // SUGGESTION TEST: includes safe logger recommendation
    // ================================================================

    it('should suggest using safe logger in violation message', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: 'console.log("message");',
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.suggestion).toContain('safe logger');
      expect(violation?.suggestion).toContain('createSafeLogger');
      expect(violation?.suggestion).toContain('redact');
    });
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
// Quality Policy Pack Tests
// ============================================================================

describe('ISL Policy Packs - Quality', () => {
  it('should have correct pack metadata', () => {
    expect(qualityPolicyPack.id).toBe('quality');
    expect(qualityPolicyPack.name).toBe('Code Quality');
    expect(qualityPolicyPack.rules.length).toBeGreaterThan(0);
  });

  describe('quality/no-stubbed-handlers', () => {
    it('should detect "Not implemented" throws', () => {
      const rule = qualityPolicyPack.rules.find(r => r.id === 'quality/no-stubbed-handlers');
      expect(rule).toBeDefined();

      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: `
          export async function createUser(data: UserInput) {
            throw new Error('Not implemented');
          }
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.tier).toBe('hard_block');
      expect(violation?.message).toContain('Not implemented');
    });

    it('should detect TODO markers in postconditions', () => {
      const rule = qualityPolicyPack.rules.find(r => r.id === 'quality/no-stubbed-handlers');

      const ctx = createTestContext({
        filePath: 'src/handlers/auth.ts',
        content: `
          // ISL postconditions to satisfy:
          // - TODO: Validate user credentials
          // - TODO: Create session token
          export async function login(email: string, password: string) {
            return { success: true };
          }
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.tier).toBe('hard_block');
      expect(violation?.message).toContain('TODO');
    });

    it('should detect placeholder userLogin that throws', () => {
      const rule = qualityPolicyPack.rules.find(r => r.id === 'quality/no-stubbed-handlers');

      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          export async function userLogin(email: string, password: string) {
            throw new Error('Authentication not implemented yet');
          }
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.tier).toBe('hard_block');
    });

    it('should detect placeholder comments', () => {
      const rule = qualityPolicyPack.rules.find(r => r.id === 'quality/no-stubbed-handlers');

      const ctx = createTestContext({
        filePath: 'src/services/payment.ts',
        content: `
          export function processPayment(amount: number) {
            // TODO: implement this
            return null;
          }
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
    });

    it('should allow stubs in test files', () => {
      const rule = qualityPolicyPack.rules.find(r => r.id === 'quality/no-stubbed-handlers');

      const ctx = createTestContext({
        filePath: 'src/api/users.test.ts',
        content: `
          const mockHandler = () => {
            throw new Error('Not implemented');
          };
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should allow stubs in __mocks__ directory', () => {
      const rule = qualityPolicyPack.rules.find(r => r.id === 'quality/no-stubbed-handlers');

      const ctx = createTestContext({
        filePath: 'src/__mocks__/database.ts',
        content: `
          export function query() {
            throw new Error('Not implemented');
          }
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should allow stubs in fixtures directory', () => {
      const rule = qualityPolicyPack.rules.find(r => r.id === 'quality/no-stubbed-handlers');

      const ctx = createTestContext({
        filePath: 'tests/fixtures/stubs.ts',
        content: `
          export const stubHandler = () => {
            throw new Error('Not implemented');
          };
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });

    it('should pass for properly implemented handlers', () => {
      const rule = qualityPolicyPack.rules.find(r => r.id === 'quality/no-stubbed-handlers');

      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: `
          export async function createUser(data: UserInput) {
            const validated = schema.parse(data);
            const user = await db.users.create(validated);
            return user;
          }
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });
  });

  describe('quality/no-todo-comments', () => {
    it('should detect critical TODO comments', () => {
      const rule = qualityPolicyPack.rules.find(r => r.id === 'quality/no-todo-comments');
      expect(rule).toBeDefined();

      const ctx = createTestContext({
        filePath: 'src/api/checkout.ts',
        content: `
          export function checkout() {
            // TODO: CRITICAL - fix security vulnerability
            return process();
          }
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.tier).toBe('hard_block');
    });

    it('should warn on high TODO count', () => {
      const rule = qualityPolicyPack.rules.find(r => r.id === 'quality/no-todo-comments');

      const ctx = createTestContext({
        filePath: 'src/api/legacy.ts',
        content: `
          // TODO: refactor this
          // TODO: add validation
          // TODO: improve performance
          // TODO: add error handling
          // TODO: add logging
          // TODO: add tests
          export function legacy() {
            return 'old code';
          }
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.tier).toBe('warn');
    });
  });

  describe('quality/no-debug-code', () => {
    it('should detect debugger statements', () => {
      const rule = qualityPolicyPack.rules.find(r => r.id === 'quality/no-debug-code');
      expect(rule).toBeDefined();

      const ctx = createTestContext({
        filePath: 'src/api/users.ts',
        content: `
          export function process() {
            debugger;
            return data;
          }
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.tier).toBe('hard_block');
    });

    it('should allow debugger in test files', () => {
      const rule = qualityPolicyPack.rules.find(r => r.id === 'quality/no-debug-code');

      const ctx = createTestContext({
        filePath: 'src/api/users.test.ts',
        content: `
          test('debug test', () => {
            debugger;
            expect(true).toBe(true);
          });
        `,
      });

      const violation = rule!.evaluate(ctx);
      expect(violation).toBeNull();
    });
  });

  describe('isAllowedStubFile utility', () => {
    it('should match test files', () => {
      expect(isAllowedStubFile('src/api/users.test.ts')).toBe(true);
      expect(isAllowedStubFile('src/api/users.spec.ts')).toBe(true);
      expect(isAllowedStubFile('src/api/users.test.tsx')).toBe(true);
    });

    it('should match mock directories', () => {
      expect(isAllowedStubFile('src/__mocks__/database.ts')).toBe(true);
      expect(isAllowedStubFile('lib/mocks/api.ts')).toBe(true);
    });

    it('should match fixture directories', () => {
      expect(isAllowedStubFile('tests/fixtures/data.ts')).toBe(true);
      expect(isAllowedStubFile('src/__fixtures__/user.ts')).toBe(true);
      expect(isAllowedStubFile('test-fixtures/stubs.ts')).toBe(true);
    });

    it('should match demo and example directories', () => {
      expect(isAllowedStubFile('demo/sample.ts')).toBe(true);
      expect(isAllowedStubFile('examples/basic.ts')).toBe(true);
    });

    it('should not match production files', () => {
      expect(isAllowedStubFile('src/api/users.ts')).toBe(false);
      expect(isAllowedStubFile('lib/handlers/auth.ts')).toBe(false);
    });

    it('should support custom allowlist', () => {
      const customAllowlist = ['**/sandbox/**'];
      expect(isAllowedStubFile('src/sandbox/test.ts', customAllowlist)).toBe(true);
      expect(isAllowedStubFile('src/api/users.ts', customAllowlist)).toBe(false);
    });
  });
});

// ============================================================================
// Security Policy Pack Tests
// ============================================================================

describe('ISL Policy Packs - Security', () => {
  it('should have correct pack metadata', () => {
    expect(securityPolicyPack.id).toBe('security');
    expect(securityPolicyPack.name).toBe('Login Security Invariants');
    expect(securityPolicyPack.rules.length).toBe(5);
  });

  // ============================================================================
  // security/password-never-logged Rule
  // ============================================================================
  
  describe('security/password-never-logged', () => {
    const getRule = () => securityRules.passwordNeverLogged;

    // VIOLATION: Direct input.password logging
    it('should detect direct input.password in console.log', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          export function login(input) {
            console.log('Login attempt:', input.password);
          }
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.ruleId).toBe('security/password-never-logged');
      expect(violation?.tier).toBe('hard_block');
      expect(violation?.message).toContain('PASSWORD_LOGGED');
    });

    // VIOLATION: input['password'] bracket notation
    it('should detect input["password"] bracket notation', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          logger.info("Processing", input["password"]);
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.tier).toBe('hard_block');
    });

    // VIOLATION: req.body.password
    it('should detect req.body.password in logs', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          console.log('Body:', req.body.password);
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
    });

    // VIOLATION: Derived password variable
    it('should detect derived password variable in logs', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          const pw = input.password;
          console.log('User input data:', pw);
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('Derived password variable');
      expect(violation?.message).toContain('pw');
    });

    // VIOLATION: Destructured password variable
    it('should detect destructured password in logs', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          const { password } = input;
          logger.debug('User provided', password);
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
    });

    // VIOLATION: Password keyword in log message
    it('should detect password keyword in log', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          console.log('Checking password validity');
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('"password"');
    });

    // VIOLATION: Various logging libraries
    it('should detect winston.info with password', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          winston.info('User credential:', input.password);
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
    });

    it('should detect pino.debug with password', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          pino.debug({ password: input.password });
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
    });

    // PASS: Logging without password
    it('should PASS when logging does not include password', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          const { email } = input;
          console.log('Login attempt for:', email);
          logger.info('Processing login', { userId: user.id });
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).toBeNull();
    });

    // PASS: Password hashing (not logging)
    it('should PASS when password is hashed but not logged', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          const hash = await bcrypt.hash(input.password, 10);
          await db.users.update({ password_hash: hash });
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).toBeNull();
    });
  });

  // ============================================================================
  // security/error-message-consistency Rule
  // ============================================================================
  
  describe('security/error-message-consistency', () => {
    const getRule = () => securityRules.errorMessageConsistency;

    // VIOLATION: User not found error
    it('should detect "user not found" error message', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          if (!user) {
            throw new Error('User not found');
          }
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.ruleId).toBe('security/error-message-consistency');
      expect(violation?.message).toContain('USER_ENUMERATION');
      expect(violation?.metadata?.errorType).toBe('user-not-found');
    });

    // VIOLATION: Email not found
    it('should detect "email not found" error message', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          return { error: "Email not found" };
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
    });

    // VIOLATION: Invalid email
    it('should detect "invalid email" error message', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          res.status(400).json({ message: "Invalid email" });
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
    });

    // VIOLATION: Wrong password error
    it('should detect "wrong password" error message', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          if (!passwordMatch) {
            throw new AuthError('Wrong password');
          }
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.metadata?.errorType).toBe('wrong-password');
    });

    // VIOLATION: Incorrect password
    it('should detect "incorrect password" error message', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          return { success: false, error: "Incorrect password" };
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
    });

    // VIOLATION: USER_NOT_FOUND error code
    it('should detect USER_NOT_FOUND error code', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          throw new AppError('USER_NOT_FOUND');
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
    });

    // PASS: Generic "Invalid credentials" message
    it('should PASS with generic "Invalid credentials" message', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          if (!user || !passwordMatch) {
            throw new Error('Invalid credentials');
          }
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).toBeNull();
    });

    // PASS: INVALID_CREDENTIALS error code
    it('should PASS with INVALID_CREDENTIALS error code', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          if (!authenticated) {
            return { error: 'INVALID_CREDENTIALS' };
          }
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).toBeNull();
    });
  });

  // ============================================================================
  // security/password-never-stored-plaintext Rule
  // ============================================================================
  
  describe('security/password-never-stored-plaintext', () => {
    const getRule = () => securityRules.passwordNeverStoredPlaintext;

    // VIOLATION: Direct password storage
    it('should detect direct password storage without hashing', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/register.ts',
        content: `
          const user = await prisma.user.create({
            data: {
              email: input.email,
              password: input.password
            }
          });
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.ruleId).toBe('security/password-never-stored-plaintext');
      expect(violation?.message).toContain('PLAINTEXT_PASSWORD');
    });

    // VIOLATION: user.password = input.password
    it('should detect user.password = input.password assignment', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/register.ts',
        content: `
          const user = new User();
          user.password = input.password;
          await user.save();
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
    });

    // PASS: Hashed password storage
    it('should PASS when password is hashed before storage', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/register.ts',
        content: `
          const hashedPassword = await bcrypt.hash(input.password, 10);
          const user = await prisma.user.create({
            data: {
              email: input.email,
              password_hash: hashedPassword
            }
          });
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).toBeNull();
    });

    // PASS: argon2 hashing
    it('should PASS with argon2 hashing', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/register.ts',
        content: `
          const hash = await argon2.hash(input.password);
          await db.users.insert({ password: hash });
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).toBeNull();
    });
  });

  // ============================================================================
  // security/trace-password-scan Rule (Runtime)
  // ============================================================================
  
  describe('security/trace-password-scan', () => {
    const getRule = () => securityRules.tracePasswordScan;

    // VIOLATION: Password in trace file
    it('should detect password value in trace file', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'logs/app.trace.json',
        content: `
          {"type":"log","data":{"message":"Login","password":"secret123"}}
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.ruleId).toBe('security/trace-password-scan');
      expect(violation?.message).toContain('PASSWORD_IN_TRACE');
    });

    // VIOLATION: Password in truthpack traces
    it('should detect password in truthpack traces', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: '',
        truthpack: {
          traces: [
            { type: 'log', data: { password: 'mypassword123' } }
          ]
        },
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
    });

    // PASS: No password in trace
    it('should PASS when trace has no password', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'logs/app.trace.json',
        content: `
          {"type":"log","data":{"message":"Login successful","userId":"123"}}
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).toBeNull();
    });

    // SKIP: Non-trace source file
    it('should skip non-trace source files', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'src/auth/login.ts',
        content: `
          const password = input.password; // This is source, not trace
        `,
        truthpack: {},
      });

      const violation = rule.evaluate(ctx);
      expect(violation).toBeNull();
    });
  });

  // ============================================================================
  // security/trace-redacted-marker Rule (Runtime)
  // ============================================================================
  
  describe('security/trace-redacted-marker', () => {
    const getRule = () => securityRules.traceRedactedMarker;

    // WARNING: [REDACTED] marker found
    it('should warn when [REDACTED] marker found in trace', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'logs/app.trace.json',
        content: `
          {"type":"log","data":{"message":"Login","password":"[REDACTED]"}}
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe('warning');
      expect(violation?.tier).toBe('soft_block');
      expect(violation?.message).toContain('REDACTION_MARKER');
    });

    // WARNING: *** marker found
    it('should warn when *** marker found in trace', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'logs/app.log.json',
        content: `
          {"level":"info","message":"User login","password":"***"}
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).not.toBeNull();
      expect(violation?.message).toContain('***');
    });

    // PASS: No redaction markers
    it('should PASS when no redaction markers present', () => {
      const rule = getRule();
      const ctx = createTestContext({
        filePath: 'logs/app.trace.json',
        content: `
          {"type":"log","data":{"message":"Login successful","userId":"123"}}
        `,
      });

      const violation = rule.evaluate(ctx);
      expect(violation).toBeNull();
    });
  });

  // ============================================================================
  // Combined Invariant Tests (from login.isl)
  // ============================================================================
  
  describe('login.isl Invariant Enforcement', () => {
    it('should enforce "password never_logged" invariant via static analysis', () => {
      const rule = securityRules.passwordNeverLogged;
      
      // Code that VIOLATES the invariant
      const badCode = createTestContext({
        filePath: 'src/handlers/login.ts',
        content: `
          export async function handleLogin(input: LoginInput) {
            console.log('Authenticating user with password:', input.password);
            const user = await findUser(input.email);
            return authenticate(user, input.password);
          }
        `,
      });

      const violation = rule.evaluate(badCode);
      expect(violation).not.toBeNull();
      expect(violation?.tier).toBe('hard_block');
    });

    it('should allow code that satisfies "password never_logged" invariant', () => {
      const rule = securityRules.passwordNeverLogged;
      
      // Code that SATISFIES the invariant
      const goodCode = createTestContext({
        filePath: 'src/handlers/login.ts',
        content: `
          export async function handleLogin(input: LoginInput) {
            logger.info('Login attempt', { email: redact(input.email) });
            const user = await findUser(input.email);
            const isValid = await bcrypt.compare(input.password, user.password_hash);
            if (!isValid) {
              logger.warn('Failed login', { email: redact(input.email) });
              throw new InvalidCredentialsError();
            }
            return createSession(user);
          }
        `,
      });

      const violation = rule.evaluate(goodCode);
      expect(violation).toBeNull();
    });

    it('should enforce same error for invalid email/password', () => {
      const rule = securityRules.errorMessageConsistency;
      
      // Code that has USER_NOT_FOUND (violates invariant)
      const badCode = createTestContext({
        filePath: 'src/handlers/login.ts',
        content: `
          export async function handleLogin(input: LoginInput) {
            const user = await findUser(input.email);
            if (!user) {
              throw new Error('User not found'); // VIOLATION!
            }
            const match = await bcrypt.compare(input.password, user.hash);
            if (!match) {
              throw new Error('Invalid password'); // ALSO VIOLATION!
            }
          }
        `,
      });

      const violation = rule.evaluate(badCode);
      expect(violation).not.toBeNull();
    });

    it('should allow unified error messages', () => {
      const rule = securityRules.errorMessageConsistency;
      
      // Code that uses generic error (satisfies invariant)
      const goodCode = createTestContext({
        filePath: 'src/handlers/login.ts',
        content: `
          export async function handleLogin(input: LoginInput) {
            const user = await findUser(input.email);
            const match = user ? await bcrypt.compare(input.password, user.hash) : false;
            if (!user || !match) {
              throw new InvalidCredentialsError(); // Same error for both cases
            }
            return createSession(user);
          }
        `,
      });

      const violation = rule.evaluate(goodCode);
      expect(violation).toBeNull();
    });
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
  it('should explain intent/audit-required rule', () => {
    const explanation = explainRule('intent/audit-required');
    
    expect(explanation).not.toBeNull();
    expect(explanation!.ruleId).toBe('intent/audit-required');
    expect(explanation!.why).toContain('compliance');
    expect(explanation!.triggers.length).toBeGreaterThan(5);
    expect(explanation!.fixes.length).toBeGreaterThan(2);
    expect(explanation!.examples.length).toBeGreaterThan(0);
    expect(explanation!.related).toContain('intent/rate-limit-required');
  });

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
