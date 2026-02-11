/**
 * GitHub API types
 */

export interface GitHubComment {
  id: number;
  body: string;
  user: {
    type: 'User' | 'Bot';
    login: string;
  };
  created_at: string;
  updated_at: string;
}

export interface GitHubCheckRun {
  id: number;
  name: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required';
  output?: {
    title: string;
    summary: string;
    text?: string;
    annotations?: GitHubCheckAnnotation[];
  };
}

export interface GitHubCheckAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: 'notice' | 'warning' | 'failure';
  message: string;
  title?: string;
  start_column?: number;
  end_column?: number;
}

export interface GitHubPullRequestFile {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch: string;
  previous_filename?: string;
}
