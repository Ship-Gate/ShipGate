/**
 * ISL Policy Engine - Evaluator Tests
 *
 * Tests the deterministic policy evaluator against various
 * conditions, edge cases, and the starter pack.
 */

import { describe, it, expect } from 'vitest';
import { evaluate, evaluateCondition } from '../src/evaluator.js';
import { starterPolicyPack } from '../src/starter-pack.js';
import type {
  PolicyCondition,
  PolicyEvalInput,
  PolicyEnginePack,
  PolicyDef,
} from '../src/types.js';
import type { Claim } from '@isl-lang/firewall';

// ============================================================================
// Helpers
// ============================================================================

function makeInput(overrides: Partial<PolicyEvalInput> = {}): PolicyEvalInput {
  return {
    claims: [],
    evidence: [],
    files: [],
    verdict: undefined,
    confidence: undefined,
    trustScore: undefined,
    existingViolations: [],
    ...overrides,
  };
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'test-claim-1',
    type: 'api_endpoint',
    value: '/api/users',
    location: { line: 1, column: 0, length: 10 },
    confidence: 0.9,
    context: 'app.get("/api/users", handler)',
    ...overrides,
  };
}

function makePolicy(overrides: Partial<PolicyDef> = {}): PolicyDef {
  return {
    id: 'test/policy',
    name: 'Test Policy',
    description: 'Test policy',
    severity: 'error',
    tier: 'hard_block',
    when: { kind: 'verdict', verdict: 'NO_SHIP' },
    action: 'block',
    explanation: 'blocked because test',
    ...overrides,
  };
}

function makePack(policies: PolicyDef[]): PolicyEnginePack {
  return {
    id: 'test-pack',
    name: 'Test Pack',
    version: '0.1.0',
    description: 'Test pack',
    policies,
  };
}

// ============================================================================
// Condition Evaluation
// ============================================================================

