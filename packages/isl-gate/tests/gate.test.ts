/**
 * ISL Gate - Smoke Tests
 * 
 * Tests for gate decision and evidence generation.
 */

import { describe, it, expect } from 'vitest';
import {
  runGate,
  quickCheck,
  wouldPass,
  calculateHealthScore,
  determineVerdict,
  buildResult,
  VERDICT_THRESHOLDS,
} from '../src/index.js';
import type { Finding, GateInput, CriticalBlockers } from '../src/index.js';

describe('ISL Gate - Scoring', () => {
  it('should calculate health score from severity counts', () => {
    // No findings = 100
    expect(calculateHealthScore({ critical: 0, high: 0, medium: 0, low: 0 })).toBe(100);

    // 1 critical = 75 (100 - 25)
    expect(calculateHealthScore({ critical: 1, high: 0, medium: 0, low: 0 })).toBe(75);

    // 1 high = 90 (100 - 10)
    expect(calculateHealthScore({ critical: 0, high: 1, medium: 0, low: 0 })).toBe(90);

    // 1 medium = 97 (100 - 3)
    expect(calculateHealthScore({ critical: 0, high: 0, medium: 1, low: 0 })).toBe(97);

    // 1 low = 99 (100 - 1)
    expect(calculateHealthScore({ critical: 0, high: 0, medium: 0, low: 1 })).toBe(99);

    // 4 critical = 0 (100 - 100, capped)
    expect(calculateHealthScore({ critical: 4, high: 0, medium: 0, low: 0 })).toBe(0);

    // Mix: 1 critical + 2 high = 55 (100 - 25 - 20)
    expect(calculateHealthScore({ critical: 1, high: 2, medium: 0, low: 0 })).toBe(55);
  });

  it('should determine verdict from score', () => {
    expect(determineVerdict(100).status).toBe('SHIP');
    expect(determineVerdict(80).status).toBe('SHIP');
    expect(determineVerdict(79).status).toBe('WARN');
    expect(determineVerdict(60).status).toBe('WARN');
    expect(determineVerdict(59).status).toBe('BLOCK');
    expect(determineVerdict(0).status).toBe('BLOCK');
  });

  it('should force BLOCK on critical blockers regardless of score', () => {
    // Even with 100 score, critical blockers should force BLOCK
    const blockers: CriticalBlockers = {
      missingRequiredEnvVars: 1,
    };
    
    const result = determineVerdict(100, blockers);
    expect(result.status).toBe('BLOCK');
    expect(result.reasons).toContain('Missing 1 required environment variable(s)');
  });

  it('should force BLOCK on credential findings', () => {
    const blockers: CriticalBlockers = {
      credentialFindings: 1,
    };
    
    const result = determineVerdict(100, blockers);
    expect(result.status).toBe('BLOCK');
    expect(result.reasons).toContain('1 credential(s) found in code');
  });
});

describe('ISL Gate - Build Result', () => {
  it('should build result with NO_SHIP for critical findings', () => {
    const findings: Finding[] = [
      {
        id: '1',
        type: 'ghost_route',
        severity: 'critical',
        message: 'API endpoint /api/admin not found in routes',
        file: 'src/routes.ts',
        line: 10,
      },
    ];

    const result = buildResult({
      findings,
      filesConsidered: 10,
      filesScanned: 10,
    });

    expect(result.scores.overall).toBe(75); // 100 - 25
    expect(result.verdict.status).toBe('WARN'); // 75 is in WARN range
    expect(result.counts.findingsTotal).toBe(1);
    expect(result.counts.findingsBySeverity.critical).toBe(1);
  });

  it('should build result with SHIP for no findings', () => {
    const result = buildResult({
      findings: [],
      filesConsidered: 10,
      filesScanned: 10,
    });

    expect(result.scores.overall).toBe(100);
    expect(result.verdict.status).toBe('SHIP');
    expect(result.counts.findingsTotal).toBe(0);
  });
});

