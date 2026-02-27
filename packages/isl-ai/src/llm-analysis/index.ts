// ============================================================================
// LLM-Assisted Analysis — Public API
// LLM runs ONLY when static analysis is inconclusive.
// Every claim must cite code evidence. No invented facts.
// ============================================================================

export {
  shouldRunLLMAnalysis,
} from './triggers.js';

export {
  DEFAULT_LLM_ANALYSIS_CONFIG,
  resolveLLMAnalysisConfig,
} from './config.js';

export {
  extractCitedClaims,
  assertNoUncitedFacts,
  formatEvidenceForPrompt,
} from './guardrails.js';

export {
  buildSystemPrompt,
  buildAnalysisPrompt,
  buildAmbiguousAnalysisPrompt,
} from './prompts.js';

export {
  executeLLMAnalysis,
  BudgetTracker,
  type LLMExecutorResult,
  type ExecutorOptions,
} from './executor.js';

export type {
  LLMAnalysisConfig,
  LLMAnalysisContext,
  LLMAnalysisOutput,
  RawLLMResponse,
  CodeEvidence,
  CitedClaim,
  TriggerResult,
} from './types.js';
