/**
 * PipelineOrchestrator — Manages the 5-stage ISL Vibe pipeline with:
 * - Per-stage configurable timeout
 * - Retry logic (3x exponential backoff + jitter) for transient errors
 * - Progress reporting
 * - Token budget management
 * - Checkpoint/resume support
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import type {
  VibeStageId,
  StageResult,
  PipelineResult,
  TokenUsage,
  PipelineGeneratedFile,
} from './types.js';
import { DEFAULT_STAGE_TIMEOUTS } from './types.js';
import { TokenTracker } from './token-tracker.js';
import type { ProgressReporter } from './progress-reporter.js';

export class TimeoutError extends Error {
  constructor(
    public readonly stage: VibeStageId,
    public readonly timeoutMs: number,
  ) {
    super(`Stage "${stage}" timed out after ${(timeoutMs / 1000).toFixed(0)}s`);
    this.name = 'TimeoutError';
  }
}

/** Check if error is transient (retryable): 429, 500, 503, network */
export function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('500') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('econnaborted')
  );
}

/** Check if error is non-retryable: 400, 401, parse failures */
export function isNonRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('400') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('invalid') ||
    msg.includes('parse') ||
    msg.includes('syntax')
  );
}

/** Jitter: add random 0-25% to delay */
function addJitter(ms: number): number {
  return Math.floor(ms * (1 + Math.random() * 0.25));
}

export interface OrchestratorConfig {
  /** Per-stage timeouts (ms). Overrides defaults. */
  stageTimeouts?: Partial<Record<VibeStageId, number>>;
  /** Max retries for transient errors. Default: 3 */
  maxRetries?: number;
  /** Base delay for exponential backoff (ms). Delays: base, base*3, base*9. Default: 1000 */
  retryBaseDelayMs?: number;
  /** Max tokens. Default: 100k */
  maxTokens?: number;
  /** Checkpoint path for resume. If set, saves after each stage */
  checkpointPath?: string;
  /** Resume from this stage (skip earlier stages) */
  resumeFrom?: VibeStageId;
}

/** Checkpoint data for --resume */
export interface PipelineCheckpoint {
  lastSuccessfulStage: VibeStageId;
  stages: StageResult[];
  islContent?: string;
  domain?: unknown;
  files?: Array<{ path: string; content: string; type: string }>;
  outputDir: string;
  prompt: string;
  timestamp: number;
}

export class PipelineOrchestrator {
  private readonly timeouts: Record<VibeStageId, number>;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly checkpointPath?: string;

  readonly tokenTracker: TokenTracker;
  readonly progress: ProgressReporter;

  constructor(
    progressReporter: ProgressReporter,
    config: OrchestratorConfig = {},
  ) {
    this.timeouts = { ...DEFAULT_STAGE_TIMEOUTS, ...config.stageTimeouts };
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 1000;
    this.checkpointPath = config.checkpointPath;

    this.tokenTracker = new TokenTracker({
      maxTokens: config.maxTokens ?? 100_000,
      warnThreshold: 0.8,
      skipOptionalThreshold: 0.95,
    });
    this.progress = progressReporter;
  }

  /** Run a stage with timeout */
  async withTimeout<T>(
    promise: Promise<T>,
    stage: VibeStageId,
    customMs?: number,
  ): Promise<T> {
    const ms = customMs ?? this.timeouts[stage] ?? 60_000;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new TimeoutError(stage, ms)), ms);
      promise.then(
        (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  /** Run a function with retry (exponential backoff: 1s, 3s, 9s + jitter) */
  async withRetry<T>(
    fn: () => Promise<T>,
    stage: VibeStageId,
    isRetryable: (err: unknown) => boolean = isTransientError,
  ): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isNonRetryableError(err) || !isRetryable(err) || attempt >= this.maxRetries) {
          throw lastError;
        }
        const delay = addJitter(this.retryBaseDelayMs * Math.pow(3, attempt));
        this.progress.stageRetry({
          type: 'stage_retry',
          stage,
          attempt: attempt + 1,
          maxAttempts: this.maxRetries,
          delayMs: delay,
          reason: lastError.message,
          timestamp: Date.now(),
        });
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError!;
  }

  /** Execute a stage with timeout + retry, progress, and token tracking */
  async executeStage<T extends { tokens?: { input: number; output: number } }>(
    stage: VibeStageId,
    fn: () => Promise<T>,
    options: { skipRetry?: boolean; customTimeout?: number } = {},
  ): Promise<T> {
    this.progress.stageStart({
      type: 'stage_start',
      stage,
      timestamp: Date.now(),
    });
    const start = Date.now();

    const run = async (): Promise<T> => {
      const result = await this.withTimeout(fn(), stage, options.customTimeout);
      if (result?.tokens) {
        this.tokenTracker.add(stage, result.tokens.input, result.tokens.output);
      }
      this.progress.stageComplete({
        type: 'stage_complete',
        stage,
        duration: Date.now() - start,
        tokens: result?.tokens
          ? {
              input: result.tokens.input,
              output: result.tokens.output,
              total: result.tokens.input + result.tokens.output,
            }
          : undefined,
        timestamp: Date.now(),
      });
      return result;
    };

    if (options.skipRetry) {
      return run();
    }
    return this.withRetry(run, stage);
  }

  /** Save checkpoint for --resume */
  async saveCheckpoint(checkpoint: PipelineCheckpoint): Promise<void> {
    if (!this.checkpointPath) return;
    await mkdir(dirname(this.checkpointPath), { recursive: true });
    await writeFile(this.checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
  }

  /** Load checkpoint for --resume */
  async loadCheckpoint(): Promise<PipelineCheckpoint | null> {
    if (!this.checkpointPath) return null;
    try {
      const data = await readFile(this.checkpointPath, 'utf-8');
      return JSON.parse(data) as PipelineCheckpoint;
    } catch {
      return null;
    }
  }

  /** Build PipelineResult from stage results */
  buildResult(params: {
    success: boolean;
    verdict: 'SHIP' | 'NO_SHIP' | 'WARN';
    prompt: string;
    islSpec?: string;
    islSpecPath?: string;
    outputDir: string;
    files: PipelineGeneratedFile[];
    stages: StageResult[];
    iterations: number;
    finalScore: number;
    errors: string[];
    duration: number;
    lastSuccessfulStage?: VibeStageId;
    resumed?: boolean;
    skippedOptionalStages?: boolean;
    proofBundle?: Record<string, unknown>;
  }): PipelineResult {
    const totalUsage = this.tokenTracker.getTotalUsage();
    const usageByStage = this.tokenTracker.getUsageByStage();
    return {
      ...params,
      tokenUsageByStage: usageByStage,
      totalTokens: totalUsage,
    };
  }

  /** Check token budget and return warning if needed */
  checkTokenBudget(): string | null {
    return this.tokenTracker.checkBudget();
  }

  /** Whether to skip optional stages (heal) due to token budget */
  shouldSkipOptionalStages(): boolean {
    return this.tokenTracker.shouldSkipOptionalStages();
  }
}
