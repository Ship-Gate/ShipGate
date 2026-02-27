/**
 * Unit tests for annotations reporter
 */

import { describe, it, expect } from 'vitest';
import { generateAnnotations, generateCheckRunOutput } from '../src/reporters/annotations.js';
import { Finding } from '../src/types.js';

describe('generateAnnotations', () => {
  it('should convert findings to annotations', () => {
    const findings: Finding[] = [
      {
        id: '1',
        severity: 'critical',
        ruleId: 'security:secret',
        message: 'Hardcoded secret detected',
        filePath: 'src/config.ts',
        line: 10,
        column: 5,
        blocking: true,
        source: 'security',
      },
      {
        id: '2',
        severity: 'medium',
        ruleId: 'style:unused',
        message: 'Unused variable',
        filePath: 'src/utils.ts',
        line: 20,
        blocking: false,
        source: 'linter',
      },
    ];

    const annotations = generateAnnotations(findings);

    expect(annotations).toHaveLength(2);

    // First annotation
    expect(annotations[0]).toMatchObject({
      path: 'src/config.ts',
      start_line: 10,
      end_line: 10,
      start_column: 5,
      end_column: 5,
      annotation_level: 'failure',
      message: 'Hardcoded secret detected',
      title: 'security:secret: critical',
    });

    // Second annotation
    expect(annotations[1]).toMatchObject({
      path: 'src/utils.ts',
      start_line: 20,
      end_line: 20,
      annotation_level: 'warning',
      message: 'Unused variable',
      title: 'style:unused: medium',
    });
  });

  it('should handle findings without file paths', () => {
    const findings: Finding[] = [
      {
        id: '1',
        severity: 'high',
        ruleId: 'general:issue',
        message: 'General issue without file',
        blocking: true,
        source: 'general',
      },
    ];

    const annotations = generateAnnotations(findings);

    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toMatchObject({
      path: '.github',
      start_line: 1,
      end_line: 1,
      annotation_level: 'failure',
      message: 'General issue without file',
      title: 'general:issue: high',
    });
  });

  it('should limit annotations to max count', () => {
    const findings: Finding[] = Array.from({ length: 60 }, (_, i) => ({
      id: i.toString(),
      severity: 'low' as const,
      ruleId: `rule:${i}`,
      message: `Finding ${i}`,
      filePath: `src/file${i}.ts`,
      line: i + 1,
      blocking: false,
      source: 'test',
    }));

    const annotations = generateAnnotations(findings, 50);

    expect(annotations).toHaveLength(50);
  });

  it('should sort by severity and blocking status', () => {
    const findings: Finding[] = [
      {
        id: '1',
        severity: 'low',
        ruleId: 'rule:low',
        message: 'Low severity',
        blocking: false,
        source: 'test',
      },
      {
        id: '2',
        severity: 'critical',
        ruleId: 'rule:critical',
        message: 'Critical severity',
        blocking: true,
        source: 'test',
      },
      {
        id: '3',
        severity: 'high',
        ruleId: 'rule:high',
        message: 'High severity',
        blocking: false,
        source: 'test',
      },
    ];

    const annotations = generateAnnotations(findings);

    // Critical should come first
    expect(annotations[0].title).toContain('critical');
    expect(annotations[1].title).toContain('high');
    expect(annotations[2].title).toContain('low');
  });
});

describe('generateCheckRunOutput', () => {
  it('should generate check run output', () => {
    const findings: Finding[] = [
      {
        id: '1',
        severity: 'high',
        ruleId: 'rule:test',
        message: 'Test finding',
        filePath: 'src/test.ts',
        line: 10,
        blocking: true,
        source: 'test',
      },
    ];

    const output = generateCheckRunOutput(
      'Test Check',
      'Test summary',
      findings
    );

    expect(output).toMatchObject({
      title: 'Test Check',
      summary: 'Test summary',
      annotations: expect.any(Array),
    });

    expect(output.annotations).toHaveLength(1);
    expect(output.annotations![0]).toMatchObject({
      path: 'src/test.ts',
      annotation_level: 'failure',
      message: 'Test finding',
    });
  });

  it('should include detailed text for many findings', () => {
    const findings: Finding[] = Array.from({ length: 60 }, (_, i) => ({
      id: i.toString(),
      severity: 'low' as const,
      ruleId: `rule:${i}`,
      message: `Finding ${i}`,
      filePath: `src/file${i}.ts`,
      line: i + 1,
      blocking: false,
      source: 'test',
    }));

    const output = generateCheckRunOutput(
      'Test Check',
      'Test summary',
      findings
    );

    expect(output.text).toBeDefined();
    expect(output.text).toContain('Additional Findings (10)');
    expect(output.annotations).toHaveLength(50);
  });
});
