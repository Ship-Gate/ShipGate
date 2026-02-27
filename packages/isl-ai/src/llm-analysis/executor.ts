// ============================================================================
// LLM Analysis Executor
// Orchestrates: trigger check → budget check → provider call → guardrail validation.
// LLM runs ONLY when static analysis is inconclusive.
// ============================================================================

import type {
  LLMAnalysisConfig,
  LLMAnalysisContext,
  LLMAnalysisOutput,
  RawLLMResponse,
  CodeEvidence,
  TriggerResult,
} from './types.js';
import type { AIProvider, AICompletionOptions } from '../types.js';
import { shouldRunLLMAnalysis } from './triggers.js';
import { resolveLLMAnalysisConfig } from './config.js';
import { extractCitedClaims } from './guardrails.js';
import { buildSystemPrompt, buildAnalysisPrompt, buildAmbiguousAnalysisPrompt } from './prompts.js';

// ============================================================================
// BUDGET TRACKER
// ============================================================================

/** Tracks token and cost usage within a rolling window (in-memory). */
export class BudgetTracker {
  private tokenLog: { timestamp: number; tokens: number; cost: number }[] = [];
  private windowMs: number;

  constructor(windowMs = 24 * 60 * 60 * 1000) {
    this.windowMs = windowMs;
  }

  /** Record a usage event. */
  record(tokens: number, cost: number): void {
    this.tokenLog.push({ timestamp: Date.now(), tokens, cost });
  }

  /** Prune entries outside the rolling window. */
  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    this.tokenLog = this.tokenLog.filter((e) => e.timestamp >= cutoff);
  }

  /** Total tokens used in current window. */
  tokensUsed(): number {
    this.prune();
    return this.tokenLog.reduce((sum, e) => sum + e.tokens, 0);
  }

  /** Total cost (USD) used in current window. */
  costUsed(): number {
    this.prune();
    return this.tokenLog.reduce((sum, e) => sum + e.cost, 0);
  }

  /** Check whether a request with the given token estimate would exceed limits. */
  wouldExceed(
    estimatedTokens: number,
    estimatedCost: number,
    config: LLMAnalysisConfig
  ): { exceeded: boolean; reason?: string } {
    this.prune();

    const currentTokens = this.tokensUsed();
    if (
      config.maxTokensPerDay !== undefined &&
      currentTokens + estimatedTokens > config.maxTokensPerDay
    ) {
      return {
        exceeded: true,
        reason: `Daily token budget exceeded: ${currentTokens}+${estimatedTokens} > ${config.maxTokensPerDay}`,
      };
    }

    const currentCost = this.costUsed();
    if (
      config.maxCostPerDay !== undefined &&
      currentCost + estimatedCost > config.maxCostPerDay
    ) {
      return {
        exceeded: true,
        reason: `Daily cost budget exceeded: $${currentCost.toFixed(4)}+$${estimatedCost.toFixed(4)} > $${config.maxCostPerDay}`,
      };
    }

    return { exceeded: false };
  }

  /** Reset all tracked usage (useful for testing). */
  reset(): void {
    this.tokenLog = [];
  }
}

// ============================================================================
// EXECUTOR RESULT
// ============================================================================

/** Discriminated union: skipped | success | error */
export type LLMExecutorResult =
  | { status: 'skipped'; reason: string; trigger: TriggerResult }
  | { status: 'budget_exceeded'; reason: string }
  | { status: 'success'; output: LLMAnalysisOutput; trigger: TriggerResult }
  | { status: 'error'; error: string; trigger: TriggerResult };

// ============================================================================
// EXECUTOR
// ============================================================================

export interface ExecutorOptions {
  /** Override analysis question (default: root cause analysis). */
  question?: string;
  /** For generic ambiguous analysis, provide context + instruction instead. */
  ambiguous?: { context: string; instruction: string };
}

/**
 * Main executor: decides whether to run LLM, enforces budget, calls provider,
 * validates output through guardrails, and returns evidence-backed results.
 */
