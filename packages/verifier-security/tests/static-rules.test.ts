/**
 * Static Security Rules Tests
 * 
 * Tests for static analysis of token generation code.
 * Covers both secure (passing) and insecure (failing) patterns.
 */

import { describe, it, expect } from 'vitest';
import {
  runSecurityRules,
  runSecurityRule,
  isTokenGenerationSecure,
  SECURITY_RULES,
} from '../src/static-rules.js';
import {
  checkTokenSource,
  APPROVED_TOKEN_SOURCES,
  INSECURE_PATTERNS,
} from '../src/approved-sources.js';

// ============================================================================
// SECURE TOKEN GENERATORS (SHOULD PASS)
// ============================================================================

describe('Secure Token Generators (Should Pass)', () => {
  describe('crypto.randomBytes', () => {
    it('should approve crypto.randomBytes(32) for 256-bit entropy', () => {
      const code = `
        import crypto from 'crypto';
        
        function generateSessionToken() {
          const token = crypto.randomBytes(32).toString('hex');
          return token;
        }
      `;
      
      const result = checkTokenSource(code, 256);
      expect(result.approved).toBe(true);
      expect(result.sourceName).toBe('Node.js crypto.randomBytes');
    });

    it('should approve crypto.randomBytes(64) for extra entropy', () => {
      const code = `
        const sessionToken = crypto.randomBytes(64).toString('hex');
      `;
      
      const result = checkTokenSource(code, 256);
      expect(result.approved).toBe(true);
      expect(result.byteLength).toBe(64);
    });

    it('should pass static rules for secure token generation', () => {
      const code = `
        import crypto from 'crypto';
        
        export function createAuthToken(): string {
          const token = crypto.randomBytes(32).toString('hex');
          if (token.length < 64) {
            throw new Error('Insufficient token entropy');
          }
          return token;
        }
      `;
      
      const result = isTokenGenerationSecure(code, 'auth-service.ts');
      expect(result.secure).toBe(true);
      expect(result.violations.length).toBe(0);
    });
  });

  describe('Web Crypto API', () => {
    it('should approve crypto.getRandomValues with 32 bytes', () => {
      const code = `
        function generateToken() {
          const array = crypto.getRandomValues(new Uint8Array(32));
          return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
        }
      `;
      
      const result = checkTokenSource(code, 256);
      expect(result.approved).toBe(true);
      expect(result.sourceName).toBe('Web Crypto getRandomValues');
    });
  });

  describe('nanoid', () => {
    it('should approve nanoid with 43+ characters', () => {
      const code = `
        import { nanoid } from 'nanoid';
        const sessionToken = nanoid(43);
      `;
      
      const result = checkTokenSource(code, 256);
      expect(result.approved).toBe(true);
    });

    it('should approve customAlphabet with sufficient length', () => {
      const code = `
        import { customAlphabet } from 'nanoid';
        const generate = customAlphabet('0123456789abcdef', 64);
        const token = generate(64);
      `;
      
      const result = checkTokenSource(code, 256);
      expect(result.approved).toBe(true);
    });
  });
});

// ============================================================================
// INSECURE TOKEN GENERATORS (SHOULD FAIL)
// ============================================================================

