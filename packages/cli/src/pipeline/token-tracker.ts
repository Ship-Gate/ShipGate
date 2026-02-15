/**
 * Token Budget Tracker for the ISL Vibe Pipeline
 *
 * Tracks usage across stages, warns at 80%, skips optional stages at 95%.
 */

import type { TokenUsage, VibeStageId } from './types.js';

export interface TokenTrackerOptions {
  /** Max total tokens (input + output). Default: 100k */
  maxTokens?: number;
  /** Threshold (0-1) to warn user. Default: 0.8 */
  warnThreshold?: number;
  /** Threshold (0-1) to skip optional stages. Default: 0.95 */
  skipOptionalThreshold?: number;
}

export type BudgetStatus = 'ok' | 'warn' | 'skip_optional' | 'exceeded';

export class TokenTracker {
  readonly maxTokens: number;
  readonly warnThreshold: number;
  readonly skipOptionalThreshold: number;

  totalInput = 0;
  totalOutput = 0;
  readonly byStage = new Map<VibeStageId, TokenUsage>();

  constructor(options: TokenTrackerOptions = {}) {
    this.maxTokens = options.maxTokens ?? 100_000;
    this.warnThreshold = options.warnThreshold ?? 0.8;
    this.skipOptionalThreshold = options.skipOptionalThreshold ?? 0.95;
  }

  /** Add tokens for a stage */
  add(stage: VibeStageId, input: number, output: number): void {
    this.totalInput += input;
    this.totalOutput += output;
    const total = input + output;
    const existing = this.byStage.get(stage);
    if (existing) {
      this.byStage.set(stage, {
        input: existing.input + input,
        output: existing.output + output,
        total: existing.total + total,
      });
    } else {
      this.byStage.set(stage, { input, output, total });
    }
  }

  get total(): number {
    return this.totalInput + this.totalOutput;
  }

  get usagePct(): number {
    return this.maxTokens > 0 ? this.total / this.maxTokens : 0;
  }

  /** Get current budget status */
  getStatus(): BudgetStatus {
    const pct = this.usagePct;
    if (pct >= 1) return 'exceeded';
    if (pct >= this.skipOptionalThreshold) return 'skip_optional';
    if (pct >= this.warnThreshold) return 'warn';
    return 'ok';
  }

  /** Returns warning message if near limit, null otherwise */
  checkBudget(): string | null {
    const status = this.getStatus();
    if (status === 'exceeded') {
      return `Token budget exceeded: ${this.total}/${this.maxTokens} tokens used. Pipeline stopped.`;
    }
    if (status === 'skip_optional') {
      return `Token budget at ${(this.usagePct * 100).toFixed(0)}% — skipping optional stages (heal loop).`;
    }
    if (status === 'warn') {
      return `Token budget at ${(this.usagePct * 100).toFixed(0)}% — consider --max-tokens if needed.`;
    }
    return null;
  }

  /** Whether we should skip optional stages (heal loop) */
  shouldSkipOptionalStages(): boolean {
    return this.getStatus() === 'skip_optional' || this.getStatus() === 'exceeded';
  }

  /** Whether we've exceeded the budget */
  isExceeded(): boolean {
    return this.getStatus() === 'exceeded';
  }

  /** Get cumulative token usage */
  getTotalUsage(): TokenUsage {
    return {
      input: this.totalInput,
      output: this.totalOutput,
      total: this.total,
    };
  }

  /** Get usage by stage for PipelineResult */
  getUsageByStage(): Record<VibeStageId, TokenUsage | undefined> {
    const stages: VibeStageId[] = [
      'nl-to-isl',
      'load-spec',
      'isl-to-schema',
      'validate-spec',
      'codegen',
      'write-files',
      'verify',
      'heal',
      'fix-spec',
    ];
    const result: Record<string, TokenUsage | undefined> = {};
    for (const s of stages) {
      result[s] = this.byStage.get(s);
    }
    return result as Record<VibeStageId, TokenUsage | undefined>;
  }
}
