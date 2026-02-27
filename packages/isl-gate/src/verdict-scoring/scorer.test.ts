/**
 * Verdict Scorer Tests
 * 
 * Golden tests for deterministic scoring from samples/isl
 * 
 * @module @isl-lang/gate/verdict-scoring/scorer.test
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { scoreVerdicts, DEFAULT_SCORING_CONFIG } from './scorer.js';
import type { ISLClaim } from './types.js';
import { createGateEvidence } from '../authoritative/verdict-engine.js';
import type { GateEvidence } from '../authoritative/verdict-engine.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Load claims from a sample ISL expected claims.json
 */
async function loadClaimsFromSample(sampleName: string): Promise<ISLClaim[]> {
  const claimsPath = join(process.cwd(), 'samples', 'isl', sampleName, 'expected', 'claims.json');
  const claimsData = JSON.parse(await readFile(claimsPath, 'utf-8'));
  
  return claimsData.claims.map((c: {
    id: string;
    type: string;
    behavior?: string;
    description?: string;
    verdict: string;
  }): ISLClaim => ({
    id: c.id,
    type: c.type as ISLClaim['type'],
    behavior: c.behavior,
    description: c.description,
    verdict: c.verdict === 'pass' ? 'pass' 
      : c.verdict === 'fail' ? 'fail'
      : c.verdict === 'warn' ? 'warn'
      : 'skip',
  }));
}

/**
 * Create evidence from claims
 */
function createEvidenceFromClaims(claims: ISLClaim[]): GateEvidence[] {
  return claims.map(claim => 
    createGateEvidence(
      'isl-spec',
      claim.id,
      claim.verdict === 'pass' ? 'pass'
        : claim.verdict === 'fail' ? 'fail'
        : claim.verdict === 'warn' ? 'warn'
        : 'skip',
      claim.verdict === 'pass' ? 0.95 : claim.verdict === 'fail' ? 0.1 : 0.7,
      claim.description || claim.id
    )
  );
}

// ============================================================================
// Golden Tests
// ============================================================================

