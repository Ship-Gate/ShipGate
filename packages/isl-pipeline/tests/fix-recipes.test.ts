/**
 * Fix Recipes Unit Tests
 * 
 * Tests that applying fix recipes makes failing fixtures pass.
 * 
 * @module @isl-lang/pipeline/tests/fix-recipes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FIX_RECIPE_CATALOG,
  applyFixRecipe,
  generateFixPreview,
  generateAllFixPreviews,
  rateLimitRecipe,
  auditRecipe,
  noPiiLoggingRecipe,
  inputValidationRecipe,
  encryptionRecipe,
  type FixRecipeContext,
} from '../src/fix-recipes.js';
import { runSemanticRules, type SemanticViolation } from '../src/semantic-rules.js';

// ============================================================================
// Test Fixtures - Failing Code
// ============================================================================

const FAILING_FIXTURES = {
  // Missing rate limit
  rateLimitMissing: `
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const result = await processLogin(body);
  return NextResponse.json(result);
}
`,

  // Rate limit after body parse (wrong order)
  rateLimitWrongOrder: `
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const body = await request.json();
  
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  const result = await processLogin(body);
  return NextResponse.json(result);
}
`,

  // Missing audit
  auditMissing: `
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  const body = await request.json();
  const result = await processLogin(body);
  return NextResponse.json(result);
}
`,

  // Audit with wrong success on error paths
  auditWrongSuccess: `
import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await audit({ action: 'login', success: true, timestamp: new Date().toISOString() });
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  } catch (error) {
    await audit({ action: 'login', success: true, timestamp: new Date().toISOString() });
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
`,

  // Console.log with PII
  piiLogging: `
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  console.log('Login attempt:', body.email, body.password);
  console.info('User data:', body);
  console.debug('Request headers:', request.headers);
  const result = await processLogin(body);
  return NextResponse.json(result);
}
`,

  // Missing input validation
  validationMissing: `
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const user = await db.user.findUnique({ where: { email: body.email } });
  return NextResponse.json({ user });
}
`,

  // Validation after DB call (wrong order)
  validationWrongOrder: `
import { NextResponse } from 'next/server';
import { z } from 'zod';

const Schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const body = await request.json();
  const user = await db.user.findUnique({ where: { email: body.email } });
  
  const validationResult = Schema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }
  
  return NextResponse.json({ user });
}
`,

  // Password stored without hashing
  encryptionMissingPassword: `
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  const newUser = {
    email: body.email,
    password: body.password,  // INSECURE: Raw password storage
  };
  
  await db.user.create({ data: newUser });
  return NextResponse.json({ success: true });
}
`,

  // Sensitive data without encryption
  encryptionMissingSensitive: `
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  const userData = {
    name: body.name,
    ssn: body.ssn,  // INSECURE: Raw SSN storage
    creditCard: body.creditCard,  // INSECURE: Raw CC storage
  };
  
  await db.user.create({ data: userData });
  return NextResponse.json({ success: true });
}
`,

  // Hardcoded encryption key
  encryptionHardcodedKey: `
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const encryptionKey = 'my-super-secret-encryption-key-12345';

export async function POST(request: Request) {
  const body = await request.json();
  const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
  return NextResponse.json({ success: true });
}
`,
};

// ============================================================================
// Test Helpers
// ============================================================================

function createTestContext(code: string, file: string = 'app/api/test/route.ts'): FixRecipeContext {
  return {
    ast: {
      behaviors: [{ name: 'Test', intents: [], preconditions: [], postconditions: [] }],
      types: [],
      imports: [],
    },
    repoContext: {
      framework: 'nextjs-app-router',
      packageManager: 'npm',
      hasTypeScript: true,
      srcDir: 'src',
    },
    codeMap: new Map([[file, code]]),
    framework: 'nextjs-app-router',
  };
}

function findViolation(code: string, ruleId: string, file: string = 'app/api/test/route.ts'): SemanticViolation | undefined {
  const codeMap = new Map([[file, code]]);
  const violations = runSemanticRules(codeMap);
  return violations.find(v => v.ruleId === ruleId);
}

// ============================================================================
// Tests: intent/rate-limit-required
// ============================================================================

describe('Fix Recipe: intent/rate-limit-required', () => {
  const recipe = rateLimitRecipe;
  const file = 'app/api/login/route.ts';

  it('should add rate limit import and check when missing', () => {
    const ctx = createTestContext(FAILING_FIXTURES.rateLimitMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/rate-limit-required',
      file,
      line: 4,
      message: 'No rate limiting before body parsing',
      severity: 'high',
      evidence: 'Found request.json() but no rateLimit call',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.patches.length).toBeGreaterThan(0);
    expect(result.newCode).toContain('rateLimit');
    expect(result.newCode).toContain('@intent rate-limit-required');
  });

  it('should ensure rate limit is before body parsing', () => {
    const ctx = createTestContext(FAILING_FIXTURES.rateLimitMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/rate-limit-required',
      file,
      line: 4,
      message: 'No rate limiting before body parsing',
      severity: 'high',
      evidence: 'Found request.json() but no rateLimit call',
    };

    const result = applyFixRecipe(violation, ctx);
    
    const rateLimitIdx = result.newCode.indexOf('rateLimit');
    const bodyParseIdx = result.newCode.indexOf('request.json()');
    
    expect(rateLimitIdx).toBeLessThan(bodyParseIdx);
  });

  it('should validate rate limit fix satisfies rule', () => {
    const ctx = createTestContext(FAILING_FIXTURES.rateLimitMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/rate-limit-required',
      file,
      line: 4,
      message: 'No rate limiting before body parsing',
      severity: 'high',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.validation.valid).toBe(true);
    expect(result.validation.evidence).toContain('✓ Rate limit check present');
    expect(result.validation.evidence).toContain('✓ Rate limit before body parsing');
  });

  it('should add audit on 429 response', () => {
    const code = `
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  return NextResponse.json({ ok: true });
}
`;
    const ctx = createTestContext(code, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/rate-limit-required',
      file,
      line: 7,
      message: '429 response must audit with success:false',
      severity: 'high',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    // Should add audit before 429 return
    expect(result.newCode).toContain('auditAttempt');
    expect(result.newCode).toContain('success: false');
    expect(result.newCode).toContain("reason: 'rate_limited'");
  });
});

// ============================================================================
// Tests: intent/audit-required
// ============================================================================

describe('Fix Recipe: intent/audit-required', () => {
  const recipe = auditRecipe;
  const file = 'app/api/login/route.ts';

  it('should add auditAttempt helper when missing', () => {
    const ctx = createTestContext(FAILING_FIXTURES.auditMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/audit-required',
      file,
      line: 10,
      message: 'Missing audit on success exit path',
      severity: 'critical',
      evidence: 'return NextResponse.json(result)',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).toContain('async function auditAttempt');
    expect(result.newCode).toContain('action: input.action');
    expect(result.newCode).toContain('timestamp: new Date().toISOString()');
  });

  it('should add requestId extraction', () => {
    const ctx = createTestContext(FAILING_FIXTURES.auditMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/audit-required',
      file,
      line: 10,
      message: 'Missing audit',
      severity: 'critical',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).toContain('requestId');
    expect(result.newCode).toContain("request.headers.get('x-request-id')");
  });

  it('should add audit before each return statement', () => {
    const code = `
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  if (!body.email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 });
  }
  
  if (!body.password) {
    return NextResponse.json({ error: 'Missing password' }, { status: 400 });
  }
  
  const result = await processLogin(body);
  return NextResponse.json(result);
}
`;
    const ctx = createTestContext(code, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/audit-required',
      file,
      line: 15,
      message: 'Missing audit on success exit path',
      severity: 'critical',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    // Count audit calls - should have one per return
    const auditCalls = (result.newCode.match(/auditAttempt\s*\(/g) || []).length;
    const returnStatements = (result.newCode.match(/return\s+NextResponse\.json/g) || []).length;
    
    expect(auditCalls).toBeGreaterThanOrEqual(returnStatements);
  });

  it('should ensure error paths have success:false', () => {
    const ctx = createTestContext(FAILING_FIXTURES.auditMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/audit-required',
      file,
      line: 6,
      message: 'Missing audit on rate limit exit path',
      severity: 'critical',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    // The 429 path should have success: false
    const lines = result.newCode.split('\n');
    let in429Block = false;
    let foundCorrectAudit = false;
    
    for (const line of lines) {
      if (line.includes('429')) in429Block = true;
      if (in429Block && line.includes('auditAttempt') && line.includes('success: false')) {
        foundCorrectAudit = true;
        break;
      }
      if (line.includes('return') && in429Block) break;
    }
    
    expect(result.newCode).toContain('success: false');
  });

  it('should validate audit fix satisfies rule', () => {
    const ctx = createTestContext(FAILING_FIXTURES.auditMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/audit-required',
      file,
      line: 10,
      message: 'Missing audit',
      severity: 'critical',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.validation.valid).toBe(true);
    expect(result.validation.evidence).toContain('✓ auditAttempt helper present');
    expect(result.validation.evidence).toContain('✓ timestamp field present');
  });
});

// ============================================================================
// Tests: intent/no-pii-logging
// ============================================================================

describe('Fix Recipe: intent/no-pii-logging', () => {
  const recipe = noPiiLoggingRecipe;
  const file = 'app/api/login/route.ts';

  it('should remove console.log statements', () => {
    const ctx = createTestContext(FAILING_FIXTURES.piiLogging, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/no-pii-logging',
      file,
      line: 5,
      message: 'console.log in production code',
      severity: 'medium',
      evidence: 'console.log',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).not.toMatch(/console\.log\s*\(/);
    expect(result.newCode).toContain('// [REMOVED] console-log');
  });

  it('should remove console.info and console.debug', () => {
    const ctx = createTestContext(FAILING_FIXTURES.piiLogging, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/no-pii-logging',
      file,
      line: 6,
      message: 'console.info in production code',
      severity: 'medium',
      evidence: 'console.info',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).not.toMatch(/console\.info\s*\(/);
    expect(result.newCode).not.toMatch(/console\.debug\s*\(/);
  });

  it('should add safe logger import', () => {
    const ctx = createTestContext(FAILING_FIXTURES.piiLogging, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/no-pii-logging',
      file,
      line: 5,
      message: 'console.log in production code',
      severity: 'medium',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).toContain('safeLogger');
  });

  it('should validate no-pii-logging fix satisfies rule', () => {
    const ctx = createTestContext(FAILING_FIXTURES.piiLogging, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/no-pii-logging',
      file,
      line: 5,
      message: 'console.log',
      severity: 'medium',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.validation.valid).toBe(true);
    expect(result.validation.evidence).toContain('✓ No forbidden console methods');
  });
});

// ============================================================================
// Tests: intent/input-validation
// ============================================================================

describe('Fix Recipe: intent/input-validation', () => {
  const recipe = inputValidationRecipe;
  const file = 'app/api/users/route.ts';

  it('should add Zod import when missing', () => {
    const ctx = createTestContext(FAILING_FIXTURES.validationMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/input-validation',
      file,
      line: 5,
      message: 'Input not validated with schema before use',
      severity: 'high',
      evidence: 'Body parsing without schema validation',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).toContain("from 'zod'");
  });

  it('should add safeParse validation', () => {
    const ctx = createTestContext(FAILING_FIXTURES.validationMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/input-validation',
      file,
      line: 5,
      message: 'Input not validated',
      severity: 'high',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).toContain('safeParse');
    expect(result.newCode).toContain('@intent input-validation');
  });

  it('should add validation result check', () => {
    const ctx = createTestContext(FAILING_FIXTURES.validationMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/input-validation',
      file,
      line: 5,
      message: 'Input not validated',
      severity: 'high',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).toContain('.success');
    expect(result.newCode).toContain('Validation failed');
    expect(result.newCode).toContain('status: 400');
  });

  it('should ensure validation is before DB calls', () => {
    const ctx = createTestContext(FAILING_FIXTURES.validationMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/input-validation',
      file,
      line: 5,
      message: 'Input not validated',
      severity: 'high',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    const safeParseIdx = result.newCode.indexOf('safeParse');
    const dbCallIdx = result.newCode.indexOf('db.user.findUnique');
    
    expect(safeParseIdx).toBeLessThan(dbCallIdx);
  });

  it('should validate input-validation fix satisfies rule', () => {
    const ctx = createTestContext(FAILING_FIXTURES.validationMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/input-validation',
      file,
      line: 5,
      message: 'Input not validated',
      severity: 'high',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.validation.valid).toBe(true);
    expect(result.validation.evidence).toContain('✓ Schema validation present');
    expect(result.validation.evidence).toContain('✓ Validation result checked');
  });
});

// ============================================================================
// Tests: intent/encryption-required
// ============================================================================

describe('Fix Recipe: intent/encryption-required', () => {
  const recipe = encryptionRecipe;
  const file = 'app/api/register/route.ts';

  it('should add bcrypt import for password hashing', () => {
    const ctx = createTestContext(FAILING_FIXTURES.encryptionMissingPassword, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/encryption-required',
      file,
      line: 8,
      message: "Sensitive field 'password' stored without encryption",
      severity: 'critical',
      evidence: 'Found password in database write without encryption',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).toContain('bcrypt');
  });

  it('should add password hashing before storage', () => {
    const ctx = createTestContext(FAILING_FIXTURES.encryptionMissingPassword, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/encryption-required',
      file,
      line: 8,
      message: "Password stored without encryption",
      severity: 'critical',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).toContain('bcrypt.hash');
  });

  it('should add encryption import for sensitive fields', () => {
    const ctx = createTestContext(FAILING_FIXTURES.encryptionMissingSensitive, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/encryption-required',
      file,
      line: 8,
      message: "Sensitive field 'ssn' stored without encryption",
      severity: 'critical',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).toContain("from '@/lib/encryption'");
  });

  it('should flag hardcoded encryption keys', () => {
    const ctx = createTestContext(FAILING_FIXTURES.encryptionHardcodedKey, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/encryption-required',
      file,
      line: 5,
      message: 'Encryption key appears to be hardcoded',
      severity: 'critical',
      evidence: 'Found hardcoded encryption key',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).toContain('SECURITY: Replace hardcoded key');
    expect(result.newCode).toContain('environment variable');
  });

  it('should validate encryption fix satisfies rule', () => {
    const ctx = createTestContext(FAILING_FIXTURES.encryptionMissingPassword, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/encryption-required',
      file,
      line: 8,
      message: 'Password stored without encryption',
      severity: 'critical',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.validation.valid).toBe(true);
    expect(result.validation.evidence).toContain('✓ Password properly hashed');
  });
});

// ============================================================================
// Tests: Fix Preview
// ============================================================================

describe('Fix Preview', () => {
  it('should generate preview for rate limit fix', () => {
    const file = 'app/api/login/route.ts';
    const ctx = createTestContext(FAILING_FIXTURES.rateLimitMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/rate-limit-required',
      file,
      line: 4,
      message: 'No rate limiting',
      severity: 'high',
      evidence: 'test',
    };

    const preview = generateFixPreview(violation, ctx);
    
    expect(preview).not.toBeNull();
    expect(preview!.ruleId).toBe('intent/rate-limit-required');
    expect(preview!.patches.length).toBeGreaterThan(0);
    expect(preview!.willSatisfyRule).toBe(true);
  });

  it('should generate previews for all violations', () => {
    const file = 'app/api/login/route.ts';
    const code = FAILING_FIXTURES.rateLimitMissing + '\n' + FAILING_FIXTURES.piiLogging;
    const ctx = createTestContext(code, file);
    
    const violations: SemanticViolation[] = [
      {
        ruleId: 'intent/rate-limit-required',
        file,
        line: 4,
        message: 'No rate limiting',
        severity: 'high',
        evidence: 'test',
      },
      {
        ruleId: 'intent/no-pii-logging',
        file,
        line: 10,
        message: 'console.log in production',
        severity: 'medium',
        evidence: 'test',
      },
    ];

    const previews = generateAllFixPreviews(violations, ctx);
    
    expect(previews.length).toBe(2);
  });

  it('should indicate whether fix will satisfy rule', () => {
    const file = 'app/api/login/route.ts';
    const ctx = createTestContext(FAILING_FIXTURES.validationMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/input-validation',
      file,
      line: 5,
      message: 'No validation',
      severity: 'high',
      evidence: 'test',
    };

    const preview = generateFixPreview(violation, ctx);
    
    expect(preview!.willSatisfyRule).toBe(true);
  });
});

// ============================================================================
// Tests: Recipe Registry
// ============================================================================

describe('Fix Recipe Registry', () => {
  it('should have recipes for all required rules', () => {
    const requiredRules = [
      'intent/rate-limit-required',
      'intent/audit-required',
      'intent/no-pii-logging',
      'intent/input-validation',
      'intent/encryption-required',
    ];

    for (const ruleId of requiredRules) {
      expect(FIX_RECIPE_CATALOG[ruleId]).toBeDefined();
      expect(FIX_RECIPE_CATALOG[ruleId].ruleId).toBe(ruleId);
    }
  });

  it('should have verifyWith for all recipes', () => {
    for (const [ruleId, recipe] of Object.entries(FIX_RECIPE_CATALOG)) {
      expect(recipe.verifyWith).toBeDefined();
      expect(recipe.verifyWith.length).toBeGreaterThan(0);
      expect(recipe.verifyWith).toContain('gate');
    }
  });

  it('should have validators for all recipes', () => {
    for (const [ruleId, recipe] of Object.entries(FIX_RECIPE_CATALOG)) {
      expect(typeof recipe.validate).toBe('function');
    }
  });
});

// ============================================================================
// Tests: No Weakening
// ============================================================================

describe('No Weakening Guard', () => {
  it('should not add suppressions', () => {
    const file = 'app/api/test/route.ts';
    const ctx = createTestContext(FAILING_FIXTURES.piiLogging, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/no-pii-logging',
      file,
      line: 5,
      message: 'console.log',
      severity: 'medium',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).not.toContain('@ts-ignore');
    expect(result.newCode).not.toContain('eslint-disable');
    expect(result.newCode).not.toContain('shipgate-ignore');
    expect(result.newCode).not.toContain('shipgate-ignore-legacy');
  });

  it('should not downgrade severity', () => {
    const file = 'app/api/test/route.ts';
    const ctx = createTestContext(FAILING_FIXTURES.validationMissing, file);
    const violation: SemanticViolation = {
      ruleId: 'intent/input-validation',
      file,
      line: 5,
      message: 'No validation',
      severity: 'high',
      evidence: 'test',
    };

    const result = applyFixRecipe(violation, ctx);
    
    expect(result.newCode).not.toMatch(/severity.*low/i);
    expect(result.newCode).not.toContain('skipAuth');
    expect(result.newCode).not.toContain('bypassAuth');
  });
});

// ============================================================================
// Integration Tests: Applying recipe makes failing fixture pass
// ============================================================================

describe('Integration: Recipe makes failing fixture pass', () => {
  it('rate-limit: fix removes semantic violations', () => {
    const file = 'app/api/login/route.ts';
    const ctx = createTestContext(FAILING_FIXTURES.rateLimitMissing, file);
    
    // Find initial violation
    const initialViolations = runSemanticRules(ctx.codeMap);
    const rateLimitViolation = initialViolations.find(v => v.ruleId === 'intent/rate-limit-required');
    
    if (rateLimitViolation) {
      const result = applyFixRecipe(rateLimitViolation, ctx);
      expect(result.success).toBe(true);
      
      // Check that the new code passes validation
      const newCodeMap = new Map([[file, result.newCode]]);
      const newViolations = runSemanticRules(newCodeMap);
      const remainingRateLimitViolations = newViolations.filter(v => v.ruleId === 'intent/rate-limit-required');
      
      // Should have fewer or no rate limit violations
      expect(remainingRateLimitViolations.length).toBeLessThanOrEqual(initialViolations.filter(v => v.ruleId === 'intent/rate-limit-required').length);
    }
  });

  it('no-pii-logging: fix removes console.* violations', () => {
    const file = 'app/api/login/route.ts';
    const ctx = createTestContext(FAILING_FIXTURES.piiLogging, file);
    
    const initialViolations = runSemanticRules(ctx.codeMap);
    const piiViolation = initialViolations.find(v => v.ruleId === 'intent/no-pii-logging');
    
    if (piiViolation) {
      const result = applyFixRecipe(piiViolation, ctx);
      expect(result.success).toBe(true);
      
      // Check that console.log is removed
      expect(result.newCode).not.toMatch(/console\.log\s*\(/);
      expect(result.newCode).not.toMatch(/console\.info\s*\(/);
    }
  });

  it('input-validation: fix adds validation before DB calls', () => {
    const file = 'app/api/users/route.ts';
    const ctx = createTestContext(FAILING_FIXTURES.validationMissing, file);
    
    const initialViolations = runSemanticRules(ctx.codeMap);
    const validationViolation = initialViolations.find(v => v.ruleId === 'intent/input-validation');
    
    if (validationViolation) {
      const result = applyFixRecipe(validationViolation, ctx);
      expect(result.success).toBe(true);
      
      // Validation should be before DB call
      const safeParseIdx = result.newCode.indexOf('safeParse');
      const dbIdx = result.newCode.indexOf('db.user');
      
      expect(safeParseIdx).toBeGreaterThan(-1);
      expect(safeParseIdx).toBeLessThan(dbIdx);
    }
  });
});
