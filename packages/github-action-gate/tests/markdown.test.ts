/**
 * Unit tests for markdown reporter
 */

import { describe, it, expect } from 'vitest';
import { generateMarkdownReport, generateStepSummary } from '../src/reporters/markdown.js';
import { GateReport } from '../src/types.js';

describe('generateMarkdownReport', () => {
  it('should generate report for SHIP verdict', () => {
    const report: GateReport = {
      verdict: 'SHIP',
      score: 95,
      totalFindings: 0,
      findingsBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      findings: [],
      fingerprint: 'abc123',
      durationMs: 1000,
    };

    const markdown = generateMarkdownReport(report);

    expect(markdown).toContain('✅ ISL Gate: SHIP');
    expect(markdown).toContain('**Score** | 95/100');
    expect(markdown).toContain('**Total Findings** | 0');
    expect(markdown).toContain('No findings found. Safe to merge!');
    expect(markdown).toContain('Evidence fingerprint: `abc123`');
  });

  it('should generate report with findings', () => {
    const report: GateReport = {
      verdict: 'NO_SHIP',
      score: 45,
      totalFindings: 2,
      findingsBySeverity: {
        critical: 1,
        high: 1,
        medium: 0,
        low: 0,
      },
      findings: [
        {
          id: '1',
          severity: 'critical',
          ruleId: 'parser:syntax-error',
          message: 'Syntax error in file',
          filePath: 'src/index.ts',
          line: 10,
          blocking: true,
          source: 'parser',
        },
        {
          id: '2',
          severity: 'high',
          ruleId: 'security:hardcoded-secret',
          message: 'Hardcoded secret detected',
          filePath: 'src/config.ts',
          line: 5,
          blocking: true,
          source: 'security',
        },
      ],
      fingerprint: 'def456',
      durationMs: 2000,
    };

    const markdown = generateMarkdownReport(report);

    expect(markdown).toContain('🛑 ISL Gate: NO_SHIP');
    expect(markdown).toContain('**Score** | 45/100');
    expect(markdown).toContain('**🛑 Critical** | 1');
    expect(markdown).toContain('**⚠️ High** | 1');
    expect(markdown).toContain('Findings (2)');
    expect(markdown).toContain('parser:syntax-error');
    expect(markdown).toContain('security:hardcoded-secret');
    expect(markdown).toContain('src/index.ts:10');
    expect(markdown).toContain('How to Fix');
  });

  it('should truncate long messages', () => {
    const report: GateReport = {
      verdict: 'NO_SHIP',
      score: 50,
      totalFindings: 1,
      findingsBySeverity: {
        critical: 0,
        high: 1,
        medium: 0,
        low: 0,
      },
      findings: [
        {
          id: '1',
          severity: 'high',
          ruleId: 'test:long-message',
          message: 'This is a very long message that should be truncated because it exceeds the maximum length limit for display in the markdown table',
          filePath: 'src/test.ts',
          line: 1,
          blocking: false,
          source: 'test',
        },
      ],
      durationMs: 500,
    };

    const markdown = generateMarkdownReport(report);

    expect(markdown).toContain('exceeds the m...');
  });

  it('should limit findings to 20', () => {
    const findings = Array.from({ length: 25 }, (_, i) => ({
      id: i.toString(),
      severity: 'medium' as const,
      ruleId: `rule:${i}`,
      message: `Finding ${i}`,
      filePath: `src/file${i}.ts`,
      line: i + 1,
      blocking: false,
      source: 'test',
    }));

    const report: GateReport = {
      verdict: 'NO_SHIP',
      score: 40,
      totalFindings: 25,
      findingsBySeverity: {
        critical: 0,
        high: 0,
        medium: 25,
        low: 0,
      },
      findings,
      durationMs: 3000,
    };

    const markdown = generateMarkdownReport(report);

    expect(markdown).toContain('...and 5 more findings');
  });
});

describe('generateStepSummary', () => {
  it('should generate step summary', () => {
    const report: GateReport = {
      verdict: 'SHIP',
      score: 90,
      totalFindings: 1,
      findingsBySeverity: {
        critical: 0,
        high: 0,
        medium: 1,
        low: 0,
      },
      findings: [],
      durationMs: 1000,
    };

    const summary = generateStepSummary(report);

    expect(summary).toContain('✅ ISL Gate Result');
    expect(summary).toContain('**Verdict:** SHIP');
    expect(summary).toContain('**Score:** 90/100');
    expect(summary).toContain('**Findings:** 1');
  });

  it('should show blocking issues', () => {
    const report: GateReport = {
      verdict: 'NO_SHIP',
      score: 30,
      totalFindings: 3,
      findingsBySeverity: {
        critical: 2,
        high: 1,
        medium: 0,
        low: 0,
      },
      findings: [],
      durationMs: 1000,
    };

    const summary = generateStepSummary(report);

    expect(summary).toContain('❌ ISL Gate Result');
    expect(summary).toContain('🚨 Blocking Issues');
    expect(summary).toContain('Critical: 2');
    expect(summary).toContain('High: 1');
  });
});
