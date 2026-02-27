/**
 * Progress Reporter for the ISL Vibe Pipeline
 *
 * Interface and implementations for streaming progress:
 * - CLI: ora spinners + stage progress
 * - VS Code: progress notification API (when running in extension)
 * - JSON: for programmatic consumers (CI, scripts)
 */

import type { VibeStageId } from './types.js';
import type { TokenUsage } from './types.js';

/** Progress event types */
export type ProgressEventType =
  | 'stage_start'
  | 'stage_progress'
  | 'stage_complete'
  | 'stage_error'
  | 'stage_retry'
  | 'pipeline_complete';

export interface StageStartEvent {
  type: 'stage_start';
  stage: VibeStageId;
  timestamp: number;
}

export interface StageProgressEvent {
  type: 'stage_progress';
  stage: VibeStageId;
  percent: number;
  message?: string;
  timestamp: number;
}

export interface StageCompleteEvent {
  type: 'stage_complete';
  stage: VibeStageId;
  duration: number;
  tokens?: TokenUsage;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface StageErrorEvent {
  type: 'stage_error';
  stage: VibeStageId;
  error: string;
  timestamp: number;
}

export interface StageRetryEvent {
  type: 'stage_retry';
  stage: VibeStageId;
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  reason?: string;
  timestamp: number;
}

export interface PipelineCompleteEvent {
  type: 'pipeline_complete';
  success: boolean;
  verdict?: 'SHIP' | 'NO_SHIP' | 'WARN';
  duration: number;
  totalTokens?: TokenUsage;
  timestamp: number;
}

export type ProgressEvent =
  | StageStartEvent
  | StageProgressEvent
  | StageCompleteEvent
  | StageErrorEvent
  | StageRetryEvent
  | PipelineCompleteEvent;

/** Progress reporter interface */
export interface ProgressReporter {
  stageStart(event: StageStartEvent): void;
  stageProgress(event: StageProgressEvent): void;
  stageComplete(event: StageCompleteEvent): void;
  stageError(event: StageErrorEvent): void;
  stageRetry(event: StageRetryEvent): void;
  pipelineComplete(event: PipelineCompleteEvent): void;
}

/** No-op reporter (silent) */
export class NoopProgressReporter implements ProgressReporter {
  stageStart(): void {}
  stageProgress(): void {}
  stageComplete(): void {}
  stageError(): void {}
  stageRetry(): void {}
  pipelineComplete(): void {}
}

/** JSON reporter — outputs one JSON object per line for programmatic consumers */
export class JsonProgressReporter implements ProgressReporter {
  stageStart(event: StageStartEvent): void {
    console.log(JSON.stringify({ ...event, type: 'vibe:progress' }));
  }
  stageProgress(event: StageProgressEvent): void {
    console.log(JSON.stringify({ ...event, type: 'vibe:progress' }));
  }
  stageComplete(event: StageCompleteEvent): void {
    console.log(JSON.stringify({ ...event, type: 'vibe:progress' }));
  }
  stageError(event: StageErrorEvent): void {
    console.log(JSON.stringify({ ...event, type: 'vibe:progress' }));
  }
  stageRetry(event: StageRetryEvent): void {
    console.log(JSON.stringify({ ...event, type: 'vibe:progress' }));
  }
  pipelineComplete(event: PipelineCompleteEvent): void {
    console.log(JSON.stringify({ ...event, type: 'vibe:progress' }));
  }
}

/** CLI reporter — uses ora spinner and stage messages */
export class CliProgressReporter implements ProgressReporter {
  private spinner: import('ora').Ora | null;
  private readonly stageLabels: Record<VibeStageId, string> = {
    'nl-to-isl': 'Converting natural language to ISL spec',
    'isl-to-schema': 'Validating ISL specification',
    'validate-spec': 'Validating ISL specification',
    'codegen': 'Generating full-stack code',
    'verify': 'Verifying generated code',
    'heal': 'Healing violations',
    'load-spec': 'Loading existing ISL spec',
    'write-files': 'Writing files',
    'fix-spec': 'Fixing spec parse errors',
  };

