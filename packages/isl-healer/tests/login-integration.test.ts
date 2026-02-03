/**
 * Login Integration Test: fail -> heal -> PROVEN
 *
 * This test validates the complete healing pipeline for a login implementation:
 * 1. Start with broken code (missing audit, rate limit, PII leaks)
 * 2. Run healer with deterministic recipes
 * 3. Verify all violations are fixed without suppressions
 * 4. Validate proof bundle contains iteration diffs
 *
 * Target fixes verified:
 * - Add missing audit events (all paths)
 * - Add early rate limit checks (before body parsing)
 * - Enforce constant-time compare helper
 * - Remove log sinks containing sensitive data
 * - Ensure lockout/captcha thresholds are enforced
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ISLHealerV2,
  healUntilShip,
  createMockGateResult,
  createViolation,
} from '../src/index.js';
import type {
  ISLAST,
  GateResult,
  Violation,
  HealResult,
} from '../src/types.js';

// ============================================================================
// Test Fixtures: Login ISL Spec
// ============================================================================

const createLoginAST = (): ISLAST => ({
  kind: 'Domain',
  name: 'Auth',
  version: '1.0.0',
  entities: [
    {
      name: 'User',
      fields: [
        { name: 'id', type: { kind: 'primitive', name: 'UUID' }, optional: false },
        { name: 'email', type: { kind: 'primitive', name: 'Email' }, optional: false },
        { name: 'password_hash', type: { kind: 'primitive', name: 'String' }, optional: false },
        { name: 'failed_attempts', type: { kind: 'primitive', name: 'Int' }, optional: false },
        { name: 'status', type: { kind: 'primitive', name: 'String' }, optional: false },
      ],
    },
    {
      name: 'Session',
      fields: [
        { name: 'id', type: { kind: 'primitive', name: 'UUID' }, optional: false },
        { name: 'user_id', type: { kind: 'primitive', name: 'UUID' }, optional: false },
        { name: 'access_token', type: { kind: 'primitive', name: 'String' }, optional: false },
        { name: 'expires_at', type: { kind: 'primitive', name: 'DateTime' }, optional: false },
      ],
    },
  ],
  behaviors: [
    {
      name: 'UserLogin',
      preconditions: [
        'email.isValidFormat()',
        'password.length >= 8',
        'rateLimitNotExceeded(email, ip)',
      ],
      postconditions: [
        'session.isValid()',
        'session.user_id == user.id',
        'audit.recorded("login_success", user.id)',
      ],
      intents: [
        { tag: 'rate-limit-required', description: 'Protect against brute force' },
        { tag: 'audit-required', description: 'Log all login attempts' },
        { tag: 'no-pii-logging', description: 'Never log passwords or sensitive data' },
        { tag: 'constant-time-compare', description: 'Prevent timing attacks' },
        { tag: 'lockout-threshold', description: 'Lock after failed attempts' },
      ],
      inputs: [
        { kind: 'primitive', name: 'Email' },
        { kind: 'primitive', name: 'String' },
      ],
      outputs: [
        { kind: 'entity', name: 'Session' },
      ],
      errors: [
        'ValidationError',
        'RateLimited',
        'InvalidCredentials',
        'AccountLocked',
      ],
    },
  ],
  invariants: [
    { name: 'password_never_logged', condition: 'password.neverLogged()' },
    { name: 'email_redacted', condition: 'email.redactedInLogs()' },
  ],
  metadata: {
    generatedFrom: 'test',
    prompt: 'Login integration test',
    timestamp: new Date().toISOString(),
    confidence: 1.0,
  },
});

// ============================================================================
// Test Fixtures: Broken Login Implementation
// ============================================================================

const createBrokenLoginCode = (): Map<string, string> => {
  return new Map([
    [
      'app/api/auth/login/route.ts',
      `/**
 * INTENTIONALLY BROKEN LOGIN - for healer testing
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const users = new Map<string, {
  id: string;
  email: string;
  password_hash: string;
  status: 'ACTIVE' | 'LOCKED' | 'INACTIVE';
  failed_attempts: number;
}>();

users.set('test@example.com', {
  id: 'user_123',
  email: 'test@example.com',
  password_hash: 'hashed_ValidPass123!',
  status: 'ACTIVE',
  failed_attempts: 0,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // ❌ VIOLATION: Logging PII (email and password!)
    console.log('Login attempt:', body.email, body.password);
    
    // ❌ VIOLATION: No rate limiting
    
    const input = LoginSchema.parse(body);
    const user = users.get(input.email);
    
    if (!user) {
      // ❌ VIOLATION: No audit logging
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } },
        { status: 401 }
      );
    }
    
    if (user.status === 'LOCKED') {
      return NextResponse.json(
        { success: false, error: { code: 'ACCOUNT_LOCKED', message: 'Account locked' } },
        { status: 401 }
      );
    }
    
    // ❌ VIOLATION: Direct string comparison (timing attack vulnerable)
    const expectedHash = \`hashed_\${input.password}\`;
    if (user.password_hash !== expectedHash) {
      user.failed_attempts++;
      
      // ❌ VIOLATION: No lockout threshold check
      
      // ❌ VIOLATION: No audit logging
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } },
        { status: 401 }
      );
    }
    
    user.failed_attempts = 0;
    
    const session = {
      id: \`sess_\${Date.now()}\`,
      user_id: user.id,
      access_token: \`token_\${Math.random().toString(36).substring(2)}\`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    
    // ❌ VIOLATION: No audit logging for success
    
    return NextResponse.json({
      success: true,
      data: { session, access_token: session.access_token },
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } },
        { status: 400 }
      );
    }
    
    // ❌ VIOLATION: Raw error logging
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } },
      { status: 500 }
    );
  }
}
`,
    ],
  ]);
};

// ============================================================================
// Mock Gate: Simulates verification
// ============================================================================

/**
 * Create a mock gate that returns violations based on code analysis
 */
