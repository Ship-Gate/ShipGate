// ============================================================================
// LLM-Assisted Analysis Types
// Pipeline runs only on ambiguous cases; every claim must cite code evidence.
// ============================================================================

/** Input context for deciding if LLM analysis should run */
export interface LLMAnalysisContext {
  /** Deterministic analysis confidence 0–1; low = ambiguous */
  confidence: number;
  /** Strategy chosen by deterministic analyzer (e.g. ai_assisted) */
  suggestedStrategy?: string;
  /** Failure type; "unknown" is ambiguous */
  failureType?: string;
  /** Number of candidate root causes; >1 can be ambiguous */
  candidateCount?: number;
  /** Whether the case was explicitly requested for LLM */
  requestedLLM?: boolean;
  /** Code segments already identified (evidence pool) */
  codeSegments?: CodeEvidence[];
}

/** A single piece of code evidence (file:line or snippet) */
export interface CodeEvidence {
  file: string;
  startLine: number;
  endLine: number;
  code: string;
  /** Optional label for citation, e.g. "auth.ts:42" */
  citationId?: string;
}

/** Result of the trigger check: should we run LLM? */
export interface TriggerResult {
  runLLM: boolean;
  reason: string;
}

/** Config for the LLM analysis path */
export interface LLMAnalysisConfig {
  /** Only run when deterministic confidence is below this (0–1) */
  confidenceThreshold: number;
  /** Strategies that always trigger LLM (e.g. ai_assisted) */
  triggerStrategies: string[];
  /** Failure types that are always ambiguous */
  ambiguousFailureTypes: string[];
  /** Trigger when candidate root causes exceed this */
  ambiguousCandidateThreshold: number;
  /** Max tokens per request */
  maxTokensPerRequest: number;
  /** Max tokens per day (budget) */
  maxTokensPerDay?: number;
  /** Max cost in USD per request (approximate) */
  maxCostPerRequest: number;
  /** Max cost in USD per day (budget) */
  maxCostPerDay?: number;
  /** Enable the LLM analysis path at all */
  enabled: boolean;
}

/** A claim in the LLM output that must have a citation */
export interface CitedClaim {
  claim: string;
  citation: string;
  /** e.g. "file:line" or "snippet:id" */
  citationType: 'file_line' | 'snippet';
}

/** Validated LLM analysis output (all claims cited) */
export interface LLMAnalysisOutput {
  summary: string;
  claims: CitedClaim[];
  /** Rejected raw claims that had no citation (never surfaced) */
  rejectedUncitedCount: number;
  tokensUsed: number;
  costEstimateUsd: number;
}

/** Raw response from LLM before guardrail validation */
export interface RawLLMResponse {
  content: string;
  tokensUsed: number;
  model: string;
}
