/**
 * Tests for ISL GitHub Action
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @actions/core
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  notice: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  startGroup: vi.fn(),
  endGroup: vi.fn(),
  summary: {
    addHeading: vi.fn().mockReturnThis(),
    addTable: vi.fn().mockReturnThis(),
    addRaw: vi.fn().mockReturnThis(),
    addSeparator: vi.fn().mockReturnThis(),
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock @actions/github
vi.mock('@actions/github', () => ({
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    payload: {},
  },
  getOctokit: vi.fn(),
}));

// Mock @actions/exec
vi.mock('@actions/exec', () => ({
  exec: vi.fn().mockResolvedValue(0),
}));

// Mock @actions/glob
vi.mock('@actions/glob', () => ({
  create: vi.fn().mockResolvedValue({
    glob: vi.fn().mockResolvedValue([]),
  }),
}));

import * as core from '@actions/core';
import { parseInputs, type ActionInputs } from '../src/inputs.js';
import { ISLChecker } from '../src/checker.js';
import { ISLVerifier, getVerdictEmoji, getVerdictDescription } from '../src/verifier.js';
import { formatReport, formatDuration, formatPercentage, type ActionReport } from '../src/reporter.js';
import { generateTextSummary, generatePRComment } from '../src/summary.js';
import { groupDiagnosticsByFile } from '../src/annotations.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockInputs(): ActionInputs {
  return {
    specs: 'src/**/*.isl',
    implementation: '',
    checkOnly: false,
    failOnWarning: false,
    failThreshold: 0,
    generateTypes: false,
    generateTests: false,
    uploadProofs: false,
    workingDirectory: '/test/workspace',
    nodeVersion: '20',
  };
}

function createMockReport(): ActionReport {
  return {
    verdict: 'verified',
    score: 94,
    errors: [],
    warnings: [],
    specsChecked: 5,
    coverage: {
      preconditions: 100,
      postconditions: 92,
      invariants: 100,
      temporal: 85,
    },
    duration: 1234,
  };
}

// ============================================================================
// Tests: Input Parser
// ============================================================================

describe('parseInputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse required inputs', () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === 'specs') return 'src/**/*.isl';
      return '';
    });
    vi.mocked(core.getBooleanInput).mockReturnValue(false);

    const inputs = parseInputs();

    expect(inputs.specs).toBe('src/**/*.isl');
    expect(inputs.checkOnly).toBe(false);
  });

  it('should parse all inputs correctly', () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      const values: Record<string, string> = {
        'specs': 'specs/**/*.isl',
        'implementation': 'src/auth.ts',
        'fail-threshold': '80',
        'working-directory': './project',
        'node-version': '18',
      };
      return values[name] || '';
    });
    vi.mocked(core.getBooleanInput).mockImplementation((name: string) => {
      return name === 'fail-on-warning' || name === 'generate-types';
    });

    const inputs = parseInputs();

    expect(inputs.specs).toBe('specs/**/*.isl');
    expect(inputs.implementation).toBe('src/auth.ts');
    expect(inputs.failThreshold).toBe(80);
    expect(inputs.failOnWarning).toBe(true);
    expect(inputs.generateTypes).toBe(true);
  });

  it('should handle invalid fail-threshold', () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === 'specs') return 'src/**/*.isl';
      if (name === 'fail-threshold') return 'invalid';
      return '';
    });
    vi.mocked(core.getBooleanInput).mockReturnValue(false);

    const inputs = parseInputs();

    expect(inputs.failThreshold).toBe(0);
    expect(core.warning).toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: Verifier
// ============================================================================

describe('ISLVerifier', () => {
  describe('getVerdictEmoji', () => {
    it('should return correct emoji for each verdict', () => {
      expect(getVerdictEmoji('verified')).toBe('✅');
      expect(getVerdictEmoji('risky')).toBe('⚠️');
      expect(getVerdictEmoji('unsafe')).toBe('❌');
      expect(getVerdictEmoji('checked')).toBe('✓');
      expect(getVerdictEmoji('unchecked')).toBe('❔');
    });
  });

  describe('getVerdictDescription', () => {
    it('should return correct description for each verdict', () => {
      expect(getVerdictDescription('verified')).toContain('verified');
      expect(getVerdictDescription('unsafe')).toContain('failed');
      expect(getVerdictDescription('risky')).toContain('not be fully verified');
    });
  });
});

// ============================================================================
// Tests: Reporter
// ============================================================================

