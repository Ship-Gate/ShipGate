/**
 * ISL Adapters - GitHub Types
 * 
 * @module @isl-lang/adapters/github
 */

/**
 * GitHub Action inputs
 */
export interface ActionInputs {
  mode: 'check' | 'enforce';
  token: string;
  workingDirectory: string;
  specPattern: string;
  changedOnly: boolean;
  failOn: 'no_ship' | 'warn' | 'never';
  outputFormat: 'json' | 'sarif' | 'markdown';
  uploadEvidence: boolean;
}

/**
 * GitHub Action outputs
 */
export interface ActionOutputs {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  evidencePath: string;
  prCommentUrl?: string;
}

/**
 * GitHub context from environment
 */
export interface GitHubContext {
  eventName: string;
  sha: string;
  ref: string;
  workflow: string;
  action: string;
  actor: string;
  job: string;
  runNumber: number;
  runId: number;
  repository: string;
  repositoryOwner: string;
  pullRequest?: {
    number: number;
    head: { sha: string; ref: string };
    base: { sha: string; ref: string };
  };
}

/**
 * PR comment data
 */
export interface PRComment {
  body: string;
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  issueCount: number;
  criticalCount: number;
  evidenceUrl?: string;
}

/**
 * GitHub check run status
 */
export type CheckStatus = 'queued' | 'in_progress' | 'completed';
export type CheckConclusion = 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped';
