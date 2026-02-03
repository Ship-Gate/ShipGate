/**
 * Security Verifier Integration Tests
 * 
 * End-to-end tests combining static analysis and runtime verification.
 */

import { describe, it, expect } from 'vitest';
import {
  SecurityVerifier,
  createVerifier,
  verify,
  verifyFile,
  verifyStatic,
  verifyRuntime,
  verifySecurityClauses,
  create256BitEntropyClause,
  create64CharLengthClause,
  generateSafeReport,
} from '../src/verifier.js';
import type { SecurityTraceEvent } from '../src/types.js';

// ============================================================================
// SECURE IMPLEMENTATION TESTS (SHOULD PASS)
// ============================================================================

describe('Secure Implementation (Should Pass)', () => {
  const secureTokenCode = `
    import crypto from 'crypto';
    
    /**
     * Generate a secure session token with 256-bit entropy
     */
    export function generateSessionToken(): string {
      const token = crypto.randomBytes(32).toString('hex');
      
      // Validate token length
      if (token.length < 64) {
        throw new Error('Insufficient token entropy');
      }
      
      return token;
    }
    
    export function createSession(userId: string) {
      const sessionId = crypto.randomBytes(32).toString('hex');
      return {
        id: sessionId,
        userId,
        expiresAt: Date.now() + 3600000,
      };
    }
  `;

  it('should pass full verification for secure code', () => {
    const result = verifyFile(secureTokenCode, 'auth/session.ts');
    
    expect(result.success).toBe(true);
    expect(result.verdict).toBe('secure');
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.staticViolations.length).toBe(0);
  });

  it('should pass with secure trace events', () => {
    const codeMap = new Map([['session.ts', secureTokenCode]]);
    const traceEvents: SecurityTraceEvent[] = [
      {
        type: 'token_created',
        timestamp: Date.now(),
        tokenLength: 64,
        entropySource: 'crypto.randomBytes',
        metadata: {
          length: 64,
          byteLength: 32,
          encoding: 'hex',
          estimatedEntropyBits: 256,
          meetsLengthRequirement: true,
          meetsEntropyRequirement: true,
        },
      },
    ];

    const result = verify(codeMap, traceEvents);
    
    expect(result.success).toBe(true);
    expect(result.verdict).toBe('secure');
    expect(result.runtimeChecks.every(r => r.passed)).toBe(true);
  });

  it('should verify security clauses for 256-bit tokens', () => {
    const clauses = [
      create256BitEntropyClause(),
      create64CharLengthClause(),
    ];

    const results = verifySecurityClauses(clauses, {
      tokenLength: 64,
      encoding: 'hex',
    });

    expect(results.every(r => r.passed)).toBe(true);
  });
});

// ============================================================================
// INSECURE IMPLEMENTATION TESTS (SHOULD FAIL)
// ============================================================================

describe('Insecure Implementation (Should Fail)', () => {
  describe('Math.random Token Generator', () => {
    const insecureCode = `
      function generateToken() {
        // INSECURE: Math.random is not cryptographically secure
        return Math.random().toString(36).substring(2, 15);
      }
      
      const sessionToken = generateToken();
    `;

    it('should fail static analysis for Math.random', () => {
      const result = verifyFile(insecureCode, 'bad-auth.ts');
      
      expect(result.success).toBe(false);
      expect(result.verdict).toBe('insecure');
      expect(result.staticViolations.length).toBeGreaterThan(0);
      expect(result.staticViolations.some(v => 
        v.severity === 'critical' && v.message.includes('Math.random')
      )).toBe(true);
    });

    it('should have low score for Math.random usage', () => {
      const result = verifyFile(insecureCode, 'bad-auth.ts');
      
      expect(result.score).toBeLessThan(50);
    });
  });

  describe('Short Token Generator', () => {
    const shortTokenCode = `
      import crypto from 'crypto';
      
      // INSECURE: Only 64 bits of entropy
      const sessionToken = crypto.randomBytes(8).toString('hex');
    `;

    it('should fail for insufficient entropy', () => {
      const result = verifyFile(shortTokenCode, 'short-token.ts');
      
      expect(result.success).toBe(false);
      expect(result.staticViolations.some(v =>
        v.message.includes('Insufficient') || v.message.includes('bytes')
      )).toBe(true);
    });
  });

  describe('Hardcoded Token', () => {
    const hardcodedCode = `
      // INSECURE: Hardcoded token
      const sessionToken = 'abc123';
    `;

    it('should fail for hardcoded token', () => {
      const result = verifyFile(hardcodedCode, 'hardcoded.ts');
      
      expect(result.success).toBe(false);
      expect(result.staticViolations.some(v =>
        v.message.includes('Hardcoded') || v.message.includes('too short')
      )).toBe(true);
    });
  });

  describe('UUID v4 Only', () => {
    const uuidOnlyCode = `
      import { v4 as uuidv4 } from 'uuid';
      
      // INSECURE: UUID v4 only provides 122 bits
      const sessionToken = uuidv4();
    `;

    it('should fail for UUID v4 with 256-bit requirement', () => {
      const result = verifyFile(uuidOnlyCode, 'uuid-token.ts');
      
      // UUID v4 should be flagged as insufficient for 256-bit requirement
      expect(result.staticViolations.some(v =>
        v.message.includes('122 bits') || v.message.includes('UUID')
      )).toBe(true);
    });
  });

  describe('Runtime Trace Failures', () => {
    it('should fail for short runtime tokens', () => {
      const traceEvents: SecurityTraceEvent[] = [
        {
          type: 'token_created',
          timestamp: Date.now(),
          tokenLength: 16, // Too short!
          metadata: {
            length: 16,
            byteLength: 8,
            encoding: 'hex',
            estimatedEntropyBits: 64,
            meetsLengthRequirement: false,
            meetsEntropyRequirement: false,
          },
        },
      ];

      const results = verifyRuntime(traceEvents);
      
      expect(results.some(r => !r.passed)).toBe(true);
      expect(results.some(r => r.severity === 'critical')).toBe(true);
    });
  });
});

