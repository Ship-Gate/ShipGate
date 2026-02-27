/**
 * PR Analysis Module
 *
 * Analyzes pull request diffs to intelligently select which files
 * need verification. Produces a smart verification plan that skips
 * tests/config/types and focuses on changed source code — especially
 * code on critical paths (auth, payments, security).
 *
 * Works entirely from local git — no GitHub API required.
 *
 * @module @isl-lang/gate/pr-analysis
 *
 * @example
 * ```typescript
 * import {
 *   analyzePR,
 *   buildVerificationPlan,
 *   formatVerificationPlan,
 *   riskSummary,
 * } from '@isl-lang/gate/pr-analysis';
 *
 * // Analyze the current branch against main
 * const analysis = await analyzePR({ baseBranch: 'main' });
 * console.log(riskSummary(analysis));
 *
 * // Build a plan for what to verify
 * const plan = await buildVerificationPlan(analysis);
 * console.log(formatVerificationPlan(plan));
 * ```
 */

// ── Main entry points ─────────────────────────────────────────────────
export { analyzePR, buildVerificationPlan, formatVerificationPlan, riskSummary } from './analyzer.js';

// ── Diff parsing ──────────────────────────────────────────────────────
export { getChangedFiles, parseNameStatus, mergeNumstat, mergeHunks } from './diff-parser.js';

// ── File classification ───────────────────────────────────────────────
export {
  isTestFile,
  isTypeOnly,
  isConfigFile,
  isCriticalPath,
  isISLSpec,
  isSourceFile,
  resolveConfig,
} from './file-classifier.js';

// ── Spec matching ─────────────────────────────────────────────────────
export { discoverSpecs, findMatchingSpec, findAffectedSpecs } from './spec-matcher.js';

// ── File selection ────────────────────────────────────────────────────
export { selectFilesForVerification } from './file-selector.js';

// ── Risk scoring ──────────────────────────────────────────────────────
export { calculatePRRisk, riskLabel } from './risk-scorer.js';

// ── Types ─────────────────────────────────────────────────────────────
export type {
  PRAnalysis,
  FileChange,
  ChangeType,
  DiffHunk,
  VerificationPlan,
  SpecVerification,
  SkippedFile,
  SkipReason,
  RiskLabel,
  PRAnalysisConfig,
  AnalyzePROptions,
  ResolvedPRAnalysisConfig,
} from './types.js';