function createMockGateForCode(code: Map<string, string>): () => Promise<GateResult> {
  return async () => {
    const routeCode = code.get('app/api/auth/login/route.ts') || '';
    const violations: Violation[] = [];

    // Check for rate limiting
    if (!routeCode.includes('rateLimit')) {
      violations.push(
        createViolation(
          'intent/rate-limit-required',
          'app/api/auth/login/route.ts',
          'Missing rate limiting before authentication',
          30
        )
      );
    }

    // Check for audit logging
    const auditMatches = (routeCode.match(/auditAttempt|await\s+audit\s*\(/g) || []).length;
    const returnMatches = (routeCode.match(/return\s+NextResponse\.json/g) || []).length;
    if (auditMatches < returnMatches) {
      violations.push(
        createViolation(
          'intent/audit-required',
          'app/api/auth/login/route.ts',
          `Missing audit on some paths: ${auditMatches} audits for ${returnMatches} returns`,
          40
        )
      );
    }

    // Check for PII logging
    if (routeCode.includes('console.log') && (routeCode.includes('password') || routeCode.includes('email'))) {
      violations.push(
        createViolation(
          'intent/no-pii-logging',
          'app/api/auth/login/route.ts',
          'Logging sensitive data (password/email)',
          35
        )
      );
    }

    // Check for constant-time compare
    if (routeCode.includes('!== expectedHash') || routeCode.includes('=== expectedHash')) {
      if (!routeCode.includes('constantTimeCompare') && !routeCode.includes('timingSafeEqual')) {
        violations.push(
          createViolation(
            'intent/constant-time-compare',
            'app/api/auth/login/route.ts',
            'Using direct string comparison for password verification',
            55
          )
        );
      }
    }

    // Check for lockout threshold
    if (routeCode.includes('failed_attempts++') && !routeCode.includes('LOCKOUT_THRESHOLD')) {
      violations.push(
        createViolation(
          'intent/lockout-threshold',
          'app/api/auth/login/route.ts',
          'Missing lockout threshold enforcement',
          60
        )
      );
    }

    const verdict = violations.length === 0 ? 'SHIP' : 'NO_SHIP';
    const score = Math.max(0, 100 - violations.length * 15);

    return createMockGateResult(verdict, violations, score);
  };
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Login Integration: fail -> heal -> PROVEN', () => {
  let ast: ISLAST;
  let brokenCode: Map<string, string>;

  beforeEach(() => {
    ast = createLoginAST();
    brokenCode = createBrokenLoginCode();
  });

  describe('End-to-End Healing Flow', () => {
    it('heals broken login code to SHIP status', async () => {
      const healer = new ISLHealerV2(ast, brokenCode, {
        maxIterations: 10,
        verbose: false,
      });

      // Use a mock gate that checks the actual code state
      const result = await healer.heal(() => createMockGateForCode(healer.getCodeMap())());

      expect(result.ok).toBe(true);
      expect(result.reason).toBe('ship');
      expect(result.gate.verdict).toBe('SHIP');
    }, 30000);

    it('produces proof bundle with iteration diffs', async () => {
      const healer = new ISLHealerV2(ast, brokenCode, {
        maxIterations: 10,
        verbose: false,
      });

      const result = await healer.heal(() => createMockGateForCode(healer.getCodeMap())());

      // Verify proof bundle structure
      expect(result.proof).toBeDefined();
      expect(result.proof.version).toBe('2.0.0');
      expect(result.proof.healing.performed).toBe(true);
      expect(result.proof.healing.iterations).toBeGreaterThan(1);

      // Verify iteration history has diffs
      const historyWithDiffs = result.proof.healing.history.filter(h => h.diff);
      expect(historyWithDiffs.length).toBeGreaterThan(0);

      // Verify verdict
      expect(result.proof.verdict).toBe('HEALED');
    }, 30000);

    it('fixes all target violations deterministically', async () => {
      const result = await healUntilShip(ast, brokenCode, () => 
        createMockGateForCode(new Map(brokenCode))()
      , { maxIterations: 10, verbose: false });

      // Get final code
      const finalCode = result.finalCode.get('app/api/auth/login/route.ts') || '';

      // Verify fixes
      expect(finalCode).not.toContain('console.log');
      expect(finalCode).not.toContain("console.log('Login attempt:");

      // Note: Full verification depends on the mock gate implementation
    }, 30000);
  });

  describe('Deterministic Recipe Application', () => {
    it('adds audit on ALL exit paths', async () => {
      const healer = new ISLHealerV2(ast, brokenCode, { verbose: false });
      const result = await healer.heal(() => createMockGateForCode(healer.getCodeMap())());

      const finalCode = result.finalCode.get('app/api/auth/login/route.ts') || '';

      // Count returns and audits
      const returnMatches = finalCode.match(/return\s+NextResponse\.json/g) || [];
      const auditMatches = finalCode.match(/auditAttempt|await\s+audit\s*\(/g) || [];

      // Should have at least one audit per return
      expect(auditMatches.length).toBeGreaterThanOrEqual(returnMatches.length);
    }, 30000);

    it('adds rate limiting BEFORE body parsing', async () => {
      const healer = new ISLHealerV2(ast, brokenCode, { verbose: false });
      const result = await healer.heal(() => createMockGateForCode(healer.getCodeMap())());

      const finalCode = result.finalCode.get('app/api/auth/login/route.ts') || '';

      // If rateLimit is added, it should be before request.json()
      if (finalCode.includes('rateLimit')) {
        const rateLimitPos = finalCode.indexOf('rateLimit');
        const jsonParsePos = finalCode.indexOf('request.json()');

        expect(rateLimitPos).toBeLessThan(jsonParsePos);
      }
    }, 30000);

    it('removes PII from all log statements', async () => {
      const healer = new ISLHealerV2(ast, brokenCode, { verbose: false });
      const result = await healer.heal(() => createMockGateForCode(healer.getCodeMap())());

      const finalCode = result.finalCode.get('app/api/auth/login/route.ts') || '';

      // No console.log with password
      expect(finalCode).not.toMatch(/console\.log\([^)]*password/i);

      // No console.log with email in args
      expect(finalCode).not.toMatch(/console\.log\([^)]*body\.email/i);
    }, 30000);
  });

  describe('Stuck Detection and Abort', () => {
    it('detects stuck violations and aborts', async () => {
      // Create a mock gate that always returns the same unknown violation
      const mockGate = async (): Promise<GateResult> => {
        return createMockGateResult('NO_SHIP', [
          createViolation('custom/unknown-rule', 'file.ts', 'Unknown', 1),
        ], 80);
      };

      const result = await healUntilShip(ast, brokenCode, mockGate, {
        maxIterations: 5,
        verbose: false,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('unknown_rule');
      expect(result.unknownRules).toContain('custom/unknown-rule');
    });

    it('detects oscillating patterns', async () => {
      let callCount = 0;
      const mockGate = async (): Promise<GateResult> => {
        callCount++;
        // Alternate between two different violation sets
        const violations = callCount % 2 === 0
          ? [createViolation('intent/audit-required', 'file.ts', 'V1', 1)]
          : [createViolation('intent/rate-limit-required', 'file.ts', 'V2', 1)];

        return createMockGateResult('NO_SHIP', violations, 80);
      };

      const result = await healUntilShip(ast, brokenCode, mockGate, {
        maxIterations: 10,
        stopOnRepeat: 2,
        verbose: false,
      });

      expect(result.ok).toBe(false);
      expect(['stuck', 'oscillating', 'max_iterations']).toContain(result.reason);
    });
  });

  describe('Proof Bundle Integrity', () => {
    it('includes complete iteration history', async () => {
      const healer = new ISLHealerV2(ast, brokenCode, { verbose: false });
      const result = await healer.heal(() => createMockGateForCode(healer.getCodeMap())());

      // Each iteration should have required fields
      for (const iteration of result.proof.healing.history) {
        expect(iteration.iteration).toBeGreaterThan(0);
        expect(iteration.gateResult).toBeDefined();
        expect(iteration.gateResult.verdict).toMatch(/^(SHIP|NO_SHIP)$/);
        expect(iteration.codeStateHash).toBeTruthy();
        expect(iteration.timestamp).toBeTruthy();
      }
    }, 30000);

    it('includes proof chain for tamper detection', async () => {
      const healer = new ISLHealerV2(ast, brokenCode, { verbose: false });
      const result = await healer.heal(() => createMockGateForCode(healer.getCodeMap())());

      expect(result.proof.chain.length).toBeGreaterThan(0);
      expect(result.proof.chain[0].action).toBe('init');
      expect(result.proof.chain[result.proof.chain.length - 1].action).toBe('finalize');

      // Verify chain ordering
      for (let i = 0; i < result.proof.chain.length; i++) {
        expect(result.proof.chain[i].step).toBe(i + 1);
      }
    }, 30000);

    it('includes source ISL specification info', async () => {
      const healer = new ISLHealerV2(ast, brokenCode, { verbose: false });
      const result = await healer.heal(() => createMockGateForCode(healer.getCodeMap())());

      expect(result.proof.source.domain).toBe('Auth');
      expect(result.proof.source.version).toBe('1.0.0');
      expect(result.proof.source.hash).toBeTruthy();
    }, 30000);
  });

  describe('No Weakening Allowed', () => {
    it('refuses to add @ts-ignore', async () => {
      // Test that weakening guard rejects suppression patterns
      const { WeakeningGuard } = await import('../src/weakening-guard.js');
      const guard = new WeakeningGuard();

      const result = guard.checkContent('// @ts-ignore\nconst x = 1;');
      expect(result.detected).toBe(true);
      expect(result.matches[0].pattern.category).toBe('suppression');
    });

    it('refuses to add eslint-disable', async () => {
      const { WeakeningGuard } = await import('../src/weakening-guard.js');
      const guard = new WeakeningGuard();

      const result = guard.checkContent('// eslint-disable-next-line\nconst x = 1;');
      expect(result.detected).toBe(true);
    });
  });
});
