/**
 * Pipeline Unit Tests
 *
 * Tests for the ISL verification pipeline.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import {
  runPipeline,
  runPipelineWithAst,
  runPipelineWithPrompt,
} from '../runPipeline.js';
import {
  runContextStep,
  runTranslateStep,
  runValidateStep,
  runVerifyStep,
  runScoreStep,
  isValidDomainAst,
} from '../steps/index.js';
import { MINIMAL_AST, EMPTY_AST, COMPLEX_AST } from '../fixtures/minimal-ast.js';
import type { PipelineState, PipelineOptions } from '../pipelineTypes.js';

// Get test workspace path
const TEST_WORKSPACE = path.resolve(
  __dirname,
  '../fixtures/test-workspace'
);

describe('Pipeline', () => {
  describe('runPipeline', () => {
    describe('with AST input', () => {
      it('should produce a report with score and clause results', async () => {
        const result = await runPipeline(
          { mode: 'ast', ast: MINIMAL_AST },
          {
            workspacePath: TEST_WORKSPACE,
            writeReport: false,
            skipContext: true,
            dryRun: true,
          }
        );

        // Should succeed
        expect(result.status).toBe('success');

        // Should have a report
        expect(result.report).toBeDefined();
        expect(result.report.version).toBe('1.0');
        expect(result.report.reportId).toBeDefined();
        expect(result.report.specFingerprint).toBeDefined();

        // Should have clause results
        expect(result.report.clauseResults).toBeDefined();
        expect(Array.isArray(result.report.clauseResults)).toBe(true);
        expect(result.report.clauseResults.length).toBeGreaterThan(0);

        // Should have score summary
        expect(result.report.scoreSummary).toBeDefined();
        expect(typeof result.report.scoreSummary.overallScore).toBe('number');
        expect(result.report.scoreSummary.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.report.scoreSummary.overallScore).toBeLessThanOrEqual(100);

        // Should have metadata
        expect(result.report.metadata).toBeDefined();
        expect(result.report.metadata.startedAt).toBeDefined();
        expect(result.report.metadata.completedAt).toBeDefined();
        expect(result.report.metadata.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should handle empty AST', async () => {
        const result = await runPipeline(
          { mode: 'ast', ast: EMPTY_AST },
          {
            workspacePath: TEST_WORKSPACE,
            writeReport: false,
            skipContext: true,
            dryRun: true,
          }
        );

        expect(result.status).toBe('success');
        expect(result.report.clauseResults).toHaveLength(0);
        expect(result.report.scoreSummary.totalClauses).toBe(0);
      });

      it('should handle complex AST with multiple entities and behaviors', async () => {
        const result = await runPipeline(
          { mode: 'ast', ast: COMPLEX_AST },
          {
            workspacePath: TEST_WORKSPACE,
            writeReport: false,
            skipContext: true,
            dryRun: true,
          }
        );

        expect(result.status).toBe('success');
        expect(result.report.clauseResults.length).toBeGreaterThan(5);
        expect(result.report.specName).toBe('PaymentSystem');
      });

      it('should include spec name from AST', async () => {
        const result = await runPipeline(
          { mode: 'ast', ast: MINIMAL_AST },
          {
            workspacePath: TEST_WORKSPACE,
            writeReport: false,
            skipContext: true,
            dryRun: true,
          }
        );

        expect(result.report.specName).toBe('MinimalDomain');
      });

      it('should generate deterministic fingerprint', async () => {
        const result1 = await runPipeline(
          { mode: 'ast', ast: MINIMAL_AST },
          { workspacePath: TEST_WORKSPACE, writeReport: false, skipContext: true, dryRun: true }
        );

        const result2 = await runPipeline(
          { mode: 'ast', ast: MINIMAL_AST },
          { workspacePath: TEST_WORKSPACE, writeReport: false, skipContext: true, dryRun: true }
        );

        // Same AST should produce same fingerprint
        expect(result1.report.specFingerprint).toBe(result2.report.specFingerprint);

        // Different AST should produce different fingerprint
        const result3 = await runPipeline(
          { mode: 'ast', ast: COMPLEX_AST },
          { workspacePath: TEST_WORKSPACE, writeReport: false, skipContext: true, dryRun: true }
        );
        expect(result1.report.specFingerprint).not.toBe(result3.report.specFingerprint);
      });
    });

    describe('with prompt input', () => {
      it('should fail without translator integration', async () => {
        const result = await runPipeline(
          { mode: 'prompt', prompt: 'Create a user system' },
          {
            workspacePath: TEST_WORKSPACE,
            writeReport: false,
            skipContext: true,
            dryRun: true,
          }
        );

        expect(result.status).toBe('failed');
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('translation');
      });
    });

    describe('report writing', () => {
      let tempDir: string;

      beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `pipeline-test-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });
      });

      afterEach(async () => {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      });

      it('should write report to disk when enabled', async () => {
        const outDir = path.join(tempDir, 'reports');

        const result = await runPipeline(
          { mode: 'ast', ast: MINIMAL_AST },
          {
            workspacePath: tempDir,
            outDir,
            writeReport: true,
            skipContext: true,
          }
        );

        expect(result.reportPath).toBeDefined();
        expect(result.reportPath).toContain(outDir);

        // Verify file exists
        const stat = await fs.stat(result.reportPath!);
        expect(stat.isFile()).toBe(true);

        // Verify content is valid JSON
        const content = await fs.readFile(result.reportPath!, 'utf-8');
        const parsed = JSON.parse(content);
        expect(parsed.version).toBe('1.0');
        expect(parsed.specFingerprint).toBe(result.report.specFingerprint);
      });

      it('should use deterministic filename based on fingerprint', async () => {
        const outDir = path.join(tempDir, 'reports');

        const result = await runPipeline(
          { mode: 'ast', ast: MINIMAL_AST },
          {
            workspacePath: tempDir,
            outDir,
            writeReport: true,
            skipContext: true,
          }
        );

        const filename = path.basename(result.reportPath!);
        // Filename should be first 16 chars of fingerprint + .json
        expect(filename).toMatch(/^[a-f0-9]{16}\.json$/);
        expect(filename.replace('.json', '')).toBe(
          result.report.specFingerprint.substring(0, 16)
        );
      });

      it('should not write in dry run mode', async () => {
        const outDir = path.join(tempDir, 'reports');

        const result = await runPipeline(
          { mode: 'ast', ast: MINIMAL_AST },
          {
            workspacePath: tempDir,
            outDir,
            writeReport: true,
            dryRun: true,
            skipContext: true,
          }
        );

        expect(result.reportPath).toBeUndefined();

        // Directory should not exist
        await expect(fs.stat(outDir)).rejects.toThrow();
      });
    });

    describe('step results', () => {
      it('should include all step results', async () => {
        const result = await runPipeline(
          { mode: 'ast', ast: MINIMAL_AST },
          {
            workspacePath: TEST_WORKSPACE,
            writeReport: false,
            skipContext: true,
            dryRun: true,
          }
        );

        // Should have step results
        expect(result.steps.context).toBeDefined();
        expect(result.steps.translate).toBeDefined();
        expect(result.steps.validate).toBeDefined();
        expect(result.steps.generate).toBeDefined();
        expect(result.steps.verify).toBeDefined();
        expect(result.steps.score).toBeDefined();

        // All steps should succeed
        expect(result.steps.context?.success).toBe(true);
        expect(result.steps.translate?.success).toBe(true);
        expect(result.steps.validate?.success).toBe(true);
        expect(result.steps.verify?.success).toBe(true);
        expect(result.steps.score?.success).toBe(true);
      });

      it('should track duration for each step', async () => {
        const result = await runPipeline(
          { mode: 'ast', ast: MINIMAL_AST },
          {
            workspacePath: TEST_WORKSPACE,
            writeReport: false,
            skipContext: true,
            dryRun: true,
          }
        );

        // Each step should have duration
        expect(result.steps.context?.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.steps.translate?.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.steps.validate?.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.steps.verify?.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.steps.score?.durationMs).toBeGreaterThanOrEqual(0);

        // Total duration should be sum of steps
        expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('runPipelineWithAst', () => {
    it('should be a convenience wrapper for runPipeline with ast mode', async () => {
      const result = await runPipelineWithAst(MINIMAL_AST, {
        workspacePath: TEST_WORKSPACE,
        writeReport: false,
        skipContext: true,
        dryRun: true,
      });

      expect(result.status).toBe('success');
      expect(result.report.specName).toBe('MinimalDomain');
    });
  });

  describe('runPipelineWithPrompt', () => {
    it('should be a convenience wrapper for runPipeline with prompt mode', async () => {
      const result = await runPipelineWithPrompt('Create users', {
        workspacePath: TEST_WORKSPACE,
        writeReport: false,
        skipContext: true,
        dryRun: true,
      });

      expect(result.status).toBe('failed');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Pipeline Steps', () => {
  describe('runContextStep', () => {
    it('should return stub context when skipContext is true', async () => {
      const state: PipelineState = {
        startTime: performance.now(),
        input: { mode: 'ast', ast: MINIMAL_AST },
        options: {
          workspacePath: TEST_WORKSPACE,
          outDir: '.vibecheck/reports',
          contextOptions: {},
          skipContext: true,
          writeReport: false,
          specName: '',
          specPath: '',
          mode: 'full',
          agentVersion: '1.0.0',
          notes: '',
          verbose: false,
          dryRun: true,
        },
        warnings: [],
        errors: [],
        stepResults: {},
      };

      const result = await runContextStep(state);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.stack.language).toBe('unknown');
      expect(result.warnings.some((w) => w.includes('stub'))).toBe(true);
    });
  });

  describe('runTranslateStep', () => {
    it('should pass through provided AST', async () => {
      const state: PipelineState = {
        startTime: performance.now(),
        input: { mode: 'ast', ast: MINIMAL_AST },
        options: {
          workspacePath: TEST_WORKSPACE,
          outDir: '.vibecheck/reports',
          contextOptions: {},
          skipContext: true,
          writeReport: false,
          specName: '',
          specPath: '',
          mode: 'full',
          agentVersion: '1.0.0',
          notes: '',
          verbose: false,
          dryRun: true,
        },
        warnings: [],
        errors: [],
        stepResults: {},
      };

      const result = await runTranslateStep(state);

      expect(result.success).toBe(true);
      expect(result.wasProvided).toBe(true);
      expect(result.data).toBe(MINIMAL_AST);
    });

    it('should fail for prompt input without translator', async () => {
      const state: PipelineState = {
        startTime: performance.now(),
        input: { mode: 'prompt', prompt: 'test' },
        options: {
          workspacePath: TEST_WORKSPACE,
          outDir: '.vibecheck/reports',
          contextOptions: {},
          skipContext: true,
          writeReport: false,
          specName: '',
          specPath: '',
          mode: 'full',
          agentVersion: '1.0.0',
          notes: '',
          verbose: false,
          dryRun: true,
        },
        warnings: [],
        errors: [],
        stepResults: {},
      };

      const result = await runTranslateStep(state);

      expect(result.success).toBe(false);
      expect(result.wasProvided).toBe(false);
      expect(result.error).toContain('translation');
    });
  });

  describe('runValidateStep', () => {
    it('should validate valid AST', async () => {
      const state: PipelineState = {
        startTime: performance.now(),
        input: { mode: 'ast', ast: MINIMAL_AST },
        ast: MINIMAL_AST,
        options: {
          workspacePath: TEST_WORKSPACE,
          outDir: '.vibecheck/reports',
          contextOptions: {},
          skipContext: true,
          writeReport: false,
          specName: '',
          specPath: '',
          mode: 'full',
          agentVersion: '1.0.0',
          notes: '',
          verbose: false,
          dryRun: true,
        },
        warnings: [],
        errors: [],
        stepResults: {},
      };

      const result = await runValidateStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.issues).toHaveLength(0);
    });

    it('should fail without AST', async () => {
      const state: PipelineState = {
        startTime: performance.now(),
        input: { mode: 'ast', ast: MINIMAL_AST },
        // No ast set
        options: {
          workspacePath: TEST_WORKSPACE,
          outDir: '.vibecheck/reports',
          contextOptions: {},
          skipContext: true,
          writeReport: false,
          specName: '',
          specPath: '',
          mode: 'full',
          agentVersion: '1.0.0',
          notes: '',
          verbose: false,
          dryRun: true,
        },
        warnings: [],
        errors: [],
        stepResults: {},
      };

      const result = await runValidateStep(state);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No AST');
    });
  });

  describe('runVerifyStep', () => {
    it('should extract and verify clauses from AST', async () => {
      const state: PipelineState = {
        startTime: performance.now(),
        input: { mode: 'ast', ast: MINIMAL_AST },
        ast: MINIMAL_AST,
        options: {
          workspacePath: TEST_WORKSPACE,
          outDir: '.vibecheck/reports',
          contextOptions: {},
          skipContext: true,
          writeReport: false,
          specName: '',
          specPath: '',
          mode: 'full',
          agentVersion: '1.0.0',
          notes: '',
          verbose: false,
          dryRun: true,
        },
        warnings: [],
        errors: [],
        stepResults: {},
      };

      const result = await runVerifyStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.clauseResults).toBeDefined();
      expect(result.data?.clauseResults.length).toBeGreaterThan(0);
      expect(result.data?.artifacts).toBeDefined();

      // Check clause result structure
      const firstClause = result.data?.clauseResults[0];
      expect(firstClause?.clauseId).toBeDefined();
      expect(firstClause?.state).toMatch(/^(PASS|PARTIAL|FAIL)$/);
    });

    it('should return empty results for empty AST', async () => {
      const state: PipelineState = {
        startTime: performance.now(),
        input: { mode: 'ast', ast: EMPTY_AST },
        ast: EMPTY_AST,
        options: {
          workspacePath: TEST_WORKSPACE,
          outDir: '.vibecheck/reports',
          contextOptions: {},
          skipContext: true,
          writeReport: false,
          specName: '',
          specPath: '',
          mode: 'full',
          agentVersion: '1.0.0',
          notes: '',
          verbose: false,
          dryRun: true,
        },
        warnings: [],
        errors: [],
        stepResults: {},
      };

      const result = await runVerifyStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.clauseResults).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes('No clauses'))).toBe(true);
    });
  });

  describe('runScoreStep', () => {
    it('should compute score from clause results', async () => {
      const clauseResults = [
        { clauseId: 'test.1', state: 'PASS' as const, message: 'ok' },
        { clauseId: 'test.2', state: 'PASS' as const, message: 'ok' },
        { clauseId: 'test.3', state: 'PARTIAL' as const, message: 'partial' },
      ];

      const state: PipelineState = {
        startTime: performance.now(),
        input: { mode: 'ast', ast: MINIMAL_AST },
        ast: MINIMAL_AST,
        clauseResults,
        options: {
          workspacePath: TEST_WORKSPACE,
          outDir: '.vibecheck/reports',
          contextOptions: {},
          skipContext: true,
          writeReport: false,
          specName: '',
          specPath: '',
          mode: 'full',
          agentVersion: '1.0.0',
          notes: '',
          verbose: false,
          dryRun: true,
        },
        warnings: [],
        errors: [],
        stepResults: {},
      };

      const result = await runScoreStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.scoringResult).toBeDefined();
      expect(result.data?.summary).toBeDefined();

      // Check score
      expect(result.data?.scoringResult.score).toBeGreaterThan(0);
      expect(result.data?.summary.totalClauses).toBe(3);
      expect(result.data?.summary.passCount).toBe(2);
      expect(result.data?.summary.partialCount).toBe(1);
    });

    it('should fail without clause results', async () => {
      const state: PipelineState = {
        startTime: performance.now(),
        input: { mode: 'ast', ast: MINIMAL_AST },
        ast: MINIMAL_AST,
        // No clauseResults
        options: {
          workspacePath: TEST_WORKSPACE,
          outDir: '.vibecheck/reports',
          contextOptions: {},
          skipContext: true,
          writeReport: false,
          specName: '',
          specPath: '',
          mode: 'full',
          agentVersion: '1.0.0',
          notes: '',
          verbose: false,
          dryRun: true,
        },
        warnings: [],
        errors: [],
        stepResults: {},
      };

      const result = await runScoreStep(state);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No clause results');
    });
  });

  describe('isValidDomainAst', () => {
    it('should validate valid Domain AST', () => {
      expect(isValidDomainAst(MINIMAL_AST)).toBe(true);
      expect(isValidDomainAst(EMPTY_AST)).toBe(true);
      expect(isValidDomainAst(COMPLEX_AST)).toBe(true);
    });

    it('should reject invalid objects', () => {
      expect(isValidDomainAst(null)).toBe(false);
      expect(isValidDomainAst(undefined)).toBe(false);
      expect(isValidDomainAst({})).toBe(false);
      expect(isValidDomainAst({ kind: 'NotDomain' })).toBe(false);
      expect(isValidDomainAst({ kind: 'Domain', name: null })).toBe(false);
    });
  });
});

describe('Fixture-based Tests', () => {
  it('should work with test-workspace fixture', async () => {
    const result = await runPipeline(
      { mode: 'ast', ast: MINIMAL_AST },
      {
        workspacePath: TEST_WORKSPACE,
        writeReport: false,
        skipContext: false, // Try to extract context
      }
    );

    // Should succeed even with context extraction
    expect(result.status).toBe('success');

    // Context step should complete (with stub or real data)
    expect(result.steps.context?.success).toBe(true);
  });
});

describe('Evidence Report Structure', () => {
  it('should produce valid evidence report schema', async () => {
    const result = await runPipeline(
      { mode: 'ast', ast: COMPLEX_AST },
      {
        workspacePath: TEST_WORKSPACE,
        writeReport: false,
        skipContext: true,
        dryRun: true,
      }
    );

    const report = result.report;

    // Required top-level fields
    expect(report.version).toBe('1.0');
    expect(typeof report.reportId).toBe('string');
    expect(typeof report.specFingerprint).toBe('string');
    expect(report.specFingerprint.length).toBe(64); // SHA-256 hex

    // Clause results structure
    expect(Array.isArray(report.clauseResults)).toBe(true);
    for (const clause of report.clauseResults) {
      expect(typeof clause.clauseId).toBe('string');
      expect(['PASS', 'PARTIAL', 'FAIL']).toContain(clause.state);
    }

    // Score summary structure
    expect(typeof report.scoreSummary.overallScore).toBe('number');
    expect(typeof report.scoreSummary.passCount).toBe('number');
    expect(typeof report.scoreSummary.partialCount).toBe('number');
    expect(typeof report.scoreSummary.failCount).toBe('number');
    expect(typeof report.scoreSummary.totalClauses).toBe('number');
    expect(typeof report.scoreSummary.passRate).toBe('number');
    expect(['low', 'medium', 'high']).toContain(report.scoreSummary.confidence);
    expect(['ship', 'review', 'block']).toContain(report.scoreSummary.recommendation);

    // Metadata structure
    expect(typeof report.metadata.startedAt).toBe('string');
    expect(typeof report.metadata.completedAt).toBe('string');
    expect(typeof report.metadata.durationMs).toBe('number');
    expect(typeof report.metadata.agentVersion).toBe('string');

    // Optional arrays
    expect(Array.isArray(report.assumptions)).toBe(true);
    expect(Array.isArray(report.openQuestions)).toBe(true);
    expect(Array.isArray(report.artifacts)).toBe(true);
  });
});
