/**
 * Pipeline Types
 *
 * Type definitions for the ISL verification pipeline.
 * The pipeline orchestrates: context extraction → translation → generation → verification → scoring
 */

import type { Domain } from '@isl-lang/parser';
import type { ContextPack, ExtractContextOptions } from '../context/contextTypes.js';
import type {
  EvidenceReport,
  EvidenceClauseResult,
  ScoreSummary,
  Assumption,
  OpenQuestion,
  EvidenceArtifact,
} from '../evidence/evidenceTypes.js';
import type { ClauseResult, ScoringResult } from '../isl-agent/scoring/scoringTypes.js';

/**
 * Pipeline input mode - either a prompt (for translation) or an AST (pre-parsed)
 */
export type PipelineInputMode = 'prompt' | 'ast';

/**
 * Pipeline input - either a natural language prompt or a parsed ISL AST
 */
export type PipelineInput =
  | { mode: 'prompt'; prompt: string }
  | { mode: 'ast'; ast: Domain };

/**
 * Options for running the pipeline
 */
export interface PipelineOptions {
  /** Workspace path containing the codebase */
  workspacePath: string;

  /** Output directory for evidence reports (default: .vibecheck/reports) */
  outDir?: string;

  /** Context extraction options */
  contextOptions?: ExtractContextOptions;

  /** Whether to skip context extraction (use stub context) */
  skipContext?: boolean;

  /** Whether to write the report to disk */
  writeReport?: boolean;

  /** Custom spec name for the report */
  specName?: string;

  /** Custom spec path for the report */
  specPath?: string;

  /** Verification mode */
  mode?: 'full' | 'incremental' | 'quick';

  /** Agent version string */
  agentVersion?: string;

  /** Additional notes to include in the report */
  notes?: string;

  /** Enable verbose logging */
  verbose?: boolean;

  /** Dry run - don't write any files */
  dryRun?: boolean;

  /** Enforce assumption guards (P1–P4, D1) before pipeline runs */
  enforceAssumptions?: boolean;

  /** Strict mode: fail if any step is skipped or stubbed (D2) */
  strictSteps?: boolean;
}

/**
 * Result of a single pipeline step
 */
export interface StepResult<T> {
  /** Whether the step succeeded */
  success: boolean;
  /** Result data (if successful) */
  data?: T;
  /** Error message (if failed) */
  error?: string;
  /** Duration of the step in milliseconds */
  durationMs: number;
  /** Warnings generated during the step */
  warnings: string[];
}

/**
 * Context extraction step result
 */
export interface ContextStepResult extends StepResult<ContextPack> {
  stepName: 'context';
}

/**
 * Translation step result
 */
export interface TranslateStepResult extends StepResult<Domain> {
  stepName: 'translate';
  /** Whether the AST was provided directly (not translated) */
  wasProvided: boolean;
}

/**
 * Validation step result
 */
export interface ValidateStepResult extends StepResult<{ valid: boolean; issues: string[] }> {
  stepName: 'validate';
}

/**
 * Generation step result
 */
export interface GenerateStepResult extends StepResult<{
  filesGenerated: string[];
  tempDir?: string;
}> {
  stepName: 'generate';
}

/**
 * Verification step result
 */
export interface VerifyStepResult extends StepResult<{
  clauseResults: EvidenceClauseResult[];
  artifacts: EvidenceArtifact[];
}> {
  stepName: 'verify';
}

/**
 * Scoring step result
 */
export interface ScoreStepResult extends StepResult<{
  scoringResult: ScoringResult;
  summary: ScoreSummary;
}> {
  stepName: 'score';
}

/**
 * Union of all step results
 */
export type AnyStepResult =
  | ContextStepResult
  | TranslateStepResult
  | ValidateStepResult
  | GenerateStepResult
  | VerifyStepResult
  | ScoreStepResult;

/**
 * Pipeline execution status
 */
export type PipelineStatus = 'success' | 'partial' | 'failed';

/**
 * Complete pipeline result
 */
export interface PipelineResult {
  /** Overall pipeline status */
  status: PipelineStatus;

  /** The generated evidence report */
  report: EvidenceReport;

  /** Path where the report was written (if writeReport was true) */
  reportPath?: string;

  /** Individual step results */
  steps: {
    context?: ContextStepResult;
    translate?: TranslateStepResult;
    validate?: ValidateStepResult;
    generate?: GenerateStepResult;
    verify?: VerifyStepResult;
    score?: ScoreStepResult;
  };

  /** Total pipeline duration in milliseconds */
  totalDurationMs: number;

  /** Aggregated warnings from all steps */
  warnings: string[];

  /** Aggregated errors from failed steps */
  errors: string[];
}

/**
 * Pipeline state passed between steps
 */
export interface PipelineState {
  /** Start time of the pipeline */
  startTime: number;

  /** Input provided to the pipeline */
  input: PipelineInput;

  /** Pipeline options */
  options: Required<PipelineOptions>;

  /** Extracted context (populated after context step) */
  context?: ContextPack;

  /** The ISL AST (populated after translate step) */
  ast?: Domain;

  /** Generated files (populated after generate step) */
  generatedFiles?: string[];

  /** Clause results (populated after verify step) */
  clauseResults?: EvidenceClauseResult[];

  /** Artifacts collected (populated after verify step) */
  artifacts?: EvidenceArtifact[];

  /** Scoring result (populated after score step) */
  scoringResult?: ScoringResult;

  /** Accumulated warnings */
  warnings: string[];

  /** Accumulated errors */
  errors: string[];

  /** Step results */
  stepResults: Partial<PipelineResult['steps']>;
}

/**
 * Default pipeline options
 */
export const DEFAULT_PIPELINE_OPTIONS: Omit<Required<PipelineOptions>, 'workspacePath'> = {
  outDir: '.vibecheck/reports',
  contextOptions: {},
  skipContext: false,
  writeReport: true,
  specName: undefined as unknown as string,
  specPath: undefined as unknown as string,
  mode: 'full',
  agentVersion: '1.0.0',
  notes: undefined as unknown as string,
  verbose: false,
  dryRun: false,
  enforceAssumptions: false,
  strictSteps: false,
};

/**
 * Helper type for clause generation from AST
 */
export interface ClauseInfo {
  /** Clause ID in format Entity.clauseType.index */
  clauseId: string;
  /** Type of clause */
  clauseType: 'precondition' | 'postcondition' | 'invariant' | 'effect' | 'constraint';
  /** Source expression or description */
  source: string;
  /** Entity this clause belongs to */
  entityName?: string;
  /** Behavior this clause belongs to */
  behaviorName?: string;
}
