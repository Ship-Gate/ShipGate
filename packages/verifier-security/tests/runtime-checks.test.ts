/**
 * Runtime Security Checks Tests
 * 
 * Tests for runtime verification of token entropy.
 * Verifies that checks work correctly WITHOUT logging actual tokens.
 */

import { describe, it, expect } from 'vitest';
import {
  verifyTokenLength,
  verifyTokenEntropy,
  verifyTraceEvent,
  verifyAllTraceEvents,
  createSafeMetadata,
  createTokenHashSync,
  calculateEntropyBits,
  evaluateSecurityClause,
  createStandardSecurityClauses,
  createSafeLogEntry,
  assertNoTokenValue,
} from '../src/runtime-checks.js';
import type { SecurityTraceEvent, SecurityClause } from '../src/types.js';

// ============================================================================
// TOKEN LENGTH VERIFICATION
// ============================================================================

describe('Token Length Verification', () => {
  describe('Passing Cases', () => {
    it('should pass for 64-char hex token', () => {
      const result = verifyTokenLength(64);
      
      expect(result.passed).toBe(true);
      expect(result.checkName).toBe('token-length');
      expect(result.metadata.meetsLengthRequirement).toBe(true);
    });

    it('should pass for longer tokens', () => {
      const result = verifyTokenLength(128);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('meets minimum');
    });

    it('should pass for custom minimum length', () => {
      const result = verifyTokenLength(32, 32);
      
      expect(result.passed).toBe(true);
    });
  });

  describe('Failing Cases', () => {
    it('should fail for 32-char token (default 64 required)', () => {
      const result = verifyTokenLength(32);
      
      expect(result.passed).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.reason).toContain('below minimum');
    });

    it('should fail for very short tokens', () => {
      const result = verifyTokenLength(8);
      
      expect(result.passed).toBe(false);
      expect(result.metadata.meetsLengthRequirement).toBe(false);
    });
  });
});

// ============================================================================
// TOKEN ENTROPY VERIFICATION
// ============================================================================

describe('Token Entropy Verification', () => {
  describe('Passing Cases', () => {
    it('should pass for 64-char hex token (256 bits)', () => {
      const result = verifyTokenEntropy(64, 'hex', 256);
      
      expect(result.passed).toBe(true);
      expect(result.checkName).toBe('token-entropy');
      expect(result.metadata.estimatedEntropyBits).toBe(256);
    });

    it('should pass for 43-char base64 token (258 bits)', () => {
      const result = verifyTokenEntropy(43, 'base64', 256);
      
      expect(result.passed).toBe(true);
      expect(result.metadata.estimatedEntropyBits).toBeGreaterThanOrEqual(256);
    });

    it('should pass for longer base64url tokens', () => {
      const result = verifyTokenEntropy(64, 'base64url', 256);
      
      expect(result.passed).toBe(true);
    });
  });

  describe('Failing Cases', () => {
    it('should fail for 32-char hex token (128 bits)', () => {
      const result = verifyTokenEntropy(32, 'hex', 256);
      
      expect(result.passed).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.metadata.estimatedEntropyBits).toBe(128);
    });

    it('should fail for short base64 tokens', () => {
      const result = verifyTokenEntropy(21, 'base64', 256);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('below minimum');
    });
  });
});

// ============================================================================
// ENTROPY CALCULATION
// ============================================================================

describe('Entropy Calculation', () => {
  it('should calculate hex entropy correctly', () => {
    expect(calculateEntropyBits(64, 'hex')).toBe(256);
    expect(calculateEntropyBits(32, 'hex')).toBe(128);
    expect(calculateEntropyBits(128, 'hex')).toBe(512);
  });

  it('should calculate base64 entropy correctly', () => {
    // 43 chars * 6 bits = 258 bits
    expect(calculateEntropyBits(43, 'base64')).toBe(258);
    // 32 chars * 6 bits = 192 bits
    expect(calculateEntropyBits(32, 'base64')).toBe(192);
  });

  it('should handle unknown encoding conservatively', () => {
    // Unknown assumes ~5.95 bits per char (alphanumeric)
    const entropy = calculateEntropyBits(64, 'unknown');
    expect(entropy).toBeGreaterThan(256); // 64 * 5.95 = 380.8
  });
});

