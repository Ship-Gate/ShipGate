// ============================================================================
// LLM-Assisted Analysis Config
// Trigger conditions and token/cost limits.
// ============================================================================

import type { LLMAnalysisConfig } from './types.js';

export const DEFAULT_LLM_ANALYSIS_CONFIG: LLMAnalysisConfig = {
  enabled: true,
  confidenceThreshold: 0.6,
  triggerStrategies: ['ai_assisted'],
  ambiguousFailureTypes: ['unknown'],
  ambiguousCandidateThreshold: 2,
  maxTokensPerRequest: 2048,
  maxTokensPerDay: 50_000,
  maxCostPerRequest: 0.05,
  maxCostPerDay: 2.0,
};

/**
 * Merge user config with defaults. Only defined keys override.
 */
export function resolveLLMAnalysisConfig(
  partial?: Partial<LLMAnalysisConfig>
): LLMAnalysisConfig {
  if (!partial) return { ...DEFAULT_LLM_ANALYSIS_CONFIG };
  return {
    ...DEFAULT_LLM_ANALYSIS_CONFIG,
    ...partial,
  };
}
