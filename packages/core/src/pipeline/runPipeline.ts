/**
 * ISL Verification Pipeline
 *
 * Orchestrates the full ISL verification flow:
 * 1. Extract context from workspace
 * 2. Translate prompt to AST (or use provided AST)
 * 3. Validate AST structure
 * 4. Generate verification artifacts
 * 5. Run verification against codebase
 * 6. Compute score and generate evidence report
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Domain } from '@isl-lang/parser';
import { generateFingerprint } from '../cache/fingerprintCache.js';
import type {
  PipelineInput,
  PipelineOptions,
  PipelineResult,
  PipelineState,
  PipelineStatus,
} from './pipelineTypes.js';
import type { EvidenceReport, Assumption, OpenQuestion } from '../evidence/evidenceTypes.js';
import {
  runContextStep,
  runTranslateStep,
  runValidateStep,
  runGenerateStep,
  runVerifyStep,
  runScoreStep,
} from './steps/index.js';

/**
 * Default options for the pipeline
 */
const DEFAULTS: Omit<Required<PipelineOptions>, 'workspacePath'> = {
  outDir: '.vibecheck/reports',
  contextOptions: {},
  skipContext: false,
  writeReport: true,
  specName: '',
  specPath: '',
  mode: 'full',
  agentVersion: '1.0.0',
  notes: '',
  verbose: false,
  dryRun: false,
};

/**
 * Create initial pipeline state
 */
function createInitialState(
  input: PipelineInput,
  options: PipelineOptions
): PipelineState {
  return {
    startTime: performance.now(),
    input,
    options: {
      ...DEFAULTS,
      ...options,
    } as Required<PipelineOptions>,
    warnings: [],
    errors: [],
    stepResults: {},
  };
}

/**
 * Generate a deterministic fingerprint for the spec
 */
function generateSpecFingerprint(ast: Domain): string {
  // Create a deterministic representation of the AST for fingerprinting
  const fingerprintData = {
    name: ast.name?.name,
    version: ast.version?.value,
    entities: ast.entities.map((e) => ({
      name: e.name?.name,
      fieldCount: e.fields?.length || 0,
    })),
    behaviors: ast.behaviors.map((b) => ({
      name: b.name?.name,
      preCount: b.preconditions?.length || 0,
      postCount: b.postconditions?.length || 0,
    })),
    invariantCount: ast.invariants.length,
  };

  return generateFingerprint(fingerprintData);
}

/**
 * Build the evidence report from pipeline state
 */
function buildEvidenceReport(state: PipelineState): EvidenceReport {
  const now = new Date().toISOString();
  const startedAt = new Date(Date.now() - (performance.now() - state.startTime)).toISOString();

  // Get spec fingerprint
  const specFingerprint = state.ast
    ? generateSpecFingerprint(state.ast)
    : 'unknown-spec';

  // Build assumptions from warnings
  const assumptions: Assumption[] = state.warnings
    .filter((w) => w.includes('stub') || w.includes('skipped'))
    .map((w, i) => ({
      id: `assumption-${i + 1}`,
      description: w,
      category: 'environment' as const,
      impact: 'medium' as const,
    }));

  // Build open questions from validation issues
  const openQuestions: OpenQuestion[] = [];
  const validateResult = state.stepResults.validate;
  if (validateResult?.data && !validateResult.data.valid) {
    for (const issue of validateResult.data.issues) {
      openQuestions.push({
        id: `question-${openQuestions.length + 1}`,
        question: `Resolve validation issue: ${issue}`,
        priority: 'high',
        context: 'Detected during AST validation',
      });
    }
  }

  // Get score summary with defaults
  const scoreSummary = state.stepResults.score?.data?.summary || {
    overallScore: 0,
    passCount: 0,
    partialCount: 0,
    failCount: 0,
    totalClauses: 0,
    passRate: 0,
    confidence: 'low' as const,
    recommendation: 'block' as const,
  };

  return {
    version: '1.0',
    reportId: randomUUID(),
    specFingerprint,
    specName: state.options.specName || state.ast?.name?.name,
    specPath: state.options.specPath,
    clauseResults: state.clauseResults || [],
    scoreSummary,
    assumptions,
    openQuestions,
    artifacts: state.artifacts || [],
    metadata: {
      startedAt,
      completedAt: now,
      durationMs: Math.round(performance.now() - state.startTime),
      agentVersion: state.options.agentVersion,
      mode: state.options.mode,
    },
    notes: state.options.notes || undefined,
  };
}

/**
 * Write evidence report to disk
 */
async function writeEvidenceReport(
  report: EvidenceReport,
  workspacePath: string,
  outDir: string
): Promise<string> {
  // Use first 16 characters of fingerprint for filename (deterministic, no timestamp)
  const filename = `${report.specFingerprint.substring(0, 16)}.json`;

  // Resolve output directory
  const fullOutDir = path.isAbsolute(outDir)
    ? outDir
    : path.join(workspacePath, outDir);

  // Ensure directory exists
  await fs.mkdir(fullOutDir, { recursive: true });

  // Write report
  const reportPath = path.join(fullOutDir, filename);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  return reportPath;
}

/**
 * Determine overall pipeline status
 */
function determinePipelineStatus(state: PipelineState): PipelineStatus {
  const { stepResults } = state;

  // Check for critical failures
  if (
    stepResults.translate?.success === false ||
    stepResults.verify?.success === false
  ) {
    return 'failed';
  }

  // Check for partial success
  if (
    stepResults.validate?.data?.valid === false ||
    stepResults.score?.data?.summary?.recommendation === 'block'
  ) {
    return 'partial';
  }

  return 'success';
}