describe('evaluateCondition', () => {
  describe('verdict condition', () => {
    it('matches when verdict equals expected', () => {
      const cond: PolicyCondition = { kind: 'verdict', verdict: 'NO_SHIP' };
      expect(evaluateCondition(cond, makeInput({ verdict: 'NO_SHIP' }))).toBe(true);
    });

    it('does not match when verdict differs', () => {
      const cond: PolicyCondition = { kind: 'verdict', verdict: 'NO_SHIP' };
      expect(evaluateCondition(cond, makeInput({ verdict: 'SHIP' }))).toBe(false);
    });

    it('does not match when verdict is undefined', () => {
      const cond: PolicyCondition = { kind: 'verdict', verdict: 'SHIP' };
      expect(evaluateCondition(cond, makeInput({}))).toBe(false);
    });
  });

  describe('confidence condition', () => {
    it('matches gt comparison', () => {
      const cond: PolicyCondition = { kind: 'confidence', op: 'gt', threshold: 50 };
      expect(evaluateCondition(cond, makeInput({ confidence: 80 }))).toBe(true);
    });

    it('does not match gt when equal', () => {
      const cond: PolicyCondition = { kind: 'confidence', op: 'gt', threshold: 50 };
      expect(evaluateCondition(cond, makeInput({ confidence: 50 }))).toBe(false);
    });

    it('matches lt comparison', () => {
      const cond: PolicyCondition = { kind: 'confidence', op: 'lt', threshold: 20 };
      expect(evaluateCondition(cond, makeInput({ confidence: 10 }))).toBe(true);
    });

    it('matches gte comparison', () => {
      const cond: PolicyCondition = { kind: 'confidence', op: 'gte', threshold: 50 };
      expect(evaluateCondition(cond, makeInput({ confidence: 50 }))).toBe(true);
    });

    it('defaults to 0 when confidence is undefined', () => {
      const cond: PolicyCondition = { kind: 'confidence', op: 'lt', threshold: 10 };
      expect(evaluateCondition(cond, makeInput({}))).toBe(true);
    });
  });

  describe('blast_radius condition', () => {
    it('measures file count', () => {
      const cond: PolicyCondition = { kind: 'blast_radius', op: 'gt', threshold: 2, measure: 'files' };
      const input = makeInput({ files: [{ path: 'a.ts', content: '' }, { path: 'b.ts', content: '' }, { path: 'c.ts', content: '' }] });
      expect(evaluateCondition(cond, input)).toBe(true);
    });

    it('measures claim count', () => {
      const cond: PolicyCondition = { kind: 'blast_radius', op: 'gte', threshold: 1, measure: 'claims' };
      const input = makeInput({ claims: [makeClaim()] });
      expect(evaluateCondition(cond, input)).toBe(true);
    });

    it('measures violation count', () => {
      const cond: PolicyCondition = { kind: 'blast_radius', op: 'eq', threshold: 0, measure: 'violations' };
      const input = makeInput({ existingViolations: [] });
      expect(evaluateCondition(cond, input)).toBe(true);
    });
  });

  describe('claim_type condition', () => {
    it('matches when claim type exists', () => {
      const cond: PolicyCondition = { kind: 'claim_type', types: ['api_endpoint'] };
      expect(evaluateCondition(cond, makeInput({ claims: [makeClaim()] }))).toBe(true);
    });

    it('does not match when no claims of that type', () => {
      const cond: PolicyCondition = { kind: 'claim_type', types: ['env_variable'] };
      expect(evaluateCondition(cond, makeInput({ claims: [makeClaim()] }))).toBe(false);
    });

    it('matches any of the listed types', () => {
      const cond: PolicyCondition = { kind: 'claim_type', types: ['env_variable', 'api_endpoint'] };
      expect(evaluateCondition(cond, makeInput({ claims: [makeClaim()] }))).toBe(true);
    });
  });

  describe('claim_field condition', () => {
    it('matches contains on value', () => {
      const cond: PolicyCondition = { kind: 'claim_field', field: 'value', op: 'contains', value: '/api' };
      expect(evaluateCondition(cond, makeInput({ claims: [makeClaim({ value: '/api/users' })] }))).toBe(true);
    });

    it('matches regex on context', () => {
      const cond: PolicyCondition = { kind: 'claim_field', field: 'context', op: 'matches', value: 'app\\.get' };
      expect(evaluateCondition(cond, makeInput({ claims: [makeClaim()] }))).toBe(true);
    });

    it('does not match when field differs', () => {
      const cond: PolicyCondition = { kind: 'claim_field', field: 'value', op: 'equals', value: '/other' };
      expect(evaluateCondition(cond, makeInput({ claims: [makeClaim()] }))).toBe(false);
    });
  });

  describe('metric condition', () => {
    it('checks trust_score', () => {
      const cond: PolicyCondition = { kind: 'metric', metric: 'trust_score', op: 'lt', value: 50 };
      expect(evaluateCondition(cond, makeInput({ trustScore: 30 }))).toBe(true);
    });

    it('checks file_count', () => {
      const cond: PolicyCondition = { kind: 'metric', metric: 'file_count', op: 'eq', value: 0 };
      expect(evaluateCondition(cond, makeInput({}))).toBe(true);
    });

    it('checks claim_count', () => {
      const cond: PolicyCondition = { kind: 'metric', metric: 'claim_count', op: 'gte', value: 2 };
      const input = makeInput({ claims: [makeClaim({ id: 'c1' }), makeClaim({ id: 'c2' })] });
      expect(evaluateCondition(cond, input)).toBe(true);
    });
  });

  describe('presence condition', () => {
    it('detects present field', () => {
      const cond: PolicyCondition = { kind: 'presence', field: 'verdict', present: true };
      expect(evaluateCondition(cond, makeInput({ verdict: 'SHIP' }))).toBe(true);
    });

    it('detects absent field', () => {
      const cond: PolicyCondition = { kind: 'presence', field: 'verdict', present: false };
      expect(evaluateCondition(cond, makeInput({}))).toBe(true);
    });
  });

  describe('logic conditions', () => {
    it('AND: all must match', () => {
      const cond: PolicyCondition = {
        kind: 'logic',
        op: 'and',
        conditions: [
          { kind: 'verdict', verdict: 'NO_SHIP' },
          { kind: 'confidence', op: 'lt', threshold: 50 },
        ],
      };
      expect(evaluateCondition(cond, makeInput({ verdict: 'NO_SHIP', confidence: 30 }))).toBe(true);
      expect(evaluateCondition(cond, makeInput({ verdict: 'SHIP', confidence: 30 }))).toBe(false);
    });

    it('OR: any must match', () => {
      const cond: PolicyCondition = {
        kind: 'logic',
        op: 'or',
        conditions: [
          { kind: 'verdict', verdict: 'NO_SHIP' },
          { kind: 'confidence', op: 'lt', threshold: 20 },
        ],
      };
      expect(evaluateCondition(cond, makeInput({ verdict: 'SHIP', confidence: 10 }))).toBe(true);
      expect(evaluateCondition(cond, makeInput({ verdict: 'SHIP', confidence: 80 }))).toBe(false);
    });

    it('NOT: inverts', () => {
      const cond: PolicyCondition = {
        kind: 'logic',
        op: 'not',
        conditions: [{ kind: 'verdict', verdict: 'SHIP' }],
      };
      expect(evaluateCondition(cond, makeInput({ verdict: 'NO_SHIP' }))).toBe(true);
      expect(evaluateCondition(cond, makeInput({ verdict: 'SHIP' }))).toBe(false);
    });

    it('nested logic', () => {
      const cond: PolicyCondition = {
        kind: 'logic',
        op: 'and',
        conditions: [
          {
            kind: 'logic',
            op: 'or',
            conditions: [
              { kind: 'verdict', verdict: 'NO_SHIP' },
              { kind: 'confidence', op: 'lt', threshold: 30 },
            ],
          },
          { kind: 'metric', metric: 'claim_count', op: 'gt', value: 0 },
        ],
      };
      const input = makeInput({ verdict: 'NO_SHIP', claims: [makeClaim()] });
      expect(evaluateCondition(cond, input)).toBe(true);
    });
  });
});

