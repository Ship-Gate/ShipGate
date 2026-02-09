/**
 * Auto-Verify Watch Types
 *
 * Type definitions for the file watcher that triggers verification
 * after code generation completes.
 */

import type { EvidenceReport, ScoreSummary } from '../evidence/evidenceTypes.js';

/**
 * Configuration for the file watcher
 */
export interface WatchConfig {
  /** Workspace path to watch */
  workspacePath: string;

  /** Path to the generation complete marker file (relative to workspace) */
  markerFile?: string;

  /** Debounce interval in milliseconds */
  debounceMs?: number;

  /** Patterns to watch for changes (glob patterns) */
  watchPatterns?: string[];

  /** Patterns to ignore */
  ignorePatterns?: string[];

  /** Path to write evidence reports (relative to workspace) */
  evidencePath?: string;

  /** Path to ISL specification files */
  specPath?: string;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_WATCH_CONFIG = {
  markerFile: '.shipgate/.gen-complete',
  debounceMs: 500,
  watchPatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  evidencePath: '.shipgate/evidence',
} as const;

/**
 * Events emitted by the watcher
 */
export type WatchEvent =
  | { type: 'started'; config: WatchConfig }
  | { type: 'generation-complete'; timestamp: Date }
  | { type: 'verification-started'; specPath: string }
  | { type: 'verification-complete'; result: VerificationResult }
  | { type: 'evidence-written'; path: string }
  | { type: 'error'; error: Error; phase: WatchPhase | 'idle' | 'stopped' }
  | { type: 'stopped' };

/**
 * Phases during the watch-and-verify cycle
 */
export type WatchPhase =
  | 'watching'
  | 'detecting-marker'
  | 'parsing-spec'
  | 'verifying'
  | 'scoring'
  | 'writing-evidence';

/**
 * Result from a verification run
 */
export interface VerificationResult {
  /** Whether verification passed */
  passed: boolean;

  /** Trust score (0-100) */
  score: number;

  /** Score summary with breakdown */
  scoreSummary: ScoreSummary;

  /** Full evidence report */
  evidenceReport?: EvidenceReport;

  /** Path to written evidence file */
  evidencePath?: string;

  /** Timestamp of verification */
  timestamp: Date;

  /** Duration in milliseconds */
  durationMs: number;

  /** Any errors encountered */
  errors?: string[];
}

/**
 * Callback for watch events
 */
export type WatchEventCallback = (event: WatchEvent) => void;

/**
 * Handle to control the watcher
 */
export interface WatchHandle {
  /** Stop watching */
  stop(): Promise<void>;

  /** Check if currently watching */
  isWatching(): boolean;

  /** Manually trigger verification */
  triggerVerify(): Promise<VerificationResult>;

  /** Get current status */
  getStatus(): WatchStatus;
}

/**
 * Status of the watcher
 */
export interface WatchStatus {
  /** Whether the watcher is running */
  running: boolean;

  /** Current phase */
  phase: WatchPhase | 'idle' | 'stopped';

  /** Last verification result */
  lastResult?: VerificationResult;

  /** Number of verification runs */
  runCount: number;

  /** Timestamp when watcher started */
  startedAt?: Date;
}

/**
 * Marker file content structure
 */
export interface MarkerFileContent {
  /** Timestamp when generation completed */
  timestamp: string;

  /** Version or hash of generated content */
  version?: string;

  /** List of generated files */
  generatedFiles?: string[];

  /** Generator that produced the files */
  generator?: string;

  /** Any metadata from the generator */
  metadata?: Record<string, unknown>;
}

/**
 * Options for writing evidence
 */
export interface EvidenceWriteOptions {
  /** Format of the evidence file */
  format?: 'json' | 'yaml';

  /** Include full artifacts in the report */
  includeArtifacts?: boolean;

  /** Compress the output */
  compress?: boolean;

  /** Generate human-readable summary alongside */
  generateSummary?: boolean;
}

/**
 * Summary file content (human-readable)
 */
export interface EvidenceSummaryFile {
  /** Spec name */
  specName: string;

  /** Overall score */
  score: number;

  /** Pass/fail/partial counts */
  breakdown: {
    passed: number;
    failed: number;
    partial: number;
    total: number;
  };

  /** Ship recommendation */
  recommendation: 'ship' | 'review' | 'block';

  /** Key findings */
  findings: string[];

  /** Timestamp */
  timestamp: string;
}
