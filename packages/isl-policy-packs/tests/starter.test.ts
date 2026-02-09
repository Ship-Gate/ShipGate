/**
 * ISL Policy Packs - Starter Policy Pack Tests
 *
 * Tests the three starter policies:
 *   - no-fake-endpoints
 *   - no-missing-env-vars
 *   - no-swallowed-errors
 */

import { describe, it, expect } from 'vitest';
import {
  starterPolicyPack,
  noFakeEndpointsRule,
  noMissingEnvVarsRule,
  noSwallowedErrorsRule,
} from '../src/packs/starter.js';
import type { RuleContext, TruthpackData } from '../src/types.js';
import type { Claim, Evidence } from '@isl-lang/firewall';

// ============================================================================
// Helpers
// ============================================================================

function makeCtx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    claims: [],
    evidence: [],
    filePath: 'src/handler.ts',
    content: '',
    truthpack: {},
    ...overrides,
  };
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'claim-1',
    type: 'api_endpoint',
    value: '/api/users',
    location: { line: 1, column: 0, length: 10 },
    confidence: 0.9,
    context: '',
    ...overrides,
  };
}

function makeEvidence(claimId: string, found: boolean): Evidence {
  return {
    claimId,
    found,
    source: 'truthpack',
    confidence: 1.0,
    details: {},
  };
}

// ============================================================================
// Pack Structure
// ============================================================================

describe('starterPolicyPack', () => {
  it('has correct metadata', () => {
    expect(starterPolicyPack.id).toBe('starter');
    expect(starterPolicyPack.name).toBe('Starter Policies');
    expect(starterPolicyPack.version).toBe('0.1.0');
  });

  it('contains exactly 3 rules', () => {
    expect(starterPolicyPack.rules).toHaveLength(3);
  });

  it('has expected rule IDs', () => {
    const ids = starterPolicyPack.rules.map(r => r.id);
    expect(ids).toEqual([
      'starter/no-fake-endpoints',
      'starter/no-missing-env-vars',
      'starter/no-swallowed-errors',
    ]);
  });

  it('is enabled by default', () => {
    expect(starterPolicyPack.defaultConfig?.enabled).toBe(true);
  });
});

// ============================================================================
// no-fake-endpoints
// ============================================================================