// ============================================================================
// Full Engine Evaluation
// ============================================================================

describe('evaluate', () => {
  it('returns allowed when no policies trigger', () => {
    const pack = makePack([
      makePolicy({ when: { kind: 'verdict', verdict: 'NO_SHIP' } }),
    ]);
    const result = evaluate([pack], makeInput({ verdict: 'SHIP' }));
    expect(result.allowed).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.summary).toContain('All policies passed');
  });

  it('returns blocked when a block policy triggers', () => {
    const pack = makePack([
      makePolicy({
        id: 'test/block-no-ship',
        action: 'block',
        when: { kind: 'verdict', verdict: 'NO_SHIP' },
        explanation: 'blocked because verdict is {verdict}',
      }),
    ]);
    const result = evaluate([pack], makeInput({ verdict: 'NO_SHIP' }));
    expect(result.allowed).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0].explanation).toBe('blocked because verdict is NO_SHIP');
    expect(result.summary).toContain('BLOCKED');
  });

  it('returns warnings without blocking', () => {
    const pack = makePack([
      makePolicy({
        id: 'test/low-confidence',
        action: 'warn',
        when: { kind: 'confidence', op: 'lt', threshold: 50 },
        explanation: 'warning: low confidence {confidence}%',
      }),
    ]);
    const result = evaluate([pack], makeInput({ confidence: 30 }));
    expect(result.allowed).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].explanation).toContain('30');
  });

  it('skips disabled policies', () => {
    const pack = makePack([
      makePolicy({
        enabled: false,
        when: { kind: 'verdict', verdict: 'NO_SHIP' },
      }),
    ]);
    const result = evaluate([pack], makeInput({ verdict: 'NO_SHIP' }));
    expect(result.allowed).toBe(true);
    expect(result.metadata.policiesEvaluated).toBe(0);
  });

  it('is deterministic: same input yields same output', () => {
    const pack = makePack([
      makePolicy({
        id: 'a',
        when: { kind: 'confidence', op: 'lt', threshold: 50 },
        explanation: 'low confidence',
      }),
      makePolicy({
        id: 'b',
        when: { kind: 'verdict', verdict: 'NO_SHIP' },
        explanation: 'no ship',
      }),
    ]);
    const input = makeInput({ verdict: 'NO_SHIP', confidence: 30 });

    const r1 = evaluate([pack], input);
    const r2 = evaluate([pack], input);

    // Strip timestamps for comparison
    const strip = (r: typeof r1) => ({
      ...r,
      decisions: r.decisions.map(d => ({ ...d, timestamp: '' })),
      blockers: r.blockers.map(d => ({ ...d, timestamp: '' })),
      warnings: r.warnings.map(d => ({ ...d, timestamp: '' })),
      metadata: { ...r.metadata, timestamp: '' },
    });

    expect(strip(r1)).toEqual(strip(r2));
  });

  it('includes evidence references in decisions', () => {
    const pack = makePack([
      makePolicy({
        when: { kind: 'verdict', verdict: 'NO_SHIP' },
        evidenceRefs: ['truthpack/routes'],
      }),
    ]);
    const result = evaluate([pack], makeInput({ verdict: 'NO_SHIP', confidence: 80, trustScore: 60 }));
    expect(result.blockers[0].evidenceRefs.length).toBeGreaterThan(0);
    const refTypes = result.blockers[0].evidenceRefs.map(r => r.type);
    expect(refTypes).toContain('metric');
    expect(refTypes).toContain('evidence');
  });

  it('expands explanation placeholders', () => {
    const pack = makePack([
      makePolicy({
        when: { kind: 'verdict', verdict: 'NO_SHIP' },
        explanation: 'verdict={verdict} conf={confidence} trust={trustScore} files={fileCount} claims={claimCount}',
      }),
    ]);
    const input = makeInput({
      verdict: 'NO_SHIP',
      confidence: 42,
      trustScore: 77,
      files: [{ path: 'a.ts', content: '' }],
      claims: [makeClaim()],
    });
    const result = evaluate([pack], input);
    expect(result.blockers[0].explanation).toBe(
      'verdict=NO_SHIP conf=42 trust=77 files=1 claims=1',
    );
  });

  it('handles multiple packs', () => {
    const pack1 = makePack([makePolicy({ id: 'p1', when: { kind: 'verdict', verdict: 'NO_SHIP' } })]);
    const pack2: PolicyEnginePack = {
      id: 'pack2',
      name: 'Pack 2',
      version: '0.1.0',
      description: 'Second pack',
      policies: [makePolicy({ id: 'p2', action: 'warn', when: { kind: 'confidence', op: 'lt', threshold: 50 } })],
    };
    const result = evaluate([pack1, pack2], makeInput({ verdict: 'NO_SHIP', confidence: 30 }));
    expect(result.blockers).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.allowed).toBe(false);
  });

  it('metadata counts are correct', () => {
    const pack = makePack([
      makePolicy({ id: 'a', action: 'block', when: { kind: 'verdict', verdict: 'NO_SHIP' } }),
      makePolicy({ id: 'b', action: 'warn', when: { kind: 'confidence', op: 'lt', threshold: 50 } }),
      makePolicy({ id: 'c', action: 'allow', when: { kind: 'metric', metric: 'file_count', op: 'eq', value: 0 } }),
      makePolicy({ id: 'd', action: 'block', when: { kind: 'verdict', verdict: 'SHIP' } }), // won't trigger
    ]);
    const result = evaluate([pack], makeInput({ verdict: 'NO_SHIP', confidence: 30 }));
    expect(result.metadata.policiesEvaluated).toBe(4);
    expect(result.metadata.policiesTriggered).toBe(3);
    expect(result.metadata.blockerCount).toBe(1);
    expect(result.metadata.warningCount).toBe(1);
    expect(result.metadata.allowCount).toBe(1);
  });
});