/**
 * Run the full ISL verification pipeline
 *
 * @param input - Pipeline input (prompt or AST)
 * @param options - Pipeline options
 * @returns Pipeline result with evidence report
 *
 * @example
 * ```typescript
 * // With pre-parsed AST
 * const result = await runPipeline(
 *   { mode: 'ast', ast: myParsedAst },
 *   { workspacePath: '/path/to/project' }
 * );
 *
 * console.log(result.report.scoreSummary.overallScore);
 * // => 85
 *
 * // With prompt (requires translator integration)
 * const result = await runPipeline(
 *   { mode: 'prompt', prompt: 'Create a user authentication system' },
 *   { workspacePath: '/path/to/project' }
 * );
 * ```
 */
export async function runPipeline(
  input: PipelineInput,
  options: PipelineOptions
): Promise<PipelineResult> {
  const state = createInitialState(input, options);

  try {
    // Step 1: Extract context
    if (state.options.verbose) {
      console.log('[Pipeline] Running context extraction...');
    }
    const contextResult = await runContextStep(state);
    state.stepResults.context = contextResult;
    state.warnings.push(...contextResult.warnings);
    if (contextResult.success && contextResult.data) {
      state.context = contextResult.data;
    }

    // Step 2: Translate/validate input
    if (state.options.verbose) {
      console.log('[Pipeline] Running translation/AST validation...');
    }
    const translateResult = await runTranslateStep(state);
    state.stepResults.translate = translateResult;
    state.warnings.push(...translateResult.warnings);
    if (translateResult.success && translateResult.data) {
      state.ast = translateResult.data;
    } else if (!translateResult.success) {
      state.errors.push(translateResult.error || 'Translation failed');
    }

    // Step 3: Validate AST (only if we have an AST)
    if (state.ast) {
      if (state.options.verbose) {
        console.log('[Pipeline] Running AST validation...');
      }
      const validateResult = await runValidateStep(state);
      state.stepResults.validate = validateResult;
      state.warnings.push(...validateResult.warnings);

      // Continue even if validation has issues - just log them
      if (validateResult.data && !validateResult.data.valid) {
        state.warnings.push(
          `Validation issues found: ${validateResult.data.issues.length}`
        );
      }
    }

    // Step 4: Generate artifacts (only if we have an AST)
    if (state.ast) {
      if (state.options.verbose) {
        console.log('[Pipeline] Running artifact generation...');
      }
      const generateResult = await runGenerateStep(state);
      state.stepResults.generate = generateResult;
      state.warnings.push(...generateResult.warnings);
      if (generateResult.success && generateResult.data) {
        state.generatedFiles = generateResult.data.filesGenerated;
      }
    }

    // Step 5: Run verification (only if we have an AST)
    if (state.ast) {
      if (state.options.verbose) {
        console.log('[Pipeline] Running verification...');
      }
      const verifyResult = await runVerifyStep(state);
      state.stepResults.verify = verifyResult;
      state.warnings.push(...verifyResult.warnings);
      if (verifyResult.success && verifyResult.data) {
        state.clauseResults = verifyResult.data.clauseResults;
        state.artifacts = verifyResult.data.artifacts;
      }
    }

    // Step 6: Compute score (only if we have clause results)
    if (state.clauseResults) {
      if (state.options.verbose) {
        console.log('[Pipeline] Computing score...');
      }
      const scoreResult = await runScoreStep(state);
      state.stepResults.score = scoreResult;
      state.warnings.push(...scoreResult.warnings);
      if (scoreResult.success && scoreResult.data) {
        state.scoringResult = scoreResult.data.scoringResult;
      }
    }

    // Build evidence report
    const report = buildEvidenceReport(state);

    // Write report to disk if enabled
    let reportPath: string | undefined;
    if (state.options.writeReport && !state.options.dryRun) {
      if (state.options.verbose) {
        console.log('[Pipeline] Writing evidence report...');
      }
      reportPath = await writeEvidenceReport(
        report,
        state.options.workspacePath,
        state.options.outDir
      );
    }

    // Determine final status
    const status = determinePipelineStatus(state);

    return {
      status,
      report,
      reportPath,
      steps: state.stepResults,
      totalDurationMs: Math.round(performance.now() - state.startTime),
      warnings: state.warnings,
      errors: state.errors,
    };
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    state.errors.push(`Pipeline error: ${errorMessage}`);

    // Still try to build a report
    const report = buildEvidenceReport(state);

    return {
      status: 'failed',
      report,
      steps: state.stepResults,
      totalDurationMs: Math.round(performance.now() - state.startTime),
      warnings: state.warnings,
      errors: state.errors,
    };
  }
}

/**
 * Convenience function to run pipeline with just an AST
 */
export async function runPipelineWithAst(
  ast: Domain,
  options: PipelineOptions
): Promise<PipelineResult> {
  return runPipeline({ mode: 'ast', ast }, options);
}

/**
 * Convenience function to run pipeline with just a prompt
 * Note: This will fail without translator integration
 */
export async function runPipelineWithPrompt(
  prompt: string,
  options: PipelineOptions
): Promise<PipelineResult> {
  return runPipeline({ mode: 'prompt', prompt }, options);
}
