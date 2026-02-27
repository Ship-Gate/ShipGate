/**
 * Tests for the targeted heal system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  RootCauseAnalyzer,
  buildFixPrompt,
  parseAIResponse,
  applySurgicalDiff,
  applySurgicalDiffs,
  formatHealReportPretty,
  createEmptyHealReport,
  HealPlanExecutor,
} from '../src/heal/index.js';
import type { VerificationFailureInput, AnalyzedFailure } from '../src/heal/types.js';

describe('RootCauseAnalyzer', () => {
  const analyzer = new RootCauseAnalyzer();

  it('categorizes IMPORT_ERROR', () => {
    const result = analyzer.analyzeEntry({
      file: 'src/auth.ts',
      blockers: ['Cannot find module "@/lib/db"'],
      errors: [],
    });
    expect(result[0]?.category).toBe('IMPORT_ERROR');
    expect(result[0]?.phase).toBe('structural');
  });

  it('categorizes TYPE_ERROR', () => {
    const result = analyzer.analyzeEntry({
      file: 'src/user.ts',
      blockers: ["Type 'string' is not assignable to type 'number'"],
      errors: [],
    });
    expect(result[0]?.category).toBe('TYPE_ERROR');
    expect(result[0]?.phase).toBe('types_impl');
  });

  it('categorizes MISSING_IMPLEMENTATION', () => {
    const result = analyzer.analyzeEntry({
      file: 'src/api.ts',
      blockers: ['TODO: implement createUser'],
      errors: [],
    });
    expect(result[0]?.category).toBe('MISSING_IMPLEMENTATION');
  });

  it('categorizes AUTH_MISSING', () => {
    const result = analyzer.analyzeEntry({
      file: 'src/routes.ts',
      blockers: ['Protected route without auth middleware'],
      errors: [],
    });
    expect(result[0]?.category).toBe('AUTH_MISSING');
  });

  it('categorizes TEST_FAILURE', () => {
    const result = analyzer.analyzeEntry({
      file: 'src/auth.test.ts',
      blockers: ['expect(received).toBe(expected)'],
      errors: [],
    });
    expect(result[0]?.category).toBe('TEST_FAILURE');
    expect(result[0]?.phase).toBe('tests');
  });

  it('categorizes SPEC_MISMATCH', () => {
    const result = analyzer.analyzeEntry({
      file: 'src/user.ts',
      blockers: ['Postcondition failed: createUser returns valid User'],
      errors: [],
    });
    expect(result[0]?.category).toBe('SPEC_MISMATCH');
  });

  it('extracts unresolved import path', () => {
    const result = analyzer.analyzeEntry({
      file: 'src/index.ts',
      blockers: ['Cannot find module \'@/missing/module\''],
      errors: [],
    });
    expect(result[0]?.unresolvedImport).toBeDefined();
  });

  it('extracts context snippet when sourceCode provided', () => {
    const source = 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10';
    const result = analyzer.analyzeEntry({
      file: 'src/foo.ts',
      blockers: ['Error at line 5'],
      errors: [],
      sourceCode: source,
    });
    expect(result[0]?.contextSnippet).toContain('line5');
  });
});

describe('buildFixPrompt', () => {
  it('builds IMPORT_ERROR prompt with unresolved import', () => {
    const failure: AnalyzedFailure = {
      file: 'src/auth.ts',
      category: 'IMPORT_ERROR',
      phase: 'structural',
      message: 'Cannot find module "@/lib/db"',
      unresolvedImport: '@/lib/db',
      contextSnippet: 'import { db } from "@/lib/db";',
    };
    const prompt = buildFixPrompt(failure);
    expect(prompt).toContain('IMPORT_ERROR');
    expect(prompt).toContain('@/lib/db');
    expect(prompt).toContain('Do NOT modify');
  });

  it('builds TYPE_ERROR prompt with context', () => {
    const failure: AnalyzedFailure = {
      file: 'src/user.ts',
      category: 'TYPE_ERROR',
      phase: 'types_impl',
      message: "Type 'string' is not assignable to type 'number'",
      location: { line: 42 },
      contextSnippet: 'return userId;',
    };
    const prompt = buildFixPrompt(failure);
    expect(prompt).toContain('TYPE_ERROR');
    expect(prompt).toContain('line 42');
  });
});

describe('parseAIResponse', () => {
  it('parses JSON array with path and content', () => {
    const response = '[{ "path": "src/auth.ts", "content": "export const x = 1;" }]';
    const parsed = parseAIResponse(response);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.path).toBe('src/auth.ts');
    expect(parsed[0]?.fullReplacement).toBe('export const x = 1;');
  });

  it('parses JSON array with path and diff', () => {
    const diffContent = '--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1 +1 @@\n-old\n+new';
    const response = JSON.stringify([{ path: 'src/foo.ts', diff: diffContent }]);
    const parsed = parseAIResponse(response);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.path).toBe('src/foo.ts');
    expect(parsed[0]?.diff).toContain('---');
  });

  it('returns empty array for invalid JSON', () => {
    const parsed = parseAIResponse('not json at all');
    expect(parsed).toHaveLength(0);
  });
});

describe('applySurgicalDiff', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'heal-test-'));
  });

  it('applies full replacement', async () => {
    const relPath = 'test.ts';
    await writeFile(join(tmpDir, relPath), 'const x = 1;', 'utf-8');

    const result = await applySurgicalDiff(
      { file: relPath, fullReplacement: 'const x = 2;' },
      tmpDir,
    );

    expect(result.success).toBe(true);
    expect(result.applied).toBe(true);
    const content = await readFile(join(tmpDir, relPath), 'utf-8');
    expect(content).toBe('const x = 2;');
  });

  it('rejects suspicious size ratio', async () => {
    const relPath = 'test.ts';
    await writeFile(join(tmpDir, relPath), 'const x = 1;', 'utf-8');

    const result = await applySurgicalDiff(
      { file: relPath, fullReplacement: 'x'.repeat(1000) },
      tmpDir,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Suspicious');
  });
});

describe('formatHealReportPretty', () => {
  it('formats report with iterations', () => {
    const report = {
      failuresBeforeHeal: 5,
      failuresAfterHeal: 2,
      verdict: 'NO_SHIP' as const,
      iterations: [
        {
          iteration: 1,
          phase: 'structural' as const,
          fixesApplied: ['src/auth.ts: applied'],
          failuresBefore: 5,
          failuresAfter: 3,
        },
      ],
    };
    const out = formatHealReportPretty(report);
    expect(out).toContain('Failures before heal: 5');
    expect(out).toContain('Failures after heal:  2');
    expect(out).toContain('structural');
  });
});

describe('createEmptyHealReport', () => {
  it('creates report with no iterations', () => {
    const report = createEmptyHealReport(3);
    expect(report.failuresBeforeHeal).toBe(3);
    expect(report.failuresAfterHeal).toBe(3);
    expect(report.iterations).toHaveLength(0);
    expect(report.verdict).toBe('NO_SHIP');
  });
});

describe('HealPlanExecutor', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'heal-plan-'));
  });

  it('builds plan and groups by phase', () => {
    const entries: VerificationFailureInput[] = [
      { file: 'src/a.ts', blockers: ['Cannot find module "x"'], errors: [] },
      { file: 'src/b.ts', blockers: ['Type error'], errors: [] },
    ];
    const executor = new HealPlanExecutor({ projectRoot: tmpDir });
    const plan = executor.buildPlan(entries);
    expect(plan.length).toBeGreaterThanOrEqual(1);
    const structural = plan.filter((p) => p.phase === 'structural');
    expect(structural.length).toBeGreaterThanOrEqual(1);
  });

  it('executes with mock AI and verify', async () => {
    const { mkdir } = await import('fs/promises');
    await mkdir(join(tmpDir, 'src'), { recursive: true });
    await writeFile(join(tmpDir, 'src', 'fixme.ts'), 'const x = 1;', 'utf-8');

    const entries: VerificationFailureInput[] = [
      { file: 'src/fixme.ts', blockers: ['Type error'], errors: [] },
    ];

    let verifyCount = 0;
    const executor = new HealPlanExecutor({
      projectRoot: tmpDir,
      maxIterations: 2,
      invokeAI: async () => {
        return JSON.stringify([{ path: 'src/fixme.ts', content: 'const x = 2;' }]);
      },
      verify: async () => {
        verifyCount++;
        return verifyCount >= 2 ? [] : entries;
      },
    });

    const { report, fixesApplied } = await executor.execute(entries);

    expect(fixesApplied.length).toBeGreaterThanOrEqual(1);
    expect(report.iterations.length).toBeGreaterThanOrEqual(1);
  });
});