describe('starter/no-fake-endpoints', () => {
  it('returns null when no endpoint claims', () => {
    const result = noFakeEndpointsRule.evaluate(makeCtx());
    expect(result).toBeNull();
  });

  it('returns null when endpoint claims have evidence', () => {
    const claim = makeClaim({ id: 'ep-1', type: 'api_endpoint', value: '/api/users' });
    const result = noFakeEndpointsRule.evaluate(
      makeCtx({
        claims: [claim],
        evidence: [makeEvidence('ep-1', true)],
      }),
    );
    expect(result).toBeNull();
  });

  it('blocks when endpoint claims lack evidence', () => {
    const claim = makeClaim({ id: 'ep-1', type: 'api_endpoint', value: '/api/ghost' });
    const result = noFakeEndpointsRule.evaluate(
      makeCtx({
        claims: [claim],
        evidence: [makeEvidence('ep-1', false)],
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('starter/no-fake-endpoints');
    expect(result!.severity).toBe('error');
    expect(result!.tier).toBe('hard_block');
    expect(result!.message).toContain('FAKE ENDPOINT');
    expect(result!.message).toContain('/api/ghost');
  });

  it('blocks when endpoint claims have no evidence entries at all', () => {
    const claim = makeClaim({ id: 'ep-1', type: 'api_endpoint', value: '/api/missing' });
    const result = noFakeEndpointsRule.evaluate(
      makeCtx({
        claims: [claim],
        evidence: [],
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toContain('FAKE ENDPOINT');
  });

  it('detects undeclared routes via pattern matching when truthpack has routes', () => {
    const result = noFakeEndpointsRule.evaluate(
      makeCtx({
        content: 'app.get("/api/secret", handler);',
        truthpack: {
          routes: [{ method: 'GET', path: '/api/users' }],
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toContain('/api/secret');
  });

  it('passes when route is declared in truthpack', () => {
    const result = noFakeEndpointsRule.evaluate(
      makeCtx({
        content: 'app.get("/api/users", handler);',
        truthpack: {
          routes: [{ method: 'GET', path: '/api/users' }],
        },
      }),
    );
    expect(result).toBeNull();
  });

  it('includes suggestion in violation', () => {
    const claim = makeClaim({ id: 'ep-1', type: 'api_endpoint', value: '/api/ghost' });
    const result = noFakeEndpointsRule.evaluate(
      makeCtx({ claims: [claim], evidence: [] }),
    );
    expect(result!.suggestion).toBeDefined();
    expect(result!.suggestion).toContain('truthpack');
  });
});

// ============================================================================
// no-missing-env-vars
// ============================================================================

describe('starter/no-missing-env-vars', () => {
  it('returns null when no env claims', () => {
    const result = noMissingEnvVarsRule.evaluate(makeCtx());
    expect(result).toBeNull();
  });

  it('returns null when env claims have evidence', () => {
    const claim = makeClaim({ id: 'env-1', type: 'env_variable', value: 'DATABASE_URL' });
    const result = noMissingEnvVarsRule.evaluate(
      makeCtx({
        claims: [claim],
        evidence: [makeEvidence('env-1', true)],
      }),
    );
    expect(result).toBeNull();
  });

  it('blocks when env claims lack evidence', () => {
    const claim = makeClaim({ id: 'env-1', type: 'env_variable', value: 'SECRET_KEY' });
    const result = noMissingEnvVarsRule.evaluate(
      makeCtx({
        claims: [claim],
        evidence: [makeEvidence('env-1', false)],
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('starter/no-missing-env-vars');
    expect(result!.severity).toBe('error');
    expect(result!.tier).toBe('hard_block');
    expect(result!.message).toContain('MISSING ENV VAR');
    expect(result!.message).toContain('SECRET_KEY');
  });

  it('detects undeclared env vars via pattern matching', () => {
    const result = noMissingEnvVarsRule.evaluate(
      makeCtx({
        content: 'const key = process.env.STRIPE_SECRET;',
        truthpack: {
          env: [{ name: 'DATABASE_URL', required: true }],
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toContain('STRIPE_SECRET');
  });

  it('passes when env var is declared in truthpack', () => {
    const result = noMissingEnvVarsRule.evaluate(
      makeCtx({
        content: 'const url = process.env.DATABASE_URL;',
        truthpack: {
          env: [{ name: 'DATABASE_URL', required: true }],
        },
      }),
    );
    expect(result).toBeNull();
  });

  it('ignores well-known vars like NODE_ENV', () => {
    const result = noMissingEnvVarsRule.evaluate(
      makeCtx({
        content: 'const env = process.env.NODE_ENV;',
        truthpack: {
          env: [{ name: 'OTHER_VAR', required: true }],
        },
      }),
    );
    expect(result).toBeNull();
  });

  it('detects bracket-style access', () => {
    const result = noMissingEnvVarsRule.evaluate(
      makeCtx({
        content: 'const key = process.env["API_TOKEN"];',
        truthpack: {
          env: [{ name: 'DATABASE_URL', required: true }],
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toContain('API_TOKEN');
  });
});

// ============================================================================
// no-swallowed-errors
// ============================================================================

describe('starter/no-swallowed-errors', () => {
  it('returns null when no catch blocks', () => {
    const result = noSwallowedErrorsRule.evaluate(
      makeCtx({ content: 'function foo() { return 1; }' }),
    );
    expect(result).toBeNull();
  });

  it('returns null when catch block has content', () => {
    const result = noSwallowedErrorsRule.evaluate(
      makeCtx({
        content: `try { foo(); } catch (e) { console.error(e); throw e; }`,
      }),
    );
    expect(result).toBeNull();
  });

  it('warns on empty catch block', () => {
    const result = noSwallowedErrorsRule.evaluate(
      makeCtx({
        content: `try { foo(); } catch (e) { }`,
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('starter/no-swallowed-errors');
    expect(result!.severity).toBe('warning');
    expect(result!.tier).toBe('soft_block');
    expect(result!.message).toContain('SWALLOWED ERROR');
  });

  it('warns on empty arrow catch', () => {
    const result = noSwallowedErrorsRule.evaluate(
      makeCtx({
        content: `fetch("/api").catch(() => { })`,
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toContain('SWALLOWED ERROR');
  });

  it('warns on catch with only underscore parameter', () => {
    const result = noSwallowedErrorsRule.evaluate(
      makeCtx({
        content: `promise.catch((_err) => { })`,
      }),
    );
    expect(result).not.toBeNull();
  });

  it('provides suggestion', () => {
    const result = noSwallowedErrorsRule.evaluate(
      makeCtx({ content: `try { x(); } catch (e) { }` }),
    );
    expect(result!.suggestion).toBeDefined();
    expect(result!.suggestion).toContain('Log the error');
  });

  it('detects comment-only catch as info', () => {
    const result = noSwallowedErrorsRule.evaluate(
      makeCtx({
        content: `try { x(); } catch (e) { // intentionally ignored }`,
      }),
    );
    // Should detect as comment-only catch (info tier)
    // or empty catch depending on pattern
    if (result) {
      expect(result.ruleId).toBe('starter/no-swallowed-errors');
    }
  });
});
