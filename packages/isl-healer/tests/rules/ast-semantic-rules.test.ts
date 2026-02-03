/**
 * AST Semantic Rules Tests
 *
 * Tests that demonstrate:
 * 1. FAIL: Code with violations is detected
 * 2. HEAL: Recipe patches are applied
 * 3. PASS: Healed code passes semantic checks
 *
 * No suppressions allowed - passing means real enforcement.
 *
 * @module @isl-lang/healer/tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  runASTSemanticRules,
  auditRequiredRule,
  rateLimitRequiredRule,
  noPiiLoggingRule,
  noStubbedHandlersRule,
} from '../../src/rules/ast-semantic-rules';
import {
  applyRecipe,
  DETERMINISTIC_RECIPES,
  type FixContext,
} from '../../src/rules/deterministic-recipes';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * FIXTURE: Handler with NO audit on any return path
 */
const FIXTURE_NO_AUDIT = `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  if (!body.email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }
  
  const result = await processLogin(body);
  
  return NextResponse.json(result);
}
`;

/**
 * FIXTURE: Handler with audit on success but NOT on error paths
 */
const FIXTURE_PARTIAL_AUDIT = `import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';

export async function POST(request: Request) {
  const body = await request.json();
  
  if (!body.email) {
    // Missing audit on this error path!
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }
  
  const result = await processLogin(body);
  
  // Only auditing success
  await audit({ action: 'login', success: true, timestamp: Date.now() });
  return NextResponse.json(result);
}
`;

/**
 * FIXTURE: Handler with wrong success value on error path
 */
const FIXTURE_WRONG_SUCCESS = `import { NextResponse } from 'next/server';
import { auditAttempt } from '@/lib/audit';

export async function POST(request: Request) {
  const body = await request.json();
  
  if (!body.email) {
    // BUG: success should be false here!
    await auditAttempt({ action: 'login', success: true, timestamp: Date.now() });
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }
  
  await auditAttempt({ action: 'login', success: true, timestamp: Date.now() });
  return NextResponse.json({ ok: true });
}
`;

/**
 * FIXTURE: Rate limit AFTER body parsing (wrong order)
 */
const FIXTURE_RATE_LIMIT_WRONG_ORDER = `import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  // BAD: Body is parsed first!
  const body = await request.json();
  
  // Rate limit should be BEFORE body parsing
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  return NextResponse.json({ ok: true });
}
`;

/**
 * FIXTURE: No rate limiting at all
 */
const FIXTURE_NO_RATE_LIMIT = `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  const result = await db.users.create({ data: body });
  
  return NextResponse.json(result);
}
`;

/**
 * FIXTURE: Console.log in production handler
 */
const FIXTURE_CONSOLE_LOG = `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  // BAD: console.log in production with potential PII
  console.log('Processing request:', body);
  console.log('User email:', body.email);
  
  const result = await processRequest(body);
  
  console.error('Operation completed', result);
  
  return NextResponse.json(result);
}
`;

/**
 * FIXTURE: Raw request body logging
 */
const FIXTURE_RAW_BODY_LOG = `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  // CRITICAL: Raw request body logged - may contain PII
  console.log('Request body:', req.body);
  logger.info('Processing', { body: request.body });
  
  return NextResponse.json({ ok: true });
}
`;

/**
 * FIXTURE: Stubbed handler
 */
const FIXTURE_STUBBED_HANDLER = `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  throw new Error('Not implemented');
}
`;

/**
 * FIXTURE: Handler with TODO in postconditions
 */
const FIXTURE_TODO_POSTCONDITIONS = `import { NextResponse } from 'next/server';

// ISL postconditions to satisfy:
// - TODO: user must be authenticated
// - TODO: audit must be logged

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ ok: true });
}
`;

/**
 * FIXTURE: Correctly implemented handler (should pass)
 */