// ============================================================================
// VERIFIER CLASS TESTS
// ============================================================================

describe('SecurityVerifier Class', () => {
  it('should create verifier with default options', () => {
    const verifier = createVerifier();
    
    expect(verifier).toBeInstanceOf(SecurityVerifier);
  });

  it('should create verifier with custom config', () => {
    const verifier = createVerifier({
      config: {
        minTokenLength: 128,
        minEntropyBits: 512,
      },
    });

    const code = `
      const token = crypto.randomBytes(32).toString('hex');
    `;
    const violations = verifier.analyzeStatic(new Map([['test.ts', code]]));
    
    // With 128 min length, 64-char token should fail
    expect(violations.some(v => v.message.includes('Insufficient'))).toBe(true);
  });

  it('should run static analysis independently', () => {
    const code = `
      const token = Math.random().toString();
    `;

    const violations = verifyStatic(new Map([['test.ts', code]]));
    
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should run runtime verification independently', () => {
    const events: SecurityTraceEvent[] = [
      {
        type: 'token_created',
        timestamp: Date.now(),
        tokenLength: 64,
      },
    ];

    const results = verifyRuntime(events);
    
    expect(results.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// SAFE REPORT GENERATION
// ============================================================================

describe('Safe Report Generation', () => {
  it('should generate report without token values', () => {
    const secureCode = `
      import crypto from 'crypto';
      const token = crypto.randomBytes(32).toString('hex');
    `;

    const result = verifyFile(secureCode, 'secure.ts');
    const report = generateSafeReport(result);
    
    expect(report.tokenValuesLogged).toBe(false);
    expect(JSON.stringify(report)).not.toContain('sessionToken":');
    expect(report.success).toBe(result.success);
    expect(report.verdict).toBe(result.verdict);
  });

  it('should include coverage and timing info', () => {
    const code = `
      import crypto from 'crypto';
      const token = crypto.randomBytes(32).toString('hex');
    `;

    const result = verifyFile(code, 'test.ts');
    const report = generateSafeReport(result);
    
    expect(report).toHaveProperty('coverage');
    expect(report).toHaveProperty('timing');
    expect((report.staticAnalysis as Record<string, unknown>).violationCount).toBeDefined();
  });
});

// ============================================================================
// COVERAGE AND TIMING
// ============================================================================

describe('Coverage and Timing', () => {
  it('should report correct coverage', () => {
    const code = `
      import crypto from 'crypto';
      const token = crypto.randomBytes(32).toString('hex');
    `;

    const result = verifyFile(code, 'test.ts');
    
    expect(result.coverage.filesAnalyzed).toBe(1);
    expect(result.coverage.staticRules.total).toBeGreaterThan(0);
  });

  it('should report timing information', () => {
    const code = `
      import crypto from 'crypto';
      const token = crypto.randomBytes(32).toString('hex');
    `;

    const result = verifyFile(code, 'test.ts');
    
    expect(result.timing.total).toBeGreaterThan(0);
    expect(result.timing.staticAnalysis).toBeGreaterThan(0);
    expect(result.timing.runtimeVerification).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty code map', () => {
    const result = verify(new Map(), []);
    
    expect(result.success).toBe(true);
    expect(result.verdict).toBe('secure');
    expect(result.staticViolations.length).toBe(0);
  });

  it('should handle code without token generation', () => {
    const code = `
      function add(a: number, b: number): number {
        return a + b;
      }
    `;

    const result = verifyFile(code, 'math.ts');
    
    expect(result.success).toBe(true);
    expect(result.staticViolations.length).toBe(0);
  });

  it('should handle multiple files', () => {
    const codeMap = new Map([
      ['secure.ts', 'const token = crypto.randomBytes(32).toString("hex");'],
      ['insecure.ts', 'const token = Math.random().toString();'],
    ]);

    const result = verify(codeMap);
    
    expect(result.coverage.filesAnalyzed).toBe(2);
    expect(result.staticViolations.length).toBeGreaterThan(0);
  });
});
