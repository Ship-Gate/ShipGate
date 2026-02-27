/**
 * Tests for Next.js App Router Framework Adapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  detect,
  isRouteFile,
  locateHandlers,
  extractRoutePath,
  parseHandlers,
  findInjectionPoints,
  checkEnforcementOrder,
  generateRateLimitWrapper,
  generateAuditWrapper,
  generateValidationWrapper,
  createEarlyGuardPatch,
  createImportPatch,
  createBeforeReturnPatch,
  applyPatches,
  generateHandlerPatches,
  NextJSAppRouterAdapter,
  type HandlerLocation,
  type PatchPrimitive,
} from '../src/adapters/nextjs-app-router.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const SAMPLE_ROUTE_FILE = `
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const InputSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

export async function GET(request: NextRequest) {
  const items = await db.items.findMany();
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await db.items.create({ data: body });
  return NextResponse.json({ item: result }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  await db.items.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
`;

const ROUTE_WITH_RATE_LIMIT = `
import { NextRequest, NextResponse } from 'next/server';
import { ensureRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // @intent rate-limit-required
  const rateLimitResult = await ensureRateLimit(request);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }
  
  const body = await request.json();
  return NextResponse.json({ success: true });
}
`;

const ROUTE_WITH_WRONG_ORDER = `
import { NextRequest, NextResponse } from 'next/server';
import { ensureRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // @intent rate-limit-required
  const rateLimitResult = await ensureRateLimit(request);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }
  
  return NextResponse.json({ success: true });
}
`;

// ============================================================================
// Detection Tests
// ============================================================================

describe('Detection', () => {
  describe('isRouteFile', () => {
    it('should detect app router route files', () => {
      expect(isRouteFile('src/app/api/users/route.ts')).toBe(true);
      expect(isRouteFile('app/api/auth/login/route.ts')).toBe(true);
      expect(isRouteFile('src/app/dashboard/route.tsx')).toBe(true);
    });

    it('should reject non-route files', () => {
      expect(isRouteFile('src/app/api/users/index.ts')).toBe(false);
      expect(isRouteFile('src/pages/api/users.ts')).toBe(false);
      expect(isRouteFile('src/lib/utils.ts')).toBe(false);
    });
  });

  describe('extractRoutePath', () => {
    it('should extract route from app router paths', () => {
      expect(extractRoutePath('src/app/api/users/route.ts')).toBe('/users');
      expect(extractRoutePath('app/api/auth/login/route.ts')).toBe('/auth/login');
      expect(extractRoutePath('src/app/api/route.ts')).toBe('/');
    });

    it('should handle dynamic segments', () => {
      expect(extractRoutePath('src/app/api/users/[id]/route.ts')).toBe('/users/:id');
      expect(extractRoutePath('src/app/api/posts/[...slug]/route.ts')).toBe('/posts/*slug');
    });
  });
});

// ============================================================================
// Handler Location Tests
// ============================================================================

describe('Handler Location', () => {
  describe('parseHandlers', () => {
    it('should parse all HTTP method handlers', () => {
      const handlers = parseHandlers(SAMPLE_ROUTE_FILE);
      
      expect(handlers).toHaveLength(3);
      expect(handlers.map(h => h.name)).toEqual(['GET', 'POST', 'DELETE']);
    });

    it('should detect async handlers', () => {
      const handlers = parseHandlers(SAMPLE_ROUTE_FILE);
      
      handlers.forEach(h => {
        expect(h.isAsync).toBe(true);
      });
    });
  });

  describe('locateHandlers', () => {
    it('should return handler locations with line numbers', () => {
      const handlers = locateHandlers(SAMPLE_ROUTE_FILE, 'route.ts');
      
      expect(handlers).toHaveLength(3);
      expect(handlers[0].method).toBe('GET');
      expect(handlers[0].line).toBeGreaterThan(0);
      expect(handlers[0].endLine).toBeGreaterThan(handlers[0].line);
    });

    it('should include function signature', () => {
      const handlers = locateHandlers(SAMPLE_ROUTE_FILE, 'route.ts');
      
      expect(handlers[0].signature).toContain('export async function GET');
      expect(handlers[1].signature).toContain('export async function POST');
    });
  });
});

// ============================================================================
// Injection Points Tests
// ============================================================================

describe('Injection Points', () => {
  describe('findInjectionPoints', () => {
    it('should find early guard injection point', () => {
      const handlers = locateHandlers(SAMPLE_ROUTE_FILE, 'route.ts');
      const points = findInjectionPoints(SAMPLE_ROUTE_FILE, handlers[1]); // POST handler
      
      const earlyGuard = points.find(p => p.type === 'early-guard');
      expect(earlyGuard).toBeDefined();
    });

    it('should find validation injection point', () => {
      const handlers = locateHandlers(SAMPLE_ROUTE_FILE, 'route.ts');
      const points = findInjectionPoints(SAMPLE_ROUTE_FILE, handlers[1]); // POST has json()
      
      const validation = points.find(p => p.type === 'validation');
      expect(validation).toBeDefined();
      expect(validation?.existingCode).toContain('json()');
    });

    it('should find audit injection points before returns', () => {
      const handlers = locateHandlers(SAMPLE_ROUTE_FILE, 'route.ts');
      const points = findInjectionPoints(SAMPLE_ROUTE_FILE, handlers[0]); // GET handler
      
      const audit = points.find(p => p.type === 'audit');
      expect(audit).toBeDefined();
    });
  });
});

// ============================================================================
// Enforcement Order Tests
// ============================================================================

describe('Enforcement Order', () => {
  describe('checkEnforcementOrder', () => {
    it('should detect missing rate limit', () => {
      const handlers = locateHandlers(SAMPLE_ROUTE_FILE, 'route.ts');
      const violations = checkEnforcementOrder(SAMPLE_ROUTE_FILE, handlers[1]); // POST
      
      expect(violations.some(v => v.rule === 'missing-guard')).toBe(true);
    });

    it('should pass when rate limit is present', () => {
      const handlers = locateHandlers(ROUTE_WITH_RATE_LIMIT, 'route.ts');
      const violations = checkEnforcementOrder(ROUTE_WITH_RATE_LIMIT, handlers[0]);
      
      expect(violations.filter(v => v.rule === 'missing-guard')).toHaveLength(0);
    });

    it('should detect rate limit after json()', () => {
      const handlers = locateHandlers(ROUTE_WITH_WRONG_ORDER, 'route.ts');
      const violations = checkEnforcementOrder(ROUTE_WITH_WRONG_ORDER, handlers[0]);
      
      expect(violations.some(v => v.rule === 'rate-limit-order')).toBe(true);
      expect(violations.find(v => v.rule === 'rate-limit-order')?.message).toContain('AFTER');
    });
  });
});

// ============================================================================
// Code Generation Tests
// ============================================================================

describe('Code Generation', () => {
  describe('generateRateLimitWrapper', () => {
    it('should generate rate limit code with intent comment', () => {
      const code = generateRateLimitWrapper();
      
      expect(code).toContain('@intent rate-limit-required');
      expect(code).toContain('ensureRateLimit');
      expect(code).toContain('status: 429');
    });

    it('should support custom config', () => {
      const code = generateRateLimitWrapper({
        rateLimitConfig: { limit: 50, windowMs: 30000 },
      });
      
      expect(code).toContain('limit: 50');
      expect(code).toContain('windowMs: 30000');
    });
  });

  describe('generateAuditWrapper', () => {
    it('should generate audit code with intent comment', () => {
      const code = generateAuditWrapper({ auditConfig: { action: 'create-user' } });
      
      expect(code).toContain('@intent audit-required');
      expect(code).toContain('ensureAudit');
      expect(code).toContain("'create-user'");
    });
  });

  describe('generateValidationWrapper', () => {
    it('should generate validation code with safeParse', () => {
      const code = generateValidationWrapper();
      
      expect(code).toContain('@intent input-validation');
      expect(code).toContain('safeParse');
      expect(code).toContain('status: 400');
    });

    it('should use custom schema name', () => {
      const code = generateValidationWrapper({ validationSchema: 'UserSchema' });
      
      expect(code).toContain('UserSchema.safeParse');
    });
  });
});

// ============================================================================
// Patch Primitive Tests
// ============================================================================

describe('Patch Primitives', () => {
  describe('createEarlyGuardPatch', () => {
    it('should create insert patch at function start', () => {
      const handlers = locateHandlers(SAMPLE_ROUTE_FILE, 'route.ts');
      const patch = createEarlyGuardPatch(
        SAMPLE_ROUTE_FILE,
        handlers[0],
        '/* guard */'
      );
      
      expect(patch.type).toBe('insert');
      expect(patch.content).toBe('/* guard */');
      expect(patch.description).toContain('GET');
    });
  });

  describe('createImportPatch', () => {
    it('should insert after last import', () => {
      const patch = createImportPatch(
        SAMPLE_ROUTE_FILE,
        "import { foo } from 'bar';"
      );
      
      expect(patch.type).toBe('insert');
      expect(patch.content).toContain("import { foo }");
    });
  });

  describe('applyPatches', () => {
    it('should apply insert patches correctly', () => {
      const content = 'abc';
      const patches: PatchPrimitive[] = [
        { type: 'insert', start: 1, content: 'X', description: 'test' },
      ];
      
      expect(applyPatches(content, patches)).toBe('aXbc');
    });

    it('should apply multiple patches from end to start', () => {
      const content = 'abcdef';
      const patches: PatchPrimitive[] = [
        { type: 'insert', start: 1, content: '1', description: 'first' },
        { type: 'insert', start: 4, content: '2', description: 'second' },
      ];
      
      const result = applyPatches(content, patches);
      expect(result).toBe('a1bcd2ef');
    });

    it('should handle replace patches', () => {
      const content = 'hello world';
      const patches: PatchPrimitive[] = [
        { type: 'replace', start: 0, end: 5, content: 'hi', description: 'test' },
      ];
      
      expect(applyPatches(content, patches)).toBe('hi world');
    });
  });
});