// ============================================================================
// TRACE EVENT VERIFICATION
// ============================================================================

describe('Trace Event Verification', () => {
  describe('Passing Events', () => {
    it('should verify secure token creation event', () => {
      const event: SecurityTraceEvent = {
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
      };

      const results = verifyTraceEvent(event);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.passed)).toBe(true);
    });
  });

  describe('Failing Events', () => {
    it('should fail insecure token creation event', () => {
      const event: SecurityTraceEvent = {
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
      };

      const results = verifyTraceEvent(event);
      
      expect(results.some(r => !r.passed)).toBe(true);
    });
  });

  describe('Multiple Events', () => {
    it('should verify all token creation events', () => {
      const events: SecurityTraceEvent[] = [
        {
          type: 'token_created',
          timestamp: Date.now(),
          tokenLength: 64,
        },
        {
          type: 'token_used', // Not a creation event - should be skipped
          timestamp: Date.now(),
          tokenLength: 64,
        },
        {
          type: 'token_created',
          timestamp: Date.now(),
          tokenLength: 32, // This one fails
        },
      ];

      const results = verifyAllTraceEvents(events);
      
      // Should have results for both creation events
      expect(results.some(r => r.passed)).toBe(true);
      expect(results.some(r => !r.passed)).toBe(true);
    });
  });
});

// ============================================================================
// SAFE METADATA CREATION
// ============================================================================

describe('Safe Metadata Creation', () => {
  it('should create safe metadata without token value', () => {
    const metadata = createSafeMetadata(64, 32, 'hex');
    
    expect(metadata.length).toBe(64);
    expect(metadata.byteLength).toBe(32);
    expect(metadata.encoding).toBe('hex');
    expect(metadata.estimatedEntropyBits).toBe(256);
    expect(metadata.meetsLengthRequirement).toBe(true);
    expect(metadata.meetsEntropyRequirement).toBe(true);
    
    // Should NOT have actual token value
    expect(metadata).not.toHaveProperty('token');
    expect(metadata).not.toHaveProperty('value');
  });

  it('should include optional fields when provided', () => {
    const metadata = createSafeMetadata(
      64, 32, 'hex',
      Date.now(),
      Date.now() + 3600000,
      'req-123'
    );
    
    expect(metadata.createdAt).toBeDefined();
    expect(metadata.expiresAt).toBeDefined();
    expect(metadata.requestId).toBe('req-123');
  });
});

// ============================================================================
// TOKEN HASH CREATION
// ============================================================================

describe('Token Hash Creation', () => {
  it('should create consistent hash for same token', () => {
    const token = 'example-token-value';
    const hash1 = createTokenHashSync(token);
    const hash2 = createTokenHashSync(token);
    
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(8); // Truncated for safety
  });

  it('should create different hashes for different tokens', () => {
    const hash1 = createTokenHashSync('token-a');
    const hash2 = createTokenHashSync('token-b');
    
    expect(hash1).not.toBe(hash2);
  });

  it('should NOT be reversible', () => {
    const token = 'sensitive-token-value';
    const hash = createTokenHashSync(token);
    
    // Hash is truncated and one-way - cannot recover original
    expect(hash.length).toBe(8);
    expect(hash).not.toContain(token);
  });
});

// ============================================================================
// CLAUSE EVALUATION
// ============================================================================

