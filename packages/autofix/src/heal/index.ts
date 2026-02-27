/**
 * Targeted Heal System
 *
 * Root-cause-aware heal loop that sends only relevant context to the AI
 * instead of entire files.
 */

export { RootCauseAnalyzer } from './root-cause-analyzer.js';
export { buildFixPrompt, buildBatchFixPrompt } from './fix-prompts.js';
export { HealPlanExecutor } from './heal-plan.js';
export {
  parseAIResponse,
  applySurgicalDiff,
  applySurgicalDiffs,
} from './surgical-diff.js';
export {
  formatHealReportJSON,
  formatHealReportPretty,
  createEmptyHealReport,
} from './heal-report.js';

export type {
  RootCauseCategory,
  HealPhase,
  VerificationFailureInput,
  AnalyzedFailure,
  HealPlanGroup,
  SurgicalDiff,
  ApplyDiffResult,
  HealIterationResult,
  HealReport,
} from './types.js';

export type { HealPlanOptions } from './heal-plan.js';