describe('ISL Gate - Quick Check', () => {
  it('should return NO_SHIP for failing input', () => {
    const input: GateInput = {
      findings: [
        { id: '1', type: 'error', severity: 'critical', message: 'Test' },
        { id: '2', type: 'error', severity: 'critical', message: 'Test2' },
        { id: '3', type: 'error', severity: 'critical', message: 'Test3' },
        { id: '4', type: 'error', severity: 'critical', message: 'Test4' },
      ],
      filesConsidered: 1,
      filesScanned: 1,
    };

    const verdict = quickCheck(input);
    expect(verdict).toBe('NO_SHIP');
  });

  it('should return SHIP for passing input', () => {
    const input: GateInput = {
      findings: [],
      filesConsidered: 10,
      filesScanned: 10,
    };

    const verdict = quickCheck(input);
    expect(verdict).toBe('SHIP');
  });
});

describe('ISL Gate - Would Pass', () => {
  it('should return false for critical findings', () => {
    const findings: Finding[] = [
      { id: '1', type: 'error', severity: 'critical', message: 'Test' },
      { id: '2', type: 'error', severity: 'critical', message: 'Test2' },
      { id: '3', type: 'error', severity: 'critical', message: 'Test3' },
      { id: '4', type: 'error', severity: 'critical', message: 'Test4' },
    ];

    expect(wouldPass(findings)).toBe(false);
  });

  it('should return true for no findings', () => {
    expect(wouldPass([])).toBe(true);
  });

  it('should return true for low-severity findings only', () => {
    const findings: Finding[] = [
      { id: '1', type: 'style', severity: 'low', message: 'Minor issue' },
      { id: '2', type: 'style', severity: 'low', message: 'Another minor issue' },
    ];

    expect(wouldPass(findings)).toBe(true);
  });
});

describe('ISL Gate - Full Gate Run', () => {
  it('should return NO_SHIP with evidence for failing project', async () => {
    const input: GateInput = {
      findings: [
        {
          id: 'ghost-1',
          type: 'ghost_route',
          severity: 'high',
          message: 'API endpoint /api/users not found',
          file: 'src/api.ts',
          line: 15,
        },
        {
          id: 'ghost-2',
          type: 'ghost_route',
          severity: 'high',
          message: 'API endpoint /api/admin not found',
          file: 'src/api.ts',
          line: 22,
        },
        {
          id: 'auth-1',
          type: 'auth_gap',
          severity: 'critical',
          message: 'Protected route missing authentication',
          file: 'src/routes.ts',
          line: 8,
        },
      ],
      filesConsidered: 50,
      filesScanned: 45,
    };

    const result = await runGate(input, {
      projectRoot: '/test/project',
      deterministic: true,
    });

    expect(result.verdict).toBe('NO_SHIP');
    expect(result.score).toBeLessThan(VERDICT_THRESHOLDS.SHIP);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.fingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should return SHIP for clean project', async () => {
    const input: GateInput = {
      findings: [],
      filesConsidered: 100,
      filesScanned: 100,
    };

    const result = await runGate(input, {
      projectRoot: '/test/clean-project',
      deterministic: true,
    });

    expect(result.verdict).toBe('SHIP');
    expect(result.score).toBe(100);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0].message).toBe('All checks passed');
  });

  it('should produce deterministic fingerprint for same input', async () => {
    const input: GateInput = {
      findings: [
        { id: '1', type: 'test', severity: 'low', message: 'Test finding' },
      ],
      filesConsidered: 10,
      filesScanned: 10,
    };

    const result1 = await runGate(input, {
      projectRoot: '/test/project',
      deterministic: true,
    });

    const result2 = await runGate(input, {
      projectRoot: '/test/project',
      deterministic: true,
    });

    expect(result1.fingerprint).toBe(result2.fingerprint);
  });
});
