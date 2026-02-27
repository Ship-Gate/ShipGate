/**
 * ISL Vibe Pipeline Types
 *
 * Types for the 5-stage Safe Vibe Coding pipeline:
 * 1. NL→ISL, 2. ISL→Schema, 3. Codegen, 4. Verify, 5. Heal
 */

/** Stage identifiers for the vibe pipeline */
export type VibeStageId =
  | 'nl-to-isl'
  | 'isl-to-schema'
  | 'validate-spec'
  | 'codegen'
  | 'verify'
  | 'heal'
  | 'load-spec'
  | 'write-files'
  | 'fix-spec';

/** Token usage for a single stage or cumulative */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/** Per-stage result with timing and optional details */
export interface StageResult {
  stage: VibeStageId;
  success: boolean;
  duration: number;
  tokens?: TokenUsage;
  details?: Record<string, unknown>;
  error?: string;
  partialOutput?: unknown;
}

/** Generated file entry */
export interface PipelineGeneratedFile {
  path: string;
  type: 'spec' | 'backend' | 'frontend' | 'database' | 'test' | 'config' | 'docs';
  size: number;
}

/**
 * PipelineResult — captures full pipeline execution
 */
export interface PipelineResult {
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
  proofBundle?: Record<string, unknown>;
  errors: string[];
  duration: number;
  /** Token usage per stage */
  tokenUsageByStage: Record<VibeStageId, TokenUsage | undefined>;
  /** Cumulative token usage */
  totalTokens: TokenUsage;
  /** Last successful stage (for --resume) */
  lastSuccessfulStage?: VibeStageId;
  /** Whether pipeline was resumed from checkpoint */
  resumed?: boolean;
  /** Whether optional stages were skipped due to token budget */
  skippedOptionalStages?: boolean;
}

/** Default per-stage timeouts in milliseconds */
export const DEFAULT_STAGE_TIMEOUTS: Record<VibeStageId, number> = {
  'nl-to-isl': 30_000,
  'isl-to-schema': 20_000,
  'validate-spec': 20_000,
  'codegen': 120_000,
  'verify': 60_000,
  'heal': 90_000,
  'load-spec': 5_000,
  'write-files': 10_000,
  'fix-spec': 30_000,
};
