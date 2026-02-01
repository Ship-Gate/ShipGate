// ============================================================================
// Tests for ISL Agent Verification
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  parseBindings,
  hasBindings,
  getBindingClauseIds,
  validateBindings,
  formatBindings,
} from '../parseBindings.js';

import {
  verify,
  verifyWithClauses,
  hasExplicitBindings,
  formatVerificationSummary,
  type SpecInfo,
} from '../verifier.js';

import type { ClauseResult, VerificationResult } from '../types.js';

// Get fixtures path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures');

// Load fixture files
const withBindingsSource = fs.readFileSync(
  path.join(fixturesDir, 'with-bindings.ts'),
  'utf-8'
);

const withoutBindingsSource = fs.readFileSync(
  path.join(fixturesDir, 'without-bindings.ts'),
  'utf-8'
);

// Test spec with clauses
const createUserSpec: SpecInfo = {
  specFile: 'auth/create-user.isl',
  clauses: [
    {
      id: 'CreateUser.pre.emailValid',
      type: 'precondition',
      expression: 'email.matches(/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/)',
      description: 'Email format validation',
    },
    {
      id: 'CreateUser.pre.emailUnique',
      type: 'precondition',
      expression: '!User.exists(email: input.email)',
      description: 'Email uniqueness check',
    },
    {
      id: 'CreateUser.post.userCreated',
      type: 'postcondition',
      expression: 'User.exists(id: result.id)',
      description: 'User creation verification',
    },
    {
      id: 'CreateUser.post.passwordHashed',
      type: 'postcondition',
      expression: 'result.passwordHash != input.password',
      description: 'Password hashing verification',
    },
    {
      id: 'CreateUser.inv.auditLog',
      type: 'invariant',
      expression: 'AuditLog.contains(event: "user_created")',
      description: 'Audit logging invariant',
    },
  ],
};

const createProductSpec: SpecInfo = {
  specFile: 'inventory/create-product.isl',
  clauses: [
    {
      id: 'CreateProduct.pre.nameRequired',
      type: 'precondition',
      expression: 'name.length > 0',
      description: 'Name required',
    },
    {
      id: 'CreateProduct.pre.pricePositive',
      type: 'precondition',
      expression: 'price > 0',
      description: 'Price positive',
    },
    {
      id: 'CreateProduct.post.productCreated',
      type: 'postcondition',
      expression: 'Product.exists(id: result.id)',
      description: 'Product created',
    },
  ],
};

// ============================================================================
// parseBindings Tests
// ============================================================================

describe('parseBindings', () => {
  it('should parse @isl-bindings block from source', () => {
    const bindings = parseBindings(withBindingsSource);
    
    expect(bindings).not.toBeNull();
    expect(bindings!.specFile).toBe('auth/create-user.isl');
    expect(bindings!.bindings.size).toBeGreaterThan(0);
  });

  it('should extract all clause IDs', () => {
    const bindings = parseBindings(withBindingsSource);
    const clauseIds = getBindingClauseIds(bindings!);
    
    expect(clauseIds).toContain('CreateUser.pre.emailValid');
    expect(clauseIds).toContain('CreateUser.pre.emailUnique');
    expect(clauseIds).toContain('CreateUser.post.userCreated');
    expect(clauseIds).toContain('CreateUser.post.passwordHashed');
    expect(clauseIds).toContain('CreateUser.inv.auditLog');
  });

  it('should parse binding types correctly', () => {
    const bindings = parseBindings(withBindingsSource);
    
    const emailValidBindings = bindings!.bindings.get('CreateUser.pre.emailValid');
    expect(emailValidBindings).toHaveLength(1);
    expect(emailValidBindings![0]!.type).toBe('guard');
    expect(emailValidBindings![0]!.location).toBe('validateEmail');
    
    const userCreatedBindings = bindings!.bindings.get('CreateUser.post.userCreated');
    expect(userCreatedBindings).toHaveLength(1);
    expect(userCreatedBindings![0]!.type).toBe('assert');
    expect(userCreatedBindings![0]!.location).toBe('L45-L48');
  });

  it('should return null for source without bindings', () => {
    const bindings = parseBindings(withoutBindingsSource);
    expect(bindings).toBeNull();
  });

  it('should validate bindings correctly', () => {
    const bindings = parseBindings(withBindingsSource);
    const validation = validateBindings(bindings!);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should format bindings for debugging', () => {
    const bindings = parseBindings(withBindingsSource);
    const formatted = formatBindings(bindings!);
    
    expect(formatted).toContain('@spec auth/create-user.isl');
    expect(formatted).toContain('CreateUser.pre.emailValid');
    expect(formatted).toContain('guard:validateEmail');
  });
});