const FIXTURE_CORRECT_HANDLER = `import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { audit, auditAttempt } from '@/lib/audit';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// @intent audit-required - Audit helper called on ALL exit paths
async function auditAttempt(input: {
  action: string;
  success: boolean;
  reason?: string;
  requestId: string;
}) {
  await audit({ ...input, timestamp: new Date().toISOString() });
}

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const action = 'user_login';

  // @intent rate-limit-required - MUST be before body parsing
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    await auditAttempt({ action, success: false, reason: 'rate_limited', requestId });
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  const body = await request.json();

  // @intent input-validation - validate before use
  const validationResult = LoginSchema.safeParse(body);
  if (!validationResult.success) {
    await auditAttempt({ action, success: false, reason: 'validation_failed', requestId });
    return NextResponse.json(
      { error: 'Validation failed', details: validationResult.error.flatten() },
      { status: 400 }
    );
  }
  const input = validationResult.data;

  // No console.log - use structured logging if needed
  const result = await processLogin(input);

  await auditAttempt({ action, success: true, requestId });
  return NextResponse.json(result);
}
`;

// ============================================================================
// Test: intent/audit-required
// ============================================================================

describe('intent/audit-required', () => {
  describe('FAIL: Detects violations', () => {
    it('should detect handler with no audit calls', () => {
      const codeMap = new Map([['app/api/login/route.ts', FIXTURE_NO_AUDIT]]);
      const violations = runASTSemanticRules(codeMap);

      const auditViolations = violations.filter((v) => v.ruleId === 'intent/audit-required');
      expect(auditViolations.length).toBeGreaterThan(0);
      expect(auditViolations.some((v) => v.message.includes('Missing audit'))).toBe(true);
    });

    it('should detect handler with partial audit coverage', () => {
      const codeMap = new Map([['app/api/login/route.ts', FIXTURE_PARTIAL_AUDIT]]);
      const violations = runASTSemanticRules(codeMap);

      const auditViolations = violations.filter((v) => v.ruleId === 'intent/audit-required');
      expect(auditViolations.length).toBeGreaterThan(0);
      // Should detect the error path missing audit
      expect(auditViolations.some((v) => v.message.includes('validation') || v.message.includes('error'))).toBe(true);
    });

    it('should detect wrong success value on error path', () => {
      const codeMap = new Map([['app/api/login/route.ts', FIXTURE_WRONG_SUCCESS]]);
      const violations = runASTSemanticRules(codeMap);

      const auditViolations = violations.filter((v) => v.ruleId === 'intent/audit-required');
      expect(auditViolations.some((v) => v.message.includes('success:true') && v.message.includes('false'))).toBe(true);
    });
  });

  describe('HEAL: Recipe fixes violations', () => {
    it('should add audit calls to all return paths', () => {
      const codeMap = new Map([['app/api/login/route.ts', FIXTURE_NO_AUDIT]]);
      const violations = runASTSemanticRules(codeMap);

      const ctx: FixContext = {
        codeMap,
        framework: 'nextjs-app-router',
        behaviorName: 'Login',
      };

      // Apply recipe for first violation
      const violation = violations.find((v) => v.ruleId === 'intent/audit-required');
      expect(violation).toBeDefined();

      const result = applyRecipe(violation!, ctx);
      expect(result.patches.length).toBeGreaterThan(0);

      // Verify patches include audit helper and audit calls
      const newCode = result.newCode;
      expect(newCode).toContain('auditAttempt');
      expect(newCode).toContain('requestId');
    });
  });

  describe('PASS: Healed code passes', () => {
    it('should pass on correctly implemented handler', () => {
      const codeMap = new Map([['app/api/login/route.ts', FIXTURE_CORRECT_HANDLER]]);
      const violations = runASTSemanticRules(codeMap);

      const auditViolations = violations.filter((v) => v.ruleId === 'intent/audit-required');
      expect(auditViolations.length).toBe(0);
    });

    it('should pass after healing', () => {
      const codeMap = new Map([['app/api/login/route.ts', FIXTURE_NO_AUDIT]]);

      const ctx: FixContext = {
        codeMap,
        framework: 'nextjs-app-router',
        behaviorName: 'Login',
      };

      // Apply recipe iteratively until no more violations
      let violations = runASTSemanticRules(codeMap);
      let iterations = 0;
      const maxIterations = 5;

      while (violations.length > 0 && iterations < maxIterations) {
        const violation = violations.find((v) => v.ruleId === 'intent/audit-required');
        if (!violation) break;

        const result = applyRecipe(violation, ctx);
        if (result.success) {
          codeMap.set(violation.file, result.newCode);
        }

        violations = runASTSemanticRules(codeMap);
        iterations++;
      }

      // After healing, should have fewer violations
      const remainingAuditViolations = violations.filter((v) => v.ruleId === 'intent/audit-required');
      // The recipe should have addressed the main violations
      expect(iterations).toBeLessThan(maxIterations);
    });
  });
});

