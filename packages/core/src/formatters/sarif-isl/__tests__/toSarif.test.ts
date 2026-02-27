/**
 * Tests for SARIF output generation from ISL Evidence Reports
 */

import { describe, it, expect } from 'vitest';
import {
  toSarif,
  toSarifString,
  createClauseFailureResult,
  mergeSarifLogs,
} from '../toSarif.js';
import type { EvidenceReport, EvidenceClauseResult } from '../../../evidence/evidenceTypes.js';
import type { SarifLog } from '../sarifTypes.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockClause(
  clauseId: string,
  state: 'PASS' | 'PARTIAL' | 'FAIL',
  options: Partial<EvidenceClauseResult> = {}
): EvidenceClauseResult {
  return {
    clauseId,
    state,
    message: options.message ?? `Test message for ${clauseId}`,
    clauseType: options.clauseType ?? 'precondition',
    ...options,
  };
}

function createMockReport(
  clauses: EvidenceClauseResult[],
  options: Partial<EvidenceReport> = {}
): EvidenceReport {
  const passCount = clauses.filter((c) => c.state === 'PASS').length;
  const partialCount = clauses.filter((c) => c.state === 'PARTIAL').length;
  const failCount = clauses.filter((c) => c.state === 'FAIL').length;
  const totalClauses = clauses.length;

  return {
    version: '1.0',
    reportId: 'test-report-001',
    specFingerprint: 'abc123',
    specName: options.specName ?? 'TestSpec',
    specPath: options.specPath ?? 'specs/test.isl',
    clauseResults: clauses,
    scoreSummary: {
      overallScore: totalClauses > 0 ? (passCount / totalClauses) * 100 : 0,
      passCount,
      partialCount,
      failCount,
      totalClauses,
      passRate: totalClauses > 0 ? (passCount / totalClauses) * 100 : 0,
      confidence: 'high',
      recommendation: failCount > 0 ? 'block' : 'ship',
    },
    assumptions: [],
    openQuestions: [],
    artifacts: [],
    metadata: {
      startedAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T10:00:05Z',
      durationMs: 5000,
      agentVersion: '1.0.0',
    },
    ...options,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('toSarif', () => {
  describe('basic conversion', () => {
    it('should convert empty report to valid SARIF', () => {
      const report = createMockReport([]);
      const sarif = toSarif(report);

      expect(sarif.$schema).toContain('sarif-schema-2.1.0.json');
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs).toHaveLength(1);
      expect(sarif.runs[0].results).toHaveLength(0);
    });

    it('should convert report with failures to SARIF results', () => {
      const clauses = [
        createMockClause('auth-check', 'FAIL', { clauseType: 'precondition' }),
        createMockClause('balance-update', 'PASS', { clauseType: 'postcondition' }),
      ];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      expect(sarif.runs[0].results).toHaveLength(2);
    });

    it('should include tool information', () => {
      const report = createMockReport([]);
      const sarif = toSarif(report);
      const tool = sarif.runs[0].tool;

      expect(tool.driver.name).toBe('ISL Verifier');
      expect(tool.driver.version).toBeDefined();
      expect(tool.driver.informationUri).toBeDefined();
    });
  });

  describe('rule ID generation', () => {
    it('should generate correct rule ID format', () => {
      const clauses = [
        createMockClause('user-authenticated', 'FAIL', { clauseType: 'precondition' }),
      ];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      expect(sarif.runs[0].results[0].ruleId).toBe('ISL/precondition/user-authenticated');
    });

    it('should sanitize special characters in clause ID', () => {
      const clauses = [
        createMockClause('user@auth#check', 'FAIL', { clauseType: 'precondition' }),
      ];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      expect(sarif.runs[0].results[0].ruleId).toBe('ISL/precondition/user_auth_check');
    });

    it('should handle different clause types', () => {
      const clauses = [
        createMockClause('pre-1', 'FAIL', { clauseType: 'precondition' }),
        createMockClause('post-1', 'FAIL', { clauseType: 'postcondition' }),
        createMockClause('inv-1', 'FAIL', { clauseType: 'invariant' }),
      ];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      expect(sarif.runs[0].results[0].ruleId).toBe('ISL/precondition/pre-1');
      expect(sarif.runs[0].results[1].ruleId).toBe('ISL/postcondition/post-1');
      expect(sarif.runs[0].results[2].ruleId).toBe('ISL/invariant/inv-1');
    });
  });

  describe('severity mapping', () => {
    it('should map FAIL to error level', () => {
      const clauses = [createMockClause('test', 'FAIL')];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      expect(sarif.runs[0].results[0].level).toBe('error');
    });

    it('should map PARTIAL to warning level', () => {
      const clauses = [createMockClause('test', 'PARTIAL')];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      expect(sarif.runs[0].results[0].level).toBe('warning');
    });

    it('should map PASS to note level', () => {
      const clauses = [createMockClause('test', 'PASS')];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      expect(sarif.runs[0].results[0].level).toBe('note');
    });
  });

  describe('message building', () => {
    it('should include clause state in message', () => {
      const clauses = [createMockClause('test', 'FAIL', { message: 'Custom error' })];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      expect(sarif.runs[0].results[0].message.text).toContain('[FAIL]');
      expect(sarif.runs[0].results[0].message.text).toContain('Custom error');
    });

    it('should include expected/actual values when present', () => {
      const clauses = [
        createMockClause('test', 'FAIL', {
          expectedValue: 100,
          actualValue: 50,
        }),
      ];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      const message = sarif.runs[0].results[0].message;
      expect(message.text).toContain('Expected');
      expect(message.text).toContain('Actual');
      expect(message.markdown).toContain('100');
      expect(message.markdown).toContain('50');
    });

    it('should include markdown formatting', () => {
      const clauses = [createMockClause('test', 'FAIL', { message: 'Test error' })];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      expect(sarif.runs[0].results[0].message.markdown).toContain('**');
    });
  });

  describe('options', () => {
    it('should filter to failures only when failuresOnly is true', () => {
      const clauses = [
        createMockClause('fail-1', 'FAIL'),
        createMockClause('pass-1', 'PASS'),
        createMockClause('partial-1', 'PARTIAL'),
      ];
      const report = createMockReport(clauses);
      const sarif = toSarif(report, { failuresOnly: true, includePartial: false });

      expect(sarif.runs[0].results).toHaveLength(1);
      expect(sarif.runs[0].results[0].level).toBe('error');
    });

    it('should include partial when failuresOnly with includePartial', () => {
      const clauses = [
        createMockClause('fail-1', 'FAIL'),
        createMockClause('pass-1', 'PASS'),
        createMockClause('partial-1', 'PARTIAL'),
      ];
      const report = createMockReport(clauses);
      const sarif = toSarif(report, { failuresOnly: true, includePartial: true });

      expect(sarif.runs[0].results).toHaveLength(2);
    });

    it('should exclude rules when includeRules is false', () => {
      const clauses = [createMockClause('test', 'FAIL')];
      const report = createMockReport(clauses);
      const sarif = toSarif(report, { includeRules: false });

      expect(sarif.runs[0].tool.driver.rules).toBeUndefined();
    });

    it('should use custom tool version', () => {
      const report = createMockReport([]);
      const sarif = toSarif(report, { toolVersion: '2.5.0' });

      expect(sarif.runs[0].tool.driver.version).toBe('2.5.0');
    });

    it('should add base URI when provided', () => {
      const report = createMockReport([]);
      const sarif = toSarif(report, { baseUri: 'file:///workspace/' });

      expect(sarif.runs[0].originalUriBaseIds).toBeDefined();
      expect(sarif.runs[0].originalUriBaseIds?.SRCROOT?.uri).toBe('file:///workspace/');
    });
  });

  describe('rule deduplication', () => {
    it('should deduplicate rules with same ID', () => {
      const clauses = [
        createMockClause('same-rule', 'FAIL', { clauseType: 'precondition' }),
        createMockClause('same-rule', 'FAIL', { clauseType: 'precondition' }),
      ];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      expect(sarif.runs[0].results).toHaveLength(2);
      expect(sarif.runs[0].tool.driver.rules).toHaveLength(1);
    });
  });

  describe('invocation', () => {
    it('should include invocation with execution status', () => {
      const clauses = [createMockClause('test', 'FAIL')];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      expect(sarif.runs[0].invocations).toHaveLength(1);
      expect(sarif.runs[0].invocations![0].executionSuccessful).toBe(false);
      expect(sarif.runs[0].invocations![0].exitCode).toBe(1);
    });

    it('should report success when no failures', () => {
      const clauses = [createMockClause('test', 'PASS')];
      const report = createMockReport(clauses);
      const sarif = toSarif(report);

      expect(sarif.runs[0].invocations![0].executionSuccessful).toBe(true);
      expect(sarif.runs[0].invocations![0].exitCode).toBe(0);
    });

    it('should include timestamps', () => {
      const report = createMockReport([]);
      const sarif = toSarif(report);

      expect(sarif.runs[0].invocations![0].startTimeUtc).toBeDefined();
      expect(sarif.runs[0].invocations![0].endTimeUtc).toBeDefined();
    });
  });
});

describe('toSarifString', () => {
  it('should return valid JSON string', () => {
    const report = createMockReport([]);
    const json = toSarifString(report);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('should pretty print by default', () => {
    const report = createMockReport([]);
    const json = toSarifString(report);

    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });

  it('should compact when prettyPrint is false', () => {
    const report = createMockReport([]);
    const json = toSarifString(report, { prettyPrint: false });

    expect(json).not.toContain('\n  ');
  });
});

describe('createClauseFailureResult', () => {
  it('should create a minimal SARIF result', () => {
    const result = createClauseFailureResult(
      'test-clause',
      'Test failure message',
      'precondition'
    );

    expect(result.ruleId).toBe('ISL/precondition/test-clause');
    expect(result.level).toBe('error');
    expect(result.message.text).toContain('Test failure message');
  });

  it('should include location when provided', () => {
    const result = createClauseFailureResult(
      'test-clause',
      'Test failure',
      'postcondition',
      { file: 'src/test.ts', line: 42, column: 5 }
    );

    expect(result.ruleId).toBe('ISL/postcondition/test-clause');
  });
});

describe('mergeSarifLogs', () => {
  it('should merge multiple logs into one', () => {
    const log1: SarifLog = {
      $schema: 'https://example.com/sarif.json',
      version: '2.1.0',
      runs: [{ tool: { driver: { name: 'Tool1', version: '1.0' } }, results: [] }],
    };
    const log2: SarifLog = {
      $schema: 'https://example.com/sarif.json',
      version: '2.1.0',
      runs: [{ tool: { driver: { name: 'Tool2', version: '1.0' } }, results: [] }],
    };

    const merged = mergeSarifLogs(log1, log2);

    expect(merged.runs).toHaveLength(2);
    expect(merged.runs[0].tool.driver.name).toBe('Tool1');
    expect(merged.runs[1].tool.driver.name).toBe('Tool2');
  });

  it('should handle empty logs array', () => {
    const merged = mergeSarifLogs();

    expect(merged.runs).toHaveLength(0);
  });
});