  constructor(spinner: import('ora').Ora | null) {
    this.spinner = spinner;
  }

  stageStart(event: StageStartEvent): void {
    const label = this.stageLabels[event.stage] ?? event.stage;
    if (this.spinner) {
      this.spinner.text = label + '...';
      this.spinner.start();
    }
  }

  stageProgress(event: StageProgressEvent): void {
    const label = this.stageLabels[event.stage] ?? event.stage;
    const pct = event.percent >= 0 ? ` (${event.percent}%)` : '';
    if (this.spinner) {
      this.spinner.text = `${label}${pct}${event.message ? ` — ${event.message}` : ''}`;
    }
  }

  stageComplete(event: StageCompleteEvent): void {
    if (this.spinner) {
      this.spinner.text = `${this.stageLabels[event.stage] ?? event.stage} — done`;
    }
  }

  stageError(event: StageErrorEvent): void {
    if (this.spinner) {
      this.spinner.fail(`${this.stageLabels[event.stage] ?? event.stage}: ${event.error}`);
      this.spinner.start();
    }
  }

  stageRetry(event: StageRetryEvent): void {
    if (this.spinner) {
      this.spinner.text = `${this.stageLabels[event.stage] ?? event.stage}: retrying (${event.attempt}/${event.maxAttempts}) in ${(event.delayMs / 1000).toFixed(0)}s...`;
    }
  }

  pipelineComplete(event: PipelineCompleteEvent): void {
    if (this.spinner) {
      if (event.success) {
        this.spinner.succeed(`Pipeline complete (${(event.duration / 1000).toFixed(1)}s)`);
      } else {
        this.spinner.fail(`Pipeline failed (${(event.duration / 1000).toFixed(1)}s)`);
      }
    }
  }
}

/** VS Code reporter — uses vscode.window.withProgress when available */
export class VscodeProgressReporter implements ProgressReporter {
  private progress?: { report: (value: { message?: string; increment?: number }) => void };
  private readonly stageLabels: Record<VibeStageId, string> = {
    'nl-to-isl': 'Converting to ISL spec',
    'isl-to-schema': 'Validating spec',
    'validate-spec': 'Validating spec',
    'codegen': 'Generating full-stack code',
    'verify': 'Verifying code',
    'heal': 'Healing violations',
    'load-spec': 'Loading spec',
    'write-files': 'Writing files',
    'fix-spec': 'Fixing spec',
  };

  /** Call this with the progress object from withProgress callback */
  setProgress(progress: { report: (value: { message?: string; increment?: number }) => void }): void {
    this.progress = progress;
  }

  stageStart(event: StageStartEvent): void {
    const label = this.stageLabels[event.stage] ?? event.stage;
    this.progress?.report({ message: label + '...' });
  }

  stageProgress(event: StageProgressEvent): void {
    const label = this.stageLabels[event.stage] ?? event.stage;
    const pct = event.percent >= 0 ? ` (${event.percent}%)` : '';
    this.progress?.report({ message: `${label}${pct}` });
  }

  stageComplete(event: StageCompleteEvent): void {
    this.progress?.report({ message: `${this.stageLabels[event.stage] ?? event.stage} — done` });
  }

  stageError(event: StageErrorEvent): void {
    this.progress?.report({ message: `${this.stageLabels[event.stage] ?? event.stage}: ${event.error}` });
  }

  stageRetry(event: StageRetryEvent): void {
    this.progress?.report({
      message: `${this.stageLabels[event.stage] ?? event.stage}: retrying (${event.attempt}/${event.maxAttempts})`,
    });
  }

  pipelineComplete(event: PipelineCompleteEvent): void {
    this.progress?.report({
      message: event.success ? 'Pipeline complete' : 'Pipeline failed',
    });
  }
}