describe('hasBindings', () => {
  it('should return true for source with bindings', () => {
    expect(hasBindings(withBindingsSource)).toBe(true);
  });

  it('should return false for source without bindings', () => {
    expect(hasBindings(withoutBindingsSource)).toBe(false);
  });
});

// ============================================================================
// Verifier Tests
// ============================================================================

describe('verify', () => {
  describe('with @isl-bindings', () => {
    let result: VerificationResult;

    beforeEach(() => {
      result = verify(withBindingsSource, createUserSpec);
    });

    it('should use bindings as primary evidence', () => {
      expect(result.hasBindings).toBe(true);
      expect(result.parsedBindings).not.toBeUndefined();
    });

    it('should return structured clauseResults', () => {
      expect(result.clauseResults).toHaveLength(createUserSpec.clauses.length);
      
      for (const clauseResult of result.clauseResults) {
        expect(clauseResult).toHaveProperty('clauseId');
        expect(clauseResult).toHaveProperty('status');
        expect(clauseResult).toHaveProperty('evidence');
        expect(clauseResult).toHaveProperty('notes');
        expect(['PASS', 'PARTIAL', 'FAIL']).toContain(clauseResult.status);
        expect(['bindings', 'heuristic']).toContain(clauseResult.evidence);
      }
    });

    it('should mark bound clauses with evidence = "bindings"', () => {
      const boundClauses = result.clauseResults.filter(
        r => r.evidence === 'bindings'
      );
      expect(boundClauses.length).toBeGreaterThan(0);
    });

    it('should PASS clauses with valid bindings', () => {
      const emailValidResult = result.clauseResults.find(
        r => r.clauseId === 'CreateUser.pre.emailValid'
      );
      
      expect(emailValidResult).toBeDefined();
      expect(emailValidResult!.status).toBe('PASS');
      expect(emailValidResult!.evidence).toBe('bindings');
    });

    it('should include binding entries in results', () => {
      const emailValidResult = result.clauseResults.find(
        r => r.clauseId === 'CreateUser.pre.emailValid'
      );
      
      expect(emailValidResult!.bindings).toBeDefined();
      expect(emailValidResult!.bindings).toHaveLength(1);
      expect(emailValidResult!.bindings![0]!.type).toBe('guard');
    });

    it('should provide summary statistics', () => {
      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBe(createUserSpec.clauses.length);
      expect(result.summary.boundClauses).toBeGreaterThan(0);
    });
  });

  describe('without @isl-bindings (heuristic fallback)', () => {
    let result: VerificationResult;

    beforeEach(() => {
      result = verify(withoutBindingsSource, createProductSpec);
    });

    it('should fallback to heuristic matching', () => {
      expect(result.hasBindings).toBe(false);
      expect(result.parsedBindings).toBeUndefined();
    });

    it('should mark all clauses with evidence = "heuristic"', () => {
      for (const clauseResult of result.clauseResults) {
        expect(clauseResult.evidence).toBe('heuristic');
      }
    });

    it('should find heuristic matches for guard patterns', () => {
      const nameRequiredResult = result.clauseResults.find(
        r => r.clauseId === 'CreateProduct.pre.nameRequired'
      );
      
      expect(nameRequiredResult).toBeDefined();
      // Should find the throw guard pattern
      expect(nameRequiredResult!.heuristicMatches).toBeDefined();
    });

    it('should include heuristic matches in results', () => {
      const priceResult = result.clauseResults.find(
        r => r.clauseId === 'CreateProduct.pre.pricePositive'
      );
      
      if (priceResult!.heuristicMatches && priceResult!.heuristicMatches.length > 0) {
        const match = priceResult!.heuristicMatches[0]!;
        expect(match).toHaveProperty('type');
        expect(match).toHaveProperty('line');
        expect(match).toHaveProperty('code');
        expect(match).toHaveProperty('confidence');
      }
    });

    it('should set status based on heuristic confidence', () => {
      for (const clauseResult of result.clauseResults) {
        expect(['PASS', 'PARTIAL', 'FAIL']).toContain(clauseResult.status);
      }
    });
  });

  describe('with requireBindings option', () => {
    it('should fail all clauses when bindings required but missing', () => {
      const result = verify(withoutBindingsSource, createProductSpec, {
        requireBindings: true,
      });

      expect(result.success).toBe(false);
      
      for (const clauseResult of result.clauseResults) {
        expect(clauseResult.status).toBe('FAIL');
        expect(clauseResult.notes.some(
          n => n.message.includes('required but not found')
        )).toBe(true);
      }
    });

    it('should pass when bindings required and present', () => {
      const result = verify(withBindingsSource, createUserSpec, {
        requireBindings: true,
      });

      expect(result.hasBindings).toBe(true);
      // At least some clauses should pass
      expect(result.summary.passed + result.summary.partial).toBeGreaterThan(0);
    });
  });

  describe('verbose mode', () => {
    it('should include detailed notes when verbose', () => {
      const result = verify(withBindingsSource, createUserSpec, {
        verbose: true,
      });

      // Verbose mode should include at least some notes
      const anyHasNotes = result.clauseResults.some(
        r => r.notes.length >= 1
      );
      expect(anyHasNotes).toBe(true);
    });
  });
});

