/**
 * GitHub API Types for ISL Evidence PR Commenter
 * 
 * Types for interacting with GitHub's REST API to post and update
 * PR comments with ISL verification evidence reports.
 */

/**
 * GitHub Pull Request Comment
 */
export interface GitHubComment {
  id: number;
  node_id: string;
  url: string;
  html_url: string;
  body: string;
  user: {
    login: string;
    id: number;
    type: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * GitHub API Error Response
 */
export interface GitHubApiError {
  message: string;
  documentation_url?: string;
  status?: number;
}

/**
 * Environment configuration for GitHub operations
 */
export interface GitHubEnvConfig {
  /** GitHub token with PR write permissions */
  token: string;
  /** Repository owner (org or user) */
  owner: string;
  /** Repository name */
  repo: string;
  /** Pull request number */
  prNumber: number;
  /** GitHub API base URL (defaults to api.github.com) */
  apiBaseUrl: string;
}

/**
 * Evidence report input (simplified view of core EvidenceReport)
 */
export interface EvidenceReportInput {
  version: string;
  reportId?: string;
  specName?: string;
  specPath?: string;
  clauseResults: ClauseResultInput[];
  scoreSummary: ScoreSummaryInput;
  metadata?: {
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    agentVersion?: string;
  };
}

/**
 * Clause result input type
 */
export interface ClauseResultInput {
  clauseId: string;
  state: 'pass' | 'partial' | 'fail' | 'untested';
  score?: number;
  reason?: string;
  clauseType?: string;
  /** Source location if available */
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
}

/**
 * Score summary input type
 */
export interface ScoreSummaryInput {
  overallScore: number;
  passCount: number;
  partialCount: number;
  failCount: number;
  totalClauses: number;
  passRate?: number;
  confidence?: 'low' | 'medium' | 'high';
  recommendation: 'ship' | 'review' | 'block';
}

/**
 * Comment generation options
 */
export interface CommentOptions {
  /** Maximum number of failed clauses to show in detail */
  maxFailedClauses: number;
  /** Whether to include a collapsible full report section */
  includeFullReport: boolean;
  /** Custom footer text */
  footerText?: string;
}

/**
 * Result of posting/updating a comment
 */
export interface CommentResult {
  success: boolean;
  commentId?: number;
  commentUrl?: string;
  action: 'created' | 'updated';
  error?: string;
}