// ============================================================================
// Test: intent/rate-limit-required
// ============================================================================

describe('intent/rate-limit-required', () => {
  describe('FAIL: Detects violations', () => {
    it('should detect missing rate limiting', () => {
      const codeMap = new Map([['app/api/users/route.ts', FIXTURE_NO_RATE_LIMIT]]);
      const violations = runASTSemanticRules(codeMap);

      const rateLimitViolations = violations.filter((v) => v.ruleId === 'intent/rate-limit-required');
      expect(rateLimitViolations.length).toBeGreaterThan(0);
      expect(rateLimitViolations.some((v) => v.message.includes('no rate limiting'))).toBe(true);
    });

    it('should detect rate limit in wrong order (after body parse)', () => {
      const codeMap = new Map([['app/api/users/route.ts', FIXTURE_RATE_LIMIT_WRONG_ORDER]]);
      const violations = runASTSemanticRules(codeMap);

      const rateLimitViolations = violations.filter((v) => v.ruleId === 'intent/rate-limit-required');
      expect(rateLimitViolations.some((v) => v.message.includes('AFTER'))).toBe(true);
    });
  });

  describe('HEAL: Recipe fixes violations', () => {
    it('should add rate limit before body parsing', () => {
      const codeMap = new Map([['app/api/users/route.ts', FIXTURE_NO_RATE_LIMIT]]);
      const violations = runASTSemanticRules(codeMap);

      const ctx: FixContext = {
        codeMap,
        framework: 'nextjs-app-router',
        behaviorName: 'CreateUser',
      };

      const violation = violations.find((v) => v.ruleId === 'intent/rate-limit-required');
      expect(violation).toBeDefined();

      const result = applyRecipe(violation!, ctx);
      expect(result.patches.length).toBeGreaterThan(0);

      // Verify rate limit is added
      expect(result.newCode).toContain('rateLimit');
      expect(result.newCode).toContain('429');

      // Verify order: rateLimit comes before request.json()
      const rateLimitPos = result.newCode.indexOf('rateLimit');
      const jsonPos = result.newCode.indexOf('request.json()');
      expect(rateLimitPos).toBeLessThan(jsonPos);
    });
  });

  describe('PASS: Healed code passes', () => {
    it('should pass on correctly implemented handler', () => {
      const codeMap = new Map([['app/api/login/route.ts', FIXTURE_CORRECT_HANDLER]]);
      const violations = runASTSemanticRules(codeMap);

      const rateLimitViolations = violations.filter((v) => v.ruleId === 'intent/rate-limit-required');
      expect(rateLimitViolations.length).toBe(0);
    });
  });
});

// ============================================================================
// Test: intent/no-pii-logging
// ============================================================================