describe('Insecure Token Generators (Should Fail)', () => {
  describe('Math.random', () => {
    it('should reject Math.random() for token generation', () => {
      const code = `
        function generateToken() {
          return Math.random().toString(36).substring(2);
        }
        const sessionToken = generateToken();
      `;
      
      const result = checkTokenSource(code, 256);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('INSECURE');
      expect(result.reason).toContain('Math.random');
    });

    it('should fail static rules for Math.random token', () => {
      const code = `
        const token = Math.random().toString(36).slice(2);
      `;
      
      const codeMap = new Map([['token-gen.ts', code]]);
      const violations = runSecurityRules(codeMap);
      
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.severity === 'critical')).toBe(true);
    });
  });

  describe('Date.now', () => {
    it('should reject Date.now() for session tokens', () => {
      const code = `
        const sessionToken = Date.now().toString() + '_user123';
      `;
      
      const result = checkTokenSource(code, 256);
      expect(result.approved).toBe(false);
    });
  });

  describe('Insufficient entropy', () => {
    it('should reject crypto.randomBytes(16) for 256-bit requirement', () => {
      const code = `
        const token = crypto.randomBytes(16).toString('hex');
      `;
      
      const result = checkTokenSource(code, 256);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('Insufficient entropy');
      expect(result.byteLength).toBe(16);
    });

    it('should fail static rules for short tokens', () => {
      const code = `
        import crypto from 'crypto';
        const sessionToken = crypto.randomBytes(8).toString('hex');
      `;
      
      const codeMap = new Map([['short-token.ts', code]]);
      const violations = runSecurityRules(codeMap);
      
      const lengthViolation = violations.find(v => 
        v.ruleId === 'security/token-min-length'
      );
      expect(lengthViolation).toBeDefined();
      expect(lengthViolation?.severity).toBe('critical');
    });

    it('should reject UUID v4 alone for 256-bit entropy', () => {
      const code = `
        import { v4 as uuidv4 } from 'uuid';
        const sessionToken = uuidv4();
      `;
      
      const result = checkTokenSource(code, 256);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('122 bits');
    });

    it('should reject nanoid with insufficient length', () => {
      const code = `
        import { nanoid } from 'nanoid';
        const token = nanoid(21); // Default length
      `;
      
      const codeMap = new Map([['short-nanoid.ts', code]]);
      const violations = runSecurityRules(codeMap);
      
      const entropyViolation = violations.find(v =>
        v.message.includes('nanoid') && v.message.includes('bits')
      );
      expect(entropyViolation).toBeDefined();
    });
  });

  describe('Hardcoded tokens', () => {
    it('should reject hardcoded session tokens', () => {
      const code = `
        const sessionToken = 'abc123def456';
      `;
      
      const result = checkTokenSource(code, 256);
      expect(result.approved).toBe(false);
    });

    it('should fail static rules for hardcoded short tokens', () => {
      const code = `
        const token = 'shorttoken123';
      `;
      
      const codeMap = new Map([['hardcoded.ts', code]]);
      const violations = runSecurityRules(codeMap);
      
      expect(violations.some(v => 
        v.message.includes('Hardcoded') || v.message.includes('too short')
      )).toBe(true);
    });
  });

  describe('No crypto source detected', () => {
    it('should fail when no cryptographic source is used', () => {
      const code = `
        function generateSessionToken(userId: string) {
          return userId + '_' + Date.now();
        }
      `;
      
      const codeMap = new Map([['no-crypto.ts', code]]);
      const violations = runSecurityRules(codeMap);
      
      expect(violations.some(v => 
        v.message.includes('No cryptographic source')
      )).toBe(true);
    });
  });
});

// ============================================================================
// RULE COVERAGE TESTS
// ============================================================================

describe('Security Rule Coverage', () => {
  it('should have all expected rules', () => {
    const ruleIds = SECURITY_RULES.map(r => r.id);
    
    expect(ruleIds).toContain('security/token-approved-source');
    expect(ruleIds).toContain('security/token-min-length');
    expect(ruleIds).toContain('security/token-entropy-validation');
  });

  it('should skip test files', () => {
    const code = `
      const token = Math.random().toString(); // Would normally fail
    `;
    
    const codeMap = new Map([['token.test.ts', code]]);
    const violations = runSecurityRules(codeMap);
    
    expect(violations.length).toBe(0);
  });

  it('should skip fixture files', () => {
    const code = `
      const mockToken = 'fake-token-for-testing';
    `;
    
    const codeMap = new Map([['__fixtures__/tokens.ts', code]]);
    const violations = runSecurityRules(codeMap);
    
    expect(violations.length).toBe(0);
  });
});

// ============================================================================
// APPROVED SOURCE DETECTION
// ============================================================================

describe('Approved Source Detection', () => {
  it('should detect all approved sources', () => {
    expect(APPROVED_TOKEN_SOURCES.length).toBeGreaterThan(5);
    
    const sourceNames = APPROVED_TOKEN_SOURCES.map(s => s.name);
    expect(sourceNames).toContain('Node.js crypto.randomBytes');
    expect(sourceNames).toContain('Web Crypto getRandomValues');
    expect(sourceNames).toContain('nanoid');
  });

  it('should detect all insecure patterns', () => {
    expect(INSECURE_PATTERNS.length).toBeGreaterThan(3);
    
    const patternNames = INSECURE_PATTERNS.map(p => p.name);
    expect(patternNames).toContain('Math.random');
    expect(patternNames).toContain('Hardcoded token');
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty code', () => {
    const codeMap = new Map([['empty.ts', '']]);
    const violations = runSecurityRules(codeMap);
    
    expect(violations.length).toBe(0);
  });

  it('should handle code without token generation', () => {
    const code = `
      function add(a: number, b: number): number {
        return a + b;
      }
    `;
    
    const codeMap = new Map([['math.ts', code]]);
    const violations = runSecurityRules(codeMap);
    
    expect(violations.length).toBe(0);
  });

  it('should handle multiple violations in one file', () => {
    const code = `
      // Multiple issues
      const token1 = Math.random().toString();
      const token2 = crypto.randomBytes(8).toString('hex');
      const sessionToken = 'hardcoded';
    `;
    
    const codeMap = new Map([['multi-issues.ts', code]]);
    const violations = runSecurityRules(codeMap);
    
    expect(violations.length).toBeGreaterThan(1);
  });
});