// ============================================================================
// verifyWithClauses Tests
// ============================================================================

describe('verifyWithClauses', () => {
  it('should work with inline clause definitions', () => {
    const result = verifyWithClauses(withBindingsSource, [
      {
        id: 'CreateUser.pre.emailValid',
        type: 'precondition',
        expression: 'email.valid',
      },
    ]);

    expect(result.clauseResults).toHaveLength(1);
    expect(result.clauseResults[0]!.clauseId).toBe('CreateUser.pre.emailValid');
  });
});

// ============================================================================
// hasExplicitBindings Tests
// ============================================================================

describe('hasExplicitBindings', () => {
  it('should return true for source with bindings', () => {
    expect(hasExplicitBindings(withBindingsSource)).toBe(true);
  });

  it('should return false for source without bindings', () => {
    expect(hasExplicitBindings(withoutBindingsSource)).toBe(false);
  });
});

// ============================================================================
// formatVerificationSummary Tests
// ============================================================================

describe('formatVerificationSummary', () => {
  it('should format summary with bindings', () => {
    const result = verify(withBindingsSource, createUserSpec);
    const summary = formatVerificationSummary(result);

    expect(summary).toContain('Verification');
    expect(summary).toContain('Evidence: bindings');
    expect(summary).toContain('Clauses:');
    expect(summary).toContain('PASS:');
    expect(summary).toContain('PARTIAL:');
    expect(summary).toContain('FAIL:');
  });

  it('should format summary with heuristic', () => {
    const result = verify(withoutBindingsSource, createProductSpec);
    const summary = formatVerificationSummary(result);

    expect(summary).toContain('Evidence: heuristic');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle empty source code', () => {
    const result = verify('', createUserSpec);
    
    expect(result.hasBindings).toBe(false);
    expect(result.clauseResults).toHaveLength(createUserSpec.clauses.length);
  });

  it('should handle empty clauses', () => {
    const result = verify(withBindingsSource, { clauses: [] });
    
    expect(result.success).toBe(true);
    expect(result.clauseResults).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  it('should handle malformed bindings gracefully', () => {
    const malformedSource = `
      /**
       * @isl-bindings
       * This is not a valid binding line
       * Another invalid -> line here
       */
      function test() {}
    `;

    const bindings = parseBindings(malformedSource);
    // Should return null or empty bindings
    expect(bindings === null || bindings.bindings.size === 0).toBe(true);
  });

  it('should handle clauses not in bindings', () => {
    const result = verify(withBindingsSource, {
      clauses: [
        {
          id: 'NonExistent.clause',
          type: 'precondition',
          expression: 'true',
        },
      ],
    });

    const clauseResult = result.clauseResults[0]!;
    expect(clauseResult.evidence).toBe('heuristic');
    expect(clauseResult.notes.some(
      n => n.message.includes('No explicit binding')
    )).toBe(true);
  });
});