// ============================================================================
// Starter Pack Integration
// ============================================================================

describe('starterPolicyPack', () => {
  it('has 3 policies', () => {
    expect(starterPolicyPack.policies).toHaveLength(3);
  });

  it('has correct IDs', () => {
    const ids = starterPolicyPack.policies.map(p => p.id);
    expect(ids).toContain('starter/no-fake-endpoints');
    expect(ids).toContain('starter/no-missing-env-vars');
    expect(ids).toContain('starter/no-swallowed-errors');
  });

  it('no-fake-endpoints blocks on api_endpoint claims', () => {
    const input = makeInput({
      claims: [makeClaim({ type: 'api_endpoint', value: '/api/ghost' })],
      confidence: 50,
    });
    const result = evaluate([starterPolicyPack], input);
    const fakeEndpoint = result.decisions.find(d => d.policyId === 'starter/no-fake-endpoints');
    expect(fakeEndpoint).toBeDefined();
    expect(fakeEndpoint!.action).toBe('block');
  });

  it('no-missing-env-vars blocks on env_variable claims', () => {
    const input = makeInput({
      claims: [makeClaim({ id: 'env-1', type: 'env_variable', value: 'SECRET_KEY' })],
      confidence: 50,
    });
    const result = evaluate([starterPolicyPack], input);
    const missingEnv = result.decisions.find(d => d.policyId === 'starter/no-missing-env-vars');
    expect(missingEnv).toBeDefined();
    expect(missingEnv!.action).toBe('block');
  });

  it('no-swallowed-errors warns on catch context', () => {
    const input = makeInput({
      claims: [makeClaim({
        id: 'catch-1',
        type: 'function_call',
        context: 'try { foo() } catch (e) { }',
      })],
      confidence: 50,
    });
    const result = evaluate([starterPolicyPack], input);
    const swallowed = result.decisions.find(d => d.policyId === 'starter/no-swallowed-errors');
    expect(swallowed).toBeDefined();
    expect(swallowed!.action).toBe('warn');
  });

  it('passes when no matching claims', () => {
    const input = makeInput({ confidence: 80 });
    const result = evaluate([starterPolicyPack], input);
    expect(result.allowed).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });
});
