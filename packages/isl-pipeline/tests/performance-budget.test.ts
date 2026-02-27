/**
 * Performance Budget Tests
 * 
 * These tests ensure that critical operations stay within performance budgets.
 * Run in CI to prevent performance regressions.
 * 
 * @module @isl-lang/isl-pipeline/tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { parseISL } from '@isl-lang/isl-core';
import { runSemanticRules } from '../src/semantic-rules.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Performance Budgets (in milliseconds)
// ============================================================================

const BUDGETS = {
  // Parse budgets
  parse: {
    small: 50,      // < 100 lines
    medium: 200,    // 100-500 lines
    large: 1000,    // 500+ lines
  },
  // Semantic rule check budgets
  semanticCheck: {
    singleFile: 50,
    multiFile: 200,
  },
  // Memory budgets (MB)
  memory: {
    parse: 50,
    semanticCheck: 100,
  },
};

// ============================================================================
// Test Fixtures
// ============================================================================

const FIXTURES_DIR = path.join(__dirname, '../../../test-fixtures');

function loadFixture(relativePath: string): string | null {
  const fullPath = path.join(FIXTURES_DIR, relativePath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf-8');
  }
  return null;
}

function measurePerformance(fn: () => void, iterations = 5): { avg: number; min: number; max: number } {
  // Warmup
  for (let i = 0; i < 3; i++) {
    fn();
  }

  // Measure
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  return {
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
  };
}

// ============================================================================
// Parse Performance Tests
// ============================================================================

describe('Parse Performance Budget', () => {
  it('should parse minimal spec within budget', () => {
    const content = loadFixture('valid/minimal.isl');
    if (!content) {
      console.warn('Fixture not found: valid/minimal.isl');
      return;
    }

    const result = measurePerformance(() => {
      parseISL(content, 'minimal.isl');
    });

    console.log(`Parse minimal: avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    expect(result.avg).toBeLessThan(BUDGETS.parse.small);
  });

  it('should parse complex-types spec within budget', () => {
    const content = loadFixture('valid/complex-types.isl');
    if (!content) {
      console.warn('Fixture not found: valid/complex-types.isl');
      return;
    }

    const result = measurePerformance(() => {
      parseISL(content, 'complex-types.isl');
    });

    console.log(`Parse complex-types: avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    expect(result.avg).toBeLessThan(BUDGETS.parse.medium);
  });

  it('should parse all-features spec within budget', () => {
    const content = loadFixture('valid/all-features.isl');
    if (!content) {
      console.warn('Fixture not found: valid/all-features.isl');
      return;
    }

    const result = measurePerformance(() => {
      parseISL(content, 'all-features.isl');
    });

    console.log(`Parse all-features: avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    expect(result.avg).toBeLessThan(BUDGETS.parse.medium);
  });

  it('should parse real-world auth spec within budget', () => {
    const content = loadFixture('valid/real-world/auth.isl');
    if (!content) {
      console.warn('Fixture not found: valid/real-world/auth.isl');
      return;
    }

    const result = measurePerformance(() => {
      parseISL(content, 'auth.isl');
    });

    console.log(`Parse auth.isl: avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    expect(result.avg).toBeLessThan(BUDGETS.parse.medium);
  });

  it('should parse real-world payment spec within budget', () => {
    const content = loadFixture('valid/real-world/payment.isl');
    if (!content) {
      console.warn('Fixture not found: valid/real-world/payment.isl');
      return;
    }

    const result = measurePerformance(() => {
      parseISL(content, 'payment.isl');
    });

    console.log(`Parse payment.isl: avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    expect(result.avg).toBeLessThan(BUDGETS.parse.medium);
  });
});

// ============================================================================
// Semantic Rule Performance Tests
// ============================================================================

describe('Semantic Rule Performance Budget', () => {
  it('should check single file within budget', () => {
    const code = `
export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id");
  
  if (isRateLimited()) {
    await auditAttempt({ action: "login", success: false, reason: "rate_limited", timestamp: Date.now(), requestId });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  
  const body = await req.json();
  if (!body.email) {
    await auditAttempt({ action: "login", success: false, reason: "validation_failed", timestamp: Date.now(), requestId });
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  
  const user = await authenticate(body);
  await auditAttempt({ action: "login", success: true, timestamp: Date.now(), requestId });
  return NextResponse.json({ user });
}`;

    const codeMap = new Map([['api/login/route.ts', code]]);

    const result = measurePerformance(() => {
      runSemanticRules(codeMap);
    });

    console.log(`Semantic check (1 file): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    expect(result.avg).toBeLessThan(BUDGETS.semanticCheck.singleFile);
  });

  it('should check multiple files within budget', () => {
    const baseCode = `
export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id");
  await auditAttempt({ action: "test", success: true, timestamp: Date.now(), requestId });
  return NextResponse.json({ ok: true });
}`;

    // Create 10 files
    const codeMap = new Map<string, string>();
    for (let i = 0; i < 10; i++) {
      codeMap.set(`api/route-${i}/route.ts`, baseCode);
    }

    const result = measurePerformance(() => {
      runSemanticRules(codeMap);
    });

    console.log(`Semantic check (10 files): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    expect(result.avg).toBeLessThan(BUDGETS.semanticCheck.multiFile);
  });
});

// ============================================================================
// Memory Performance Tests
// ============================================================================

describe('Memory Budget', () => {
  it('should not exceed memory budget during parse', () => {
    const content = loadFixture('valid/all-features.isl');
    if (!content) {
      console.warn('Fixture not found: valid/all-features.isl');
      return;
    }

    const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    
    // Parse multiple times to stress test
    for (let i = 0; i < 100; i++) {
      parseISL(content, 'all-features.isl');
    }
    
    // Force GC if available
    if (global.gc) {
      global.gc();
    }
    
    const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
    const memUsed = memAfter - memBefore;
    
    console.log(`Memory used during parse: ${memUsed.toFixed(2)}MB`);
    // Allow some tolerance - this is a soft budget
    expect(memUsed).toBeLessThan(BUDGETS.memory.parse * 2);
  });
});

// ============================================================================
// Regression Detection Tests
// ============================================================================

describe('Regression Detection', () => {
  it('should detect performance regression in parse', () => {
    // This test documents the baseline - update if intentionally changed
    const content = `
domain TestPerf {
  version: "1.0.0"
  
  type Email = String { format: "email" }
  
  entity User {
    id: UUID [immutable]
    email: Email
  }
  
  behavior CreateUser {
    input { email: String }
    output { success: User }
  }
}`;

    const result = measurePerformance(() => {
      parseISL(content, 'test.isl');
    }, 10);

    console.log(`Baseline parse: avg=${result.avg.toFixed(2)}ms`);
    
    // Baseline assertion - this should be updated if parser is optimized
    // Current baseline: < 20ms for a simple spec
    expect(result.avg).toBeLessThan(20);
  });

  it('should detect performance regression in semantic rules', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ action: "test", success: true, timestamp: Date.now() });
  return NextResponse.json({ ok: true });
}`;

    const codeMap = new Map([['api/route.ts', code]]);

    const result = measurePerformance(() => {
      runSemanticRules(codeMap);
    }, 10);

    console.log(`Baseline semantic: avg=${result.avg.toFixed(2)}ms`);
    
    // Baseline assertion - update if rules are optimized
    // Current baseline: < 30ms for a simple file
    expect(result.avg).toBeLessThan(30);
  });
});
