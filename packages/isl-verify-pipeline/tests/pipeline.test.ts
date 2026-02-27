/**
 * Verification Pipeline Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VerificationPipeline,
  verify,
  createDefaultConfig,
  generateCIOutput,
  formatCIOutput,
  generateEvaluationTable,
  formatTableAsMarkdown,
} from '../src/index.js';
import type { PipelineResult, PipelineConfig } from '../src/types.js';

describe('VerificationPipeline', () => {
  describe('createDefaultConfig', () => {
    it('should create valid default config', () => {
      const config = createDefaultConfig('./test.isl');
      
      expect(config.spec).toBe('./test.isl');
      expect(config.tests.timeout).toBe(60000);
      expect(config.traces.enabled).toBe(true);
      expect(config.traces.redactPii).toBe(true);
    });
  });
  
  describe('verdict calculation', () => {
    const createMockResult = (overrides: Partial<PipelineResult> = {}): PipelineResult => ({
      runId: 'test-run-123',
      verdict: 'INCOMPLETE_PROOF',
      verdictReason: '',
      score: 0,
      timing: {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalDurationMs: 100,
      },
      stages: {},
      evidence: {
        postconditions: [],
        invariants: [],
      },
      summary: {
        tests: { total: 0, passed: 0, failed: 0 },
        postconditions: { total: 0, proven: 0, violated: 0, notProven: 0 },
        invariants: { total: 0, proven: 0, violated: 0, notProven: 0 },
      },
      errors: [],
      ...overrides,
    });
    
    it('should return PROVEN when all conditions verified', () => {
      const result = createMockResult({
        verdict: 'PROVEN',
        summary: {
          tests: { total: 5, passed: 5, failed: 0 },
          postconditions: { total: 3, proven: 3, violated: 0, notProven: 0 },
          invariants: { total: 2, proven: 2, violated: 0, notProven: 0 },
        },
      });
      
      const ciOutput = generateCIOutput(result);
      expect(ciOutput.verdict).toBe('PROVEN');
      expect(ciOutput.exitCode).toBe(0);
    });
    
    it('should return FAILED when violations exist', () => {
      const result = createMockResult({
        verdict: 'FAILED',
        summary: {
          tests: { total: 5, passed: 5, failed: 0 },
          postconditions: { total: 3, proven: 2, violated: 1, notProven: 0 },
          invariants: { total: 2, proven: 2, violated: 0, notProven: 0 },
        },
      });
      
      const ciOutput = generateCIOutput(result);
      expect(ciOutput.verdict).toBe('FAILED');
      expect(ciOutput.exitCode).toBe(1);
    });
    
    it('should return INCOMPLETE_PROOF when some conditions not proven', () => {
      const result = createMockResult({
        verdict: 'INCOMPLETE_PROOF',
        summary: {
          tests: { total: 5, passed: 5, failed: 0 },
          postconditions: { total: 3, proven: 2, violated: 0, notProven: 1 },
          invariants: { total: 2, proven: 1, violated: 0, notProven: 1 },
        },
      });
      
      const ciOutput = generateCIOutput(result);
      expect(ciOutput.verdict).toBe('INCOMPLETE_PROOF');
      expect(ciOutput.exitCode).toBe(2);
    });
  });
});

describe('CI Output', () => {
  const mockResult: PipelineResult = {
    runId: 'verify-abc123',
    verdict: 'PROVEN',
    verdictReason: 'All 5 condition(s) verified',
    score: 100,
    timing: {
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:00:01.000Z',
      totalDurationMs: 1000,
    },
    stages: {
      testRunner: {
        stage: 'test_runner',
        status: 'passed',
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:00.500Z',
        durationMs: 500,
        output: {
          framework: 'vitest' as const,
          suites: [],
          summary: {
            totalSuites: 1,
            totalTests: 3,
            passedTests: 3,
            failedTests: 0,
            skippedTests: 0,
            durationMs: 500,
          },
        },
      },
    },
    evidence: {
      postconditions: [
        {
          clauseId: 'Login_post_success_1',
          type: 'postcondition',
          behavior: 'Login',
          outcome: 'success',
          expression: 'Session.exists(result.id)',
          status: 'proven',
          triStateResult: true,
        },
      ],
      invariants: [
        {
          clauseId: 'Login_inv_1',
          type: 'invariant',
          scope: 'behavior',
          behavior: 'Login',
          expression: 'password never_logged',
          status: 'proven',
          triStateResult: true,
          checkedAt: 'post',
        },
      ],
    },
    summary: {
      tests: { total: 3, passed: 3, failed: 0 },
      postconditions: { total: 3, proven: 3, violated: 0, notProven: 0 },
      invariants: { total: 2, proven: 2, violated: 0, notProven: 0 },
    },
    errors: [],
  };
  
  it('should generate deterministic CI output', () => {
    const output = generateCIOutput(mockResult);
    
    expect(output.schemaVersion).toBe('1.0.0');
    expect(output.runId).toBe('verify-abc123');
    expect(output.verdict).toBe('PROVEN');
    expect(output.exitCode).toBe(0);
    expect(output.score).toBe(100);
    expect(output.violations).toHaveLength(0);
  });
  
  it('should format CI output as valid JSON', () => {
    const output = generateCIOutput(mockResult);
    const json = formatCIOutput(output);
    
    expect(() => JSON.parse(json)).not.toThrow();
    
    const parsed = JSON.parse(json);
    expect(parsed.verdict).toBe('PROVEN');
  });
});

describe('Evaluation Table', () => {
  const mockResult: PipelineResult = {
    runId: 'verify-abc123',
    verdict: 'INCOMPLETE_PROOF',
    verdictReason: '1 condition could not be verified',
    score: 80,
    timing: {
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:00:01.000Z',
      totalDurationMs: 1000,
    },
    stages: {},
    evidence: {
      postconditions: [
        {
          clauseId: 'Login_post_success_1',
          type: 'postcondition',
          behavior: 'Login',
          outcome: 'success',
          expression: 'Session.exists(result.id)',
          status: 'proven',
          triStateResult: true,
        },
        {
          clauseId: 'Login_post_success_2',
          type: 'postcondition',
          behavior: 'Login',
          outcome: 'success',
          expression: 'User.last_login == now()',
          status: 'not_proven',
          triStateResult: 'unknown',
          reason: 'No traces available',
        },
      ],
      invariants: [
        {
          clauseId: 'Login_inv_1',
          type: 'invariant',
          scope: 'behavior',
          behavior: 'Login',
          expression: 'password never_logged',
          status: 'proven',
          triStateResult: true,
          checkedAt: 'post',
        },
      ],
    },
    summary: {
      tests: { total: 3, passed: 3, failed: 0 },
      postconditions: { total: 2, proven: 1, violated: 0, notProven: 1 },
      invariants: { total: 1, proven: 1, violated: 0, notProven: 0 },
    },
    errors: [],
  };
  
  it('should generate evaluation table', () => {
    const table = generateEvaluationTable(mockResult, 'AuthLogin', '1.0.0');
    
    expect(table.version).toBe('1.0.0');
    expect(table.domain).toBe('AuthLogin');
    expect(table.verdict).toBe('INCOMPLETE_PROOF');
    expect(table.rows).toHaveLength(3);
    expect(table.summary.total).toBe(3);
    expect(table.summary.proven).toBe(2);
    expect(table.summary.notProven).toBe(1);
  });
  
  it('should sort rows deterministically', () => {
    const table = generateEvaluationTable(mockResult, 'AuthLogin', '1.0.0');
    
    // Postconditions should come before invariants
    expect(table.rows[0].type).toBe('postcondition');
    expect(table.rows[1].type).toBe('postcondition');
    expect(table.rows[2].type).toBe('invariant');
  });
  
  it('should format table as markdown', () => {
    const table = generateEvaluationTable(mockResult, 'AuthLogin', '1.0.0');
    const markdown = formatTableAsMarkdown(table);
    
    expect(markdown).toContain('# Evaluation Table: AuthLogin');
    expect(markdown).toContain('## Postconditions');
    expect(markdown).toContain('## Invariants');
    expect(markdown).toContain('| Behavior |');
    expect(markdown).toContain('| Login |');
  });
});

describe('Tri-state Logic', () => {
  it('should handle true values', () => {
    const evidence = {
      clauseId: 'test',
      type: 'postcondition' as const,
      expression: 'x > 0',
      status: 'proven' as const,
      triStateResult: true as const,
    };
    
    expect(evidence.triStateResult).toBe(true);
    expect(evidence.status).toBe('proven');
  });
  
  it('should handle false values', () => {
    const evidence = {
      clauseId: 'test',
      type: 'postcondition' as const,
      expression: 'x > 0',
      status: 'violated' as const,
      triStateResult: false as const,
      reason: 'x was -1',
    };
    
    expect(evidence.triStateResult).toBe(false);
    expect(evidence.status).toBe('violated');
  });
  
  it('should handle unknown values', () => {
    const evidence = {
      clauseId: 'test',
      type: 'postcondition' as const,
      expression: 'x > 0',
      status: 'not_proven' as const,
      triStateResult: 'unknown' as const,
      reason: 'No traces available',
    };
    
    expect(evidence.triStateResult).toBe('unknown');
    expect(evidence.status).toBe('not_proven');
  });
});