export async function executeLLMAnalysis(
  ctx: LLMAnalysisContext,
  provider: AIProvider,
  partialConfig?: Partial<LLMAnalysisConfig>,
  budget?: BudgetTracker,
  options?: ExecutorOptions
): Promise<LLMExecutorResult> {
  const config = resolveLLMAnalysisConfig(partialConfig);

  // 1. Trigger check — LLM only runs when static analysis is inconclusive
  const trigger = shouldRunLLMAnalysis(ctx, config);
  if (!trigger.runLLM) {
    return { status: 'skipped', reason: trigger.reason, trigger };
  }

  // 2. Budget check — enforce token and cost caps
  const estimatedCost = estimateCost(config.maxTokensPerRequest);
  if (budget) {
    const budgetCheck = budget.wouldExceed(
      config.maxTokensPerRequest,
      estimatedCost,
      config
    );
    if (budgetCheck.exceeded) {
      return { status: 'budget_exceeded', reason: budgetCheck.reason! };
    }
  }

  // 3. Build prompts
  const evidence = ctx.codeSegments ?? [];
  const systemPrompt = buildSystemPrompt();
  let userPrompt: string;

  if (options?.ambiguous) {
    userPrompt = buildAmbiguousAnalysisPrompt({
      context: options.ambiguous.context,
      evidence,
      instruction: options.ambiguous.instruction,
    });
  } else {
    const failureSummary = buildFailureSummary(ctx);
    userPrompt = buildAnalysisPrompt({
      failureSummary,
      evidence,
      question: options?.question,
    });
  }

  // 4. Call provider with token cap
  let raw: RawLLMResponse;
  try {
    const aiOptions: AICompletionOptions = {
      maxTokens: config.maxTokensPerRequest,
      temperature: 0.2,
    };

    const content = await provider.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      aiOptions
    );

    // Approximate token usage (provider may not return exact counts)
    const approxTokens = Math.ceil((systemPrompt.length + userPrompt.length + content.length) / 4);

    raw = {
      content,
      tokensUsed: approxTokens,
      model: provider.name,
    };
  } catch (err) {
    return {
      status: 'error',
      error: `Provider call failed: ${err instanceof Error ? err.message : String(err)}`,
      trigger,
    };
  }

  // 5. Enforce per-request token cap (reject if over)
  if (raw.tokensUsed > config.maxTokensPerRequest * 1.5) {
    return {
      status: 'error',
      error: `Response exceeded token cap: ${raw.tokensUsed} > ${config.maxTokensPerRequest * 1.5}`,
      trigger,
    };
  }

  // 6. Guardrail validation — extract only cited claims, reject hallucinations
  const { claims, rejectedUncitedCount } = extractCitedClaims(raw.content, evidence);

  const actualCost = estimateCost(raw.tokensUsed);

  // 7. Record usage in budget tracker
  if (budget) {
    budget.record(raw.tokensUsed, actualCost);
  }

  // 8. Build output — only evidence-backed claims survive
  const output: LLMAnalysisOutput = {
    summary: claims.length > 0
      ? claims.map((c) => c.claim).join(' ')
      : 'No evidence-backed claims produced.',
    claims,
    rejectedUncitedCount,
    tokensUsed: raw.tokensUsed,
    costEstimateUsd: actualCost,
  };

  return { status: 'success', output, trigger };
}

// ============================================================================
// HELPERS
// ============================================================================

/** Build a failure summary from the analysis context. */
function buildFailureSummary(ctx: LLMAnalysisContext): string {
  const parts: string[] = [];

  if (ctx.failureType) {
    parts.push(`Failure type: ${ctx.failureType}`);
  }

  parts.push(`Deterministic confidence: ${ctx.confidence}`);

  if (ctx.suggestedStrategy) {
    parts.push(`Suggested strategy: ${ctx.suggestedStrategy}`);
  }

  if (ctx.candidateCount !== undefined) {
    parts.push(`Candidate root causes: ${ctx.candidateCount}`);
  }

  return parts.join('\n');
}

/** Rough cost estimate: ~$0.003 per 1K tokens (blended input/output). */
function estimateCost(tokens: number): number {
  return (tokens / 1000) * 0.003;
}