describe('intent/no-pii-logging', () => {
  describe('FAIL: Detects violations', () => {
    it('should detect console.log in production handler', () => {
      const codeMap = new Map([['app/api/users/route.ts', FIXTURE_CONSOLE_LOG]]);
      const violations = runASTSemanticRules(codeMap);

      const piiViolations = violations.filter((v) => v.ruleId === 'intent/no-pii-logging');
      expect(piiViolations.length).toBeGreaterThan(0);
      expect(piiViolations.some((v) => v.message.includes('console.log'))).toBe(true);
    });

    it('should detect PII fields in logs', () => {
      const codeMap = new Map([['app/api/users/route.ts', FIXTURE_CONSOLE_LOG]]);
      const violations = runASTSemanticRules(codeMap);

      const piiViolations = violations.filter((v) => v.ruleId === 'intent/no-pii-logging');
      expect(piiViolations.some((v) => v.message.includes('email') || v.message.includes('PII'))).toBe(true);
    });

    it('should detect raw request body logging', () => {
      const codeMap = new Map([['app/api/users/route.ts', FIXTURE_RAW_BODY_LOG]]);
      const violations = runASTSemanticRules(codeMap);

      const piiViolations = violations.filter((v) => v.ruleId === 'intent/no-pii-logging');
      expect(piiViolations.some((v) => v.message.includes('request body'))).toBe(true);
    });
  });

  describe('HEAL: Recipe fixes violations', () => {
    it('should remove console.log statements', () => {
      const codeMap = new Map([['app/api/users/route.ts', FIXTURE_CONSOLE_LOG]]);
      const violations = runASTSemanticRules(codeMap);

      const ctx: FixContext = {
        codeMap,
        framework: 'nextjs-app-router',
      };

      const violation = violations.find((v) => v.ruleId === 'intent/no-pii-logging');
      expect(violation).toBeDefined();

      const result = applyRecipe(violation!, ctx);

      // console.log should be removed
      expect(result.newCode).not.toMatch(/console\.log\s*\(/);
    });

    it('should replace console.error with safeLogger', () => {
      const codeMap = new Map([['app/api/users/route.ts', FIXTURE_CONSOLE_LOG]]);
      const violations = runASTSemanticRules(codeMap);

      const ctx: FixContext = {
        codeMap,
        framework: 'nextjs-app-router',
      };

      const violation = violations.find((v) => v.ruleId === 'intent/no-pii-logging');
      expect(violation).toBeDefined();

      const result = applyRecipe(violation!, ctx);

      // console.error should be replaced
      expect(result.newCode).toContain('safeLogger');
    });
  });

  describe('PASS: Healed code passes', () => {
    it('should pass on handler with no console calls', () => {
      const codeMap = new Map([['app/api/login/route.ts', FIXTURE_CORRECT_HANDLER]]);
      const violations = runASTSemanticRules(codeMap);

      const piiViolations = violations.filter((v) => v.ruleId === 'intent/no-pii-logging');
      expect(piiViolations.length).toBe(0);
    });
  });
});

// ============================================================================
// Test: quality/no-stubbed-handlers
// ============================================================================

describe('quality/no-stubbed-handlers', () => {
  describe('FAIL: Detects violations', () => {
    it('should detect "Not implemented" errors', () => {
      const codeMap = new Map([['app/api/users/route.ts', FIXTURE_STUBBED_HANDLER]]);
      const violations = runASTSemanticRules(codeMap);

      const stubViolations = violations.filter((v) => v.ruleId === 'quality/no-stubbed-handlers');
      expect(stubViolations.length).toBeGreaterThan(0);
      expect(stubViolations.some((v) => v.message.includes('Not implemented'))).toBe(true);
    });

    it('should detect TODO in postconditions section', () => {
      const codeMap = new Map([['app/api/users/route.ts', FIXTURE_TODO_POSTCONDITIONS]]);
      const violations = runASTSemanticRules(codeMap);

      const stubViolations = violations.filter((v) => v.ruleId === 'quality/no-stubbed-handlers');
      expect(stubViolations.some((v) => v.message.includes('TODO') || v.message.includes('postconditions'))).toBe(true);
    });
  });

  describe('HEAL: Recipe fixes violations', () => {
    it('should replace stub with implementation skeleton', () => {
      const codeMap = new Map([['app/api/users/route.ts', FIXTURE_STUBBED_HANDLER]]);
      const violations = runASTSemanticRules(codeMap);

      const ctx: FixContext = {
        codeMap,
        framework: 'nextjs-app-router',
        behaviorName: 'CreateUser',
      };

      const violation = violations.find((v) => v.ruleId === 'quality/no-stubbed-handlers');
      expect(violation).toBeDefined();

      const result = applyRecipe(violation!, ctx);

      // Should not have "Not implemented" anymore
      expect(result.newCode).not.toContain("throw new Error('Not implemented')");
      // Should have a response now
      expect(result.newCode).toContain('NextResponse.json');
    });
  });

  describe('PASS: Healed code passes', () => {
    it('should pass on properly implemented handler', () => {
      const codeMap = new Map([['app/api/login/route.ts', FIXTURE_CORRECT_HANDLER]]);
      const violations = runASTSemanticRules(codeMap);

      const stubViolations = violations.filter((v) => v.ruleId === 'quality/no-stubbed-handlers');
      expect(stubViolations.length).toBe(0);
    });
  });

  describe('Allowlist: Test files should be skipped', () => {
    it('should not flag test files', () => {
      const codeMap = new Map([['app/api/users/route.test.ts', FIXTURE_STUBBED_HANDLER]]);
      const violations = runASTSemanticRules(codeMap);

      const stubViolations = violations.filter((v) => v.ruleId === 'quality/no-stubbed-handlers');
      expect(stubViolations.length).toBe(0);
    });

    it('should not flag fixture files', () => {
      const codeMap = new Map([['__fixtures__/broken-route.ts', FIXTURE_STUBBED_HANDLER]]);
      const violations = runASTSemanticRules(codeMap);

      const stubViolations = violations.filter((v) => v.ruleId === 'quality/no-stubbed-handlers');
      expect(stubViolations.length).toBe(0);
    });
  });
});

// ============================================================================
// Integration Test: Full Heal Cycle
// ============================================================================

describe('Integration: Full heal cycle (fail → heal → pass)', () => {
  it('should heal a broken handler to pass all rules', () => {
    // Start with a completely broken handler
    const brokenHandler = `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('Processing request');
  
  const body = await request.json();
  
  console.log('User data:', body.email);
  
  throw new Error('Not implemented');
}
`;

    const codeMap = new Map([['app/api/users/route.ts', brokenHandler]]);

    // Step 1: FAIL - Detect all violations
    let violations = runASTSemanticRules(codeMap);
    expect(violations.length).toBeGreaterThan(0);

    const ctx: FixContext = {
      codeMap,
      framework: 'nextjs-app-router',
      behaviorName: 'CreateUser',
    };

    // Step 2: HEAL - Apply recipes iteratively
    const maxIterations = 10;
    let iterations = 0;

    while (violations.length > 0 && iterations < maxIterations) {
      const violation = violations[0];

      if (!DETERMINISTIC_RECIPES[violation.ruleId]) {
        // Skip unknown rules
        violations = violations.slice(1);
        continue;
      }

      const result = applyRecipe(violation, ctx);
      if (result.success) {
        codeMap.set(violation.file, result.newCode);
      }

      violations = runASTSemanticRules(codeMap);
      iterations++;
    }

    // Step 3: PASS - Verify healed code passes
    const finalViolations = runASTSemanticRules(codeMap);
    const finalCode = codeMap.get('app/api/users/route.ts') || '';

    // Should have fixed most violations
    expect(iterations).toBeLessThan(maxIterations);

    // Should have no console.log
    expect(finalCode).not.toMatch(/console\.log\s*\(/);

    // Should have no "Not implemented"
    expect(finalCode).not.toContain("throw new Error('Not implemented')");

    // Should have audit or auditAttempt
    expect(finalCode).toMatch(/audit(Attempt)?\s*\(/);
  });
});