// ============================================================================
// Handler Patches Tests
// ============================================================================

describe('Handler Patches', () => {
  describe('generateHandlerPatches', () => {
    it('should generate rate limit patch when missing', () => {
      const handlers = locateHandlers(SAMPLE_ROUTE_FILE, 'route.ts');
      const patches = generateHandlerPatches(SAMPLE_ROUTE_FILE, handlers[1], {
        addRateLimit: true,
      });
      
      expect(patches.length).toBeGreaterThan(0);
      expect(patches.some(p => p.description.includes('rate limit'))).toBe(true);
    });

    it('should not duplicate existing rate limit', () => {
      const handlers = locateHandlers(ROUTE_WITH_RATE_LIMIT, 'route.ts');
      const patches = generateHandlerPatches(ROUTE_WITH_RATE_LIMIT, handlers[0], {
        addRateLimit: true,
      });
      
      expect(patches.filter(p => p.description.includes('rate limit'))).toHaveLength(0);
    });

    it('should generate multiple patches in correct order', () => {
      const handlers = locateHandlers(SAMPLE_ROUTE_FILE, 'route.ts');
      const patches = generateHandlerPatches(SAMPLE_ROUTE_FILE, handlers[1], {
        addRateLimit: true,
        addValidation: true,
        addAudit: true,
      });
      
      // At minimum we expect rate limit and validation patches
      expect(patches.length).toBeGreaterThanOrEqual(2);
      
      // Verify rate limit comes before validation (lower offset = earlier in file)
      const rateLimitPatch = patches.find(p => p.description.includes('rate limit'));
      const validationPatch = patches.find(p => p.description.includes('validation'));
      expect(rateLimitPatch).toBeDefined();
      expect(validationPatch).toBeDefined();
      if (rateLimitPatch && validationPatch) {
        expect(rateLimitPatch.start).toBeLessThanOrEqual(validationPatch.start);
      }
    });
  });
});

