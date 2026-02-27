/**
 * PR Analysis - Main Analyzer
 *
 * The primary entry point: runs `git diff` against the local repo,
 * discovers specs, classifies files, scores risk, and builds a
 * verification plan — all without touching the GitHub API.
 *
 * @module @isl-lang/gate/pr-analysis
 */

import { resolve } from 'path';

import type {
  PRAnalysis,
  AnalyzePROptions,
  VerificationPlan,
  ResolvedPRAnalysisConfig,
} from './types.js';

import { getChangedFiles } from './diff-parser.js';
import { isISLSpec } from './file-classifier.js';
import { resolveConfig } from './file-classifier.js';
import { discoverSpecs, findAffectedSpecs } from './spec-matcher.js';
import { calculatePRRisk, riskLabel } from './risk-scorer.js';
import { selectFilesForVerification } from './file-selector.js';

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Analyze a pull request by diffing two git refs locally.
 *
 * @example
 * ```typescript
 * import { analyzePR } from '@isl-lang/gate/pr-analysis';
 *
 * const analysis = await analyzePR({
 *   baseBranch: 'main',
 *   headRef: 'HEAD',
 * });
 *
 * console.log(`Risk: ${analysis.riskScore}/100 (${analysis.riskLabel})`);
 * console.log(`Files changed: ${analysis.changedFiles.length}`);
 * ```
 */
export async function analyzePR(
  options: AnalyzePROptions = {},
): Promise<PRAnalysis> {
  const baseBranch = options.baseBranch ?? 'main';
  const headRef = options.headRef ?? 'HEAD';
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const config = resolveConfig(options.config);

  // ── Step 1: Get changed files from git ──────────────────────────────
  const changedFiles = await getChangedFiles({
    baseBranch,
    headRef,
    cwd: projectRoot,
  });

  // ── Step 2: Discover available ISL specs ────────────────────────────
  const specRoot = resolve(projectRoot, config.specRoot);
  const availableSpecs = await discoverSpecs(specRoot);

  // ── Step 3: Categorize changes ──────────────────────────────────────
  const changedPaths = changedFiles.map((f) => f.path);
  const newFiles = changedFiles
    .filter((f) => f.changeType === 'added')
    .map((f) => f.path);
  const specChanges = changedFiles
    .filter((f) => isISLSpec(f.path))
    .map((f) => f.path);
  const affectedSpecs = findAffectedSpecs(changedPaths, availableSpecs);

  // ── Step 4: Build partial analysis for risk scoring ─────────────────
  const analysis: PRAnalysis = {
    changedFiles,
    affectedSpecs,
    newFiles,
    specChanges,
    riskScore: 0,
    riskLabel: 'low',
    baseBranch,
    headRef,
  };

  // ── Step 5: Calculate risk ──────────────────────────────────────────
  analysis.riskScore = calculatePRRisk(analysis);
  analysis.riskLabel = riskLabel(analysis.riskScore);

  return analysis;
}

// ============================================================================
// Plan Builder
// ============================================================================

/**
 * Build a verification plan from a PR analysis.
 *
 * @example
 * ```typescript
 * const analysis = await analyzePR();
 * const plan = await buildVerificationPlan(analysis, {
 *   projectRoot: '/my/project',
 * });
 *
 * for (const { file, spec } of plan.fullVerify) {
 *   console.log(`Verify ${file.path} against ${spec}`);
 * }
 * ```
 */
export async function buildVerificationPlan(
  analysis: PRAnalysis,
  options: {
    projectRoot?: string;
    config?: Partial<ResolvedPRAnalysisConfig>;
  } = {},
): Promise<VerificationPlan> {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const config = resolveConfig(options.config);
  const specRoot = resolve(projectRoot, config.specRoot);
  const availableSpecs = await discoverSpecs(specRoot);

  return selectFilesForVerification(analysis, config, availableSpecs);
}

// ============================================================================
// Format Helpers (re-export)
// ============================================================================

export { formatVerificationPlan } from './file-selector.js';
export { riskSummary } from './risk-scorer.js';