describe('Security Clause Evaluation', () => {
  describe('Token Entropy Clause', () => {
    it('should pass 256-bit entropy clause', () => {
      const clause: SecurityClause = {
        id: 'entropy-256',
        type: 'token_entropy',
        expression: 'token.entropy >= 256',
        requiredValue: 256,
        unit: 'bits',
      };

      const result = evaluateSecurityClause(clause, { 
        tokenLength: 64, 
        encoding: 'hex' 
      });
      
      expect(result.passed).toBe(true);
      expect(result.actualValue).toBe(256);
    });

    it('should fail entropy clause for short token', () => {
      const clause: SecurityClause = {
        id: 'entropy-256',
        type: 'token_entropy',
        expression: 'token.entropy >= 256',
        requiredValue: 256,
        unit: 'bits',
      };

      const result = evaluateSecurityClause(clause, { 
        tokenLength: 32, 
        encoding: 'hex' 
      });
      
      expect(result.passed).toBe(false);
      expect(result.actualValue).toBe(128);
    });
  });

  describe('Token Length Clause', () => {
    it('should pass length clause', () => {
      const clause: SecurityClause = {
        id: 'length-64',
        type: 'token_length',
        expression: 'token.length >= 64',
        requiredValue: 64,
        unit: 'characters',
      };

      const result = evaluateSecurityClause(clause, { tokenLength: 64 });
      
      expect(result.passed).toBe(true);
    });

    it('should convert bytes to chars for length clause', () => {
      const clause: SecurityClause = {
        id: 'length-32-bytes',
        type: 'token_length',
        expression: 'token.byte_length >= 32',
        requiredValue: 32,
        unit: 'bytes',
      };

      // 32 bytes = 64 hex chars
      const result = evaluateSecurityClause(clause, { tokenLength: 64 });
      
      expect(result.passed).toBe(true);
    });
  });

  describe('Standard Clauses', () => {
    it('should create standard security clauses', () => {
      const clauses = createStandardSecurityClauses();
      
      expect(clauses.length).toBeGreaterThan(0);
      expect(clauses.some(c => c.type === 'token_entropy')).toBe(true);
      expect(clauses.some(c => c.type === 'token_length')).toBe(true);
    });
  });
});

// ============================================================================
// SAFE LOGGING
// ============================================================================

describe('Safe Logging', () => {
  describe('Safe Log Entry Creation', () => {
    it('should create log entry without token value', () => {
      const checkResult = verifyTokenLength(64);
      const logEntry = createSafeLogEntry(checkResult, 'req-123');
      
      expect(logEntry.check).toBe('token-length');
      expect(logEntry.passed).toBe(true);
      expect(logEntry.tokenValueLogged).toBe(false);
      expect(logEntry.requestId).toBe('req-123');
      
      // Should NOT contain actual token
      expect(logEntry).not.toHaveProperty('token');
      expect(JSON.stringify(logEntry)).not.toContain('sessionToken');
    });
  });

  describe('Token Value Assertion', () => {
    it('should not throw for safe objects', () => {
      const safeObj = {
        length: 64,
        encoding: 'hex',
        metadata: { bits: 256 },
      };

      expect(() => assertNoTokenValue(safeObj)).not.toThrow();
    });

    it('should throw if token value is present', () => {
      const unsafeObj = {
        token: 'actual-secret-token-value',
        length: 64,
      };

      expect(() => assertNoTokenValue(unsafeObj)).toThrow(/SECURITY/);
    });

    it('should throw for nested token values', () => {
      const unsafeObj = {
        user: {
          sessionToken: 'secret-value',
        },
      };

      expect(() => assertNoTokenValue(unsafeObj)).toThrow(/SECURITY/);
    });

    it('should allow empty token fields', () => {
      const safeObj = {
        token: '', // Empty is safe
        length: 64,
      };

      expect(() => assertNoTokenValue(safeObj)).not.toThrow();
    });
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle zero-length token', () => {
    const result = verifyTokenLength(0);
    
    expect(result.passed).toBe(false);
    expect(result.metadata.meetsLengthRequirement).toBe(false);
  });

  it('should handle missing evidence for clause evaluation', () => {
    const clause: SecurityClause = {
      id: 'test',
      type: 'token_entropy',
      expression: 'test',
      requiredValue: 256,
      unit: 'bits',
    };

    const result = evaluateSecurityClause(clause, {});
    
    expect(result.passed).toBe(false);
    expect(result.error).toBeDefined();
  });
});
