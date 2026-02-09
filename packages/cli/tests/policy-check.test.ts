/**
 * Policy Check Tests
 * 
 * Tests for organization policy enforcement
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadPolicy,
  loadPolicyFile,
  getActiveExceptions,
  isExceptionValid,
  PolicyValidationError,
} from '../src/commands/policy-loader.js';
import {
  checkPolicy,
  checkPolicyAgainstGate,
} from '../src/commands/policy-check.js';
import type { GateResult } from '../src/commands/gate.js';
import type { PolicyException } from '../src/commands/policy-schema.js';

describe('Policy Loader', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `shipgate-policy-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup handled by OS
  });

  it('should load default policy when no file exists', async () => {
    const loaded = await loadPolicy(testDir);
    expect(loaded.isDefault).toBe(true);
    expect(loaded.config.version).toBe(1);
    expect(loaded.config.profiles.strict).toBeDefined();
    expect(loaded.config.profiles.standard).toBeDefined();
    expect(loaded.config.profiles.lenient).toBeDefined();
  });

  it('should load policy from file', async () => {
    const policyFile = join(testDir, '.shipgate.policy.yml');
    const policyContent = `version: 1
org: "test-org"
profiles:
  strict:
    min_trust_score: 98
    min_confidence: 90
  standard:
    min_trust_score: 85
    min_confidence: 60
  lenient:
    min_trust_score: 70
    min_confidence: 40
default_profile: strict
required_evidence: []
exceptions: []
`;

    await writeFile(policyFile, policyContent, 'utf-8');
    const loaded = await loadPolicy(testDir);

    expect(loaded.isDefault).toBe(false);
    expect(loaded.config.org).toBe('test-org');
    expect(loaded.config.profiles.strict.minTrustScore).toBe(98);
    expect(loaded.config.defaultProfile).toBe('strict');
  });

  it('should validate policy file', async () => {
    const policyFile = join(testDir, '.shipgate.policy.yml');
    const invalidPolicy = `version: 2
profiles:
  strict:
    min_trust_score: 150
`;

    await writeFile(policyFile, invalidPolicy, 'utf-8');

    await expect(loadPolicyFile(policyFile)).rejects.toThrow(PolicyValidationError);
  });

  it('should filter expired exceptions', () => {
    const exceptions: PolicyException[] = [
      {
        id: 'valid',
        scope: {},
        justification: 'Test',
        expiresAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        createdAt: new Date().toISOString(),
        active: true,
      },
      {
        id: 'expired',
        scope: {},
        justification: 'Test',
        expiresAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        active: true,
      },
      {
        id: 'inactive',
        scope: {},
        justification: 'Test',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        active: false,
      },
    ];

    const active = getActiveExceptions(exceptions);
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('valid');
  });
});

describe('Policy Check', () => {
  it('should check gate result against policy', async () => {
    const gateResult: GateResult = {
      decision: 'SHIP',
      exitCode: 0,
      trustScore: 90,
      confidence: 70,
      summary: 'All tests passed',
      results: {
        clauses: [],
        summary: { total: 5, passed: 5, failed: 0, skipped: 0 },
        blockers: [],
      },
    };

    const result = await checkPolicyAgainstGate(gateResult, {
      directory: process.cwd(),
    });

    // Should pass with default standard profile (minTrustScore: 85, minConfidence: 60)
    expect(result.passed).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should fail when trust score is too low', async () => {
    const gateResult: GateResult = {
      decision: 'SHIP',
      exitCode: 0,
      trustScore: 70, // Below standard profile minimum of 85
      confidence: 70,
      summary: 'Tests passed',
      results: {
        clauses: [],
        summary: { total: 3, passed: 3, failed: 0, skipped: 0 },
        blockers: [],
      },
    };

    const result = await checkPolicyAgainstGate(gateResult, {
      directory: process.cwd(),
      profile: 'standard',
    });

    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some(v => v.type === 'threshold')).toBe(true);
  });

  it('should fail when confidence is too low', async () => {
    const gateResult: GateResult = {
      decision: 'SHIP',
      exitCode: 0,
      trustScore: 90,
      confidence: 50, // Below standard profile minimum of 60
      summary: 'Tests passed',
      results: {
        clauses: [],
        summary: { total: 2, passed: 2, failed: 0, skipped: 0 },
        blockers: [],
      },
    };

    const result = await checkPolicyAgainstGate(gateResult, {
      directory: process.cwd(),
      profile: 'standard',
    });

    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.rule === 'min_confidence')).toBe(true);
  });
});