describe('Reporter', () => {
  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(2500)).toBe('2.5s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage with bar', () => {
      const result = formatPercentage(75);
      expect(result).toContain('75%');
      expect(result).toContain('█');
      expect(result).toContain('░');
    });

    it('should handle 0%', () => {
      const result = formatPercentage(0);
      expect(result).toContain('0%');
    });

    it('should handle 100%', () => {
      const result = formatPercentage(100);
      expect(result).toContain('100%');
    });
  });

  describe('formatReport', () => {
    it('should format a successful report', () => {
      const report = createMockReport();
      const output = formatReport(report);

      expect(output).toContain('ISL Verification Report');
      expect(output).toContain('verified');
      expect(output).toContain('94/100');
      expect(output).toContain('5'); // specs checked
    });

    it('should include errors when present', () => {
      const report = createMockReport();
      report.errors = [
        {
          code: 'ISL001',
          message: 'Unknown type: Rolee',
          file: 'src/auth.isl',
          line: 15,
          column: 10,
          severity: 'error',
        },
      ];

      const output = formatReport(report);

      expect(output).toContain('Errors:');
      expect(output).toContain('ISL001');
      expect(output).toContain('Unknown type');
    });

    it('should include coverage metrics', () => {
      const report = createMockReport();
      const output = formatReport(report);

      expect(output).toContain('Coverage:');
      expect(output).toContain('100%');
      expect(output).toContain('92%');
      expect(output).toContain('85%');
    });
  });
});

// ============================================================================
// Tests: Summary
// ============================================================================

describe('Summary', () => {
  describe('generateTextSummary', () => {
    it('should generate text summary', () => {
      const report = createMockReport();
      const summary = generateTextSummary(report);

      expect(summary).toContain('ISL Verification Summary');
      expect(summary).toContain('VERIFIED');
      expect(summary).toContain('94/100');
    });
  });

  describe('generatePRComment', () => {
    it('should generate PR comment', () => {
      const report = createMockReport();
      const comment = generatePRComment(report);

      expect(comment).toContain('ISL Verification');
      expect(comment).toContain('VERIFIED');
      expect(comment).toContain('| Score | 94/100 |');
    });

    it('should include errors in PR comment', () => {
      const report = createMockReport();
      report.verdict = 'unsafe';
      report.errors = [
        {
          code: 'ISL001',
          message: 'Type error',
          file: 'test.isl',
          line: 10,
          column: 5,
          severity: 'error',
        },
      ];

      const comment = generatePRComment(report);

      expect(comment).toContain('Errors');
      expect(comment).toContain('ISL001');
    });
  });
});

// ============================================================================
// Tests: Annotations
// ============================================================================

describe('Annotations', () => {
  describe('groupDiagnosticsByFile', () => {
    it('should group diagnostics by file', () => {
      const diagnostics = [
        { code: 'E1', message: 'Error 1', file: 'a.isl', line: 1, column: 1, severity: 'error' as const },
        { code: 'E2', message: 'Error 2', file: 'b.isl', line: 2, column: 1, severity: 'error' as const },
        { code: 'E3', message: 'Error 3', file: 'a.isl', line: 3, column: 1, severity: 'error' as const },
      ];

      const grouped = groupDiagnosticsByFile(diagnostics);

      expect(grouped.size).toBe(2);
      expect(grouped.get('a.isl')).toHaveLength(2);
      expect(grouped.get('b.isl')).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const grouped = groupDiagnosticsByFile([]);
      expect(grouped.size).toBe(0);
    });
  });
});

// ============================================================================
// Tests: Checker
// ============================================================================

describe('ISLChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create checker with inputs', () => {
    const inputs = createMockInputs();
    const checker = new ISLChecker(inputs);
    expect(checker).toBeDefined();
  });

  it('should handle no spec files found', async () => {
    const inputs = createMockInputs();
    const checker = new ISLChecker(inputs);
    
    const result = await checker.check();

    expect(result.specsChecked).toBe(0);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration', () => {
  it('should format complete verification flow', () => {
    // Create a full report
    const report: ActionReport = {
      verdict: 'risky',
      score: 78,
      errors: [
        {
          code: 'ISL002',
          message: 'Postcondition may not hold',
          file: 'src/payment.isl',
          line: 45,
          column: 8,
          severity: 'error',
        },
      ],
      warnings: [
        {
          code: 'ISL101',
          message: 'Consider adding temporal constraints',
          file: 'src/payment.isl',
          line: 12,
          column: 1,
          severity: 'warning',
        },
      ],
      specsChecked: 3,
      coverage: {
        preconditions: 100,
        postconditions: 65,
        invariants: 80,
        temporal: 50,
      },
      duration: 3456,
    };

    // Format the report
    const formatted = formatReport(report);
    const textSummary = generateTextSummary(report);
    const prComment = generatePRComment(report);

    // Verify all outputs contain expected content
    expect(formatted).toContain('risky');
    expect(formatted).toContain('78/100');
    expect(formatted).toContain('ISL002');

    expect(textSummary).toContain('RISKY');
    expect(textSummary).toContain('65%');

    expect(prComment).toContain('ISL002');
    expect(prComment).toContain('Postcondition');
  });
});