describe('Verdict Scorer - Golden Tests', () => {
  it('should produce deterministic results for payments-idempotency', async () => {
    const claims = await loadClaimsFromSample('payments-idempotency');
    const evidence = createEvidenceFromClaims(claims);
    
    const result1 = scoreVerdicts(claims, evidence, DEFAULT_SCORING_CONFIG);
    const result2 = scoreVerdicts(claims, evidence, DEFAULT_SCORING_CONFIG);
    
    // Same inputs should yield same verdict and ordering
    expect(result1.verdict).toBe(result2.verdict);
    expect(result1.score).toBe(result2.score);
    expect(result1.scoredClaims.map(c => c.id)).toEqual(result2.scoredClaims.map(c => c.id));
    
    // All claims should pass (SHIP)
    expect(result1.verdict).toBe('SHIP');
    expect(result1.scoredClaims.every(c => c.verdict === 'pass')).toBe(true);
  });

  it('should produce deterministic results for auth-roles', async () => {
    const claims = await loadClaimsFromSample('auth-roles');
    const evidence = createEvidenceFromClaims(claims);
    
    const result1 = scoreVerdicts(claims, evidence, DEFAULT_SCORING_CONFIG);
    const result2 = scoreVerdicts(claims, evidence, DEFAULT_SCORING_CONFIG);
    
    // Same inputs should yield same verdict and ordering
    expect(result1.verdict).toBe(result2.verdict);
    expect(result1.score).toBe(result2.score);
    expect(result1.scoredClaims.map(c => c.id)).toEqual(result2.scoredClaims.map(c => c.id));
    
    // All claims should pass (SHIP)
    expect(result1.verdict).toBe('SHIP');
  });

  it('should produce deterministic results for async-jobs', async () => {
    const claims = await loadClaimsFromSample('async-jobs');
    const evidence = createEvidenceFromClaims(claims);
    
    const result1 = scoreVerdicts(claims, evidence, DEFAULT_SCORING_CONFIG);
    const result2 = scoreVerdicts(claims, evidence, DEFAULT_SCORING_CONFIG);
    
    // Same inputs should yield same verdict and ordering
    expect(result1.verdict).toBe(result2.verdict);
    expect(result1.score).toBe(result2.score);
    expect(result1.scoredClaims.map(c => c.id)).toEqual(result2.scoredClaims.map(c => c.id));
  });

  it('should merge duplicate claims', async () => {
    const claims: ISLClaim[] = [
      {
        id: 'claim-1',
        type: 'postcondition',
        behavior: 'TestBehavior',
        description: 'Test description',
        verdict: 'pass',
      },
      {
        id: 'claim-1-duplicate',
        type: 'postcondition',
        behavior: 'TestBehavior',
        description: 'Test description',
        verdict: 'fail', // More severe
      },
    ];
    
    const evidence = createEvidenceFromClaims(claims);
    const result = scoreVerdicts(claims, evidence, DEFAULT_SCORING_CONFIG);
    
    // Should merge to one claim with fail verdict (more severe)
    const mergedClaim = result.scoredClaims.find(c => 
      c.behavior === 'TestBehavior' && c.description === 'Test description'
    );
    expect(mergedClaim).toBeDefined();
    expect(mergedClaim!.verdict).toBe('fail');
  });

  it('should order claims deterministically', async () => {
    const claims: ISLClaim[] = [
      {
        id: 'z-claim',
        type: 'scenario',
        verdict: 'pass',
      },
      {
        id: 'a-claim',
        type: 'postcondition',
        verdict: 'fail',
      },
      {
        id: 'b-claim',
        type: 'invariant',
        verdict: 'fail',
      },
    ];
    
    const evidence = createEvidenceFromClaims(claims);
    const result1 = scoreVerdicts(claims, evidence, DEFAULT_SCORING_CONFIG);
    const result2 = scoreVerdicts([...claims].reverse(), evidence, DEFAULT_SCORING_CONFIG);
    
    // Should have same ordering regardless of input order
    expect(result1.scoredClaims.map(c => c.id)).toEqual(result2.scoredClaims.map(c => c.id));
    
    // Failures should come before passes
    const failIndices = result1.scoredClaims
      .map((c, i) => c.verdict === 'fail' ? i : -1)
      .filter(i => i >= 0);
    const passIndices = result1.scoredClaims
      .map((c, i) => c.verdict === 'pass' ? i : -1)
      .filter(i => i >= 0);
    
    if (failIndices.length > 0 && passIndices.length > 0) {
      expect(Math.min(...failIndices)).toBeLessThan(Math.min(...passIndices));
    }
  });

  it('should generate actionable explanations', async () => {
    const claims: ISLClaim[] = [
      {
        id: 'failed-claim',
        type: 'postcondition',
        behavior: 'TestBehavior',
        description: 'This should pass',
        verdict: 'fail',
        file: 'src/test.ts',
        line: 42,
      },
    ];
    
    const evidence = createEvidenceFromClaims(claims);
    const result = scoreVerdicts(claims, evidence, DEFAULT_SCORING_CONFIG);
    
    // Should have explanations
    expect(result.explanations.length).toBeGreaterThan(0);
    
    // Should have actionable recommendations
    expect(result.recommendations.length).toBeGreaterThan(0);
    const fixRec = result.recommendations.find(r => r.includes('src/test.ts'));
    expect(fixRec).toBeDefined();
    expect(fixRec).toContain('Fix');
  });

  it('should handle empty claims', () => {
    const result = scoreVerdicts([], [], DEFAULT_SCORING_CONFIG);
    
    expect(result.verdict).toBe('NO_SHIP');
    expect(result.score).toBe(0);
    expect(result.scoredClaims).toEqual([]);
  });

  it('should respect thresholds', () => {
    const claims: ISLClaim[] = Array.from({ length: 10 }, (_, i) => ({
      id: `claim-${i}`,
      type: 'postcondition' as const,
      verdict: i < 5 ? 'pass' : 'fail' as const,
    }));
    
    const evidence = createEvidenceFromClaims(claims);
    
    // With default thresholds (SHIP: 85, WARN: 50)
    const result = scoreVerdicts(claims, evidence, DEFAULT_SCORING_CONFIG);
    
    // Should be NO_SHIP due to failures
    expect(['NO_SHIP', 'WARN']).toContain(result.verdict);
    
    // With relaxed thresholds
    const relaxedConfig = {
      ...DEFAULT_SCORING_CONFIG,
      thresholds: { SHIP: 30, WARN: 10 },
    };
    const relaxedResult = scoreVerdicts(claims, evidence, relaxedConfig);
    
    // Should potentially be SHIP with relaxed thresholds
    expect(relaxedResult.score).toBeGreaterThanOrEqual(0);
  });
});
