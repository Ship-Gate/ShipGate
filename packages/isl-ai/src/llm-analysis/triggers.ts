// ============================================================================
// Trigger Conditions for LLM-Assisted Analysis
// LLM runs ONLY when the case is ambiguous (deterministic path inconclusive).
// ============================================================================

import type { LLMAnalysisConfig } from './types.js';
import type { LLMAnalysisContext, TriggerResult } from './types.js';

const NOT_AMBIGUOUS = 'Deterministic analysis sufficient; LLM not needed.';
const DISABLED = 'LLM analysis path is disabled in config.';

/**
 * Decide whether to run the LLM analysis path.
 * Returns runLLM: true only for ambiguous cases; never for clear-cut ones.
 */
export function shouldRunLLMAnalysis(
  ctx: LLMAnalysisContext,
  config: LLMAnalysisConfig
): TriggerResult {
  if (!config.enabled) {
    return { runLLM: false, reason: DISABLED };
  }

  if (ctx.requestedLLM === true) {
    return { runLLM: true, reason: 'Explicitly requested LLM analysis.' };
  }

  const strategy = ctx.suggestedStrategy ?? '';
  if (config.triggerStrategies.includes(strategy)) {
    return { runLLM: true, reason: `Strategy "${strategy}" triggers LLM path.` };
  }

  const failureType = ctx.failureType ?? '';
  if (config.ambiguousFailureTypes.includes(failureType)) {
    return { runLLM: true, reason: `Failure type "${failureType}" is ambiguous.` };
  }

  const confidence = ctx.confidence;
  if (typeof confidence === 'number' && confidence < config.confidenceThreshold) {
    return {
      runLLM: true,
      reason: `Confidence ${confidence} below threshold ${config.confidenceThreshold}.`,
    };
  }

  const candidates = ctx.candidateCount ?? 0;
  if (candidates >= config.ambiguousCandidateThreshold) {
    return {
      runLLM: true,
      reason: `Multiple candidates (${candidates}) >= ${config.ambiguousCandidateThreshold}.`,
    };
  }

  return { runLLM: false, reason: NOT_AMBIGUOUS };
}