// ============================================================================
// Framework Adapter Interface Tests
// ============================================================================

describe('NextJSAppRouterAdapter', () => {
  it('should have correct name', () => {
    expect(NextJSAppRouterAdapter.name).toBe('nextjs-app-router');
  });

  it('should generate rate limit import', () => {
    const importStmt = NextJSAppRouterAdapter.getRateLimitImport();
    expect(importStmt).toContain('ensureRateLimit');
  });

  it('should generate audit import', () => {
    const importStmt = NextJSAppRouterAdapter.getAuditImport();
    expect(importStmt).toContain('ensureAudit');
  });

  it('should generate validation import', () => {
    const importStmt = NextJSAppRouterAdapter.getValidationImport();
    expect(importStmt).toContain('zod');
  });

  it('should generate intent anchors export', () => {
    const anchors = NextJSAppRouterAdapter.getIntentAnchorsExport([
      'rate-limit-required',
      'audit-required',
    ]);
    
    expect(anchors).toContain('__isl_intents');
    expect(anchors).toContain('"rate-limit-required"');
    expect(anchors).toContain('"audit-required"');
  });

  it('should generate error response', () => {
    const response = NextJSAppRouterAdapter.getErrorResponse(400, 'Bad request');
    
    expect(response).toContain('NextResponse.json');
    expect(response).toContain('status: 400');
    expect(response).toContain('Bad request');
  });
});
