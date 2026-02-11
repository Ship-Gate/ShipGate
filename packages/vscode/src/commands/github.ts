/**
 * GitHub connection commands
 */

import * as vscode from 'vscode';
import { execSync } from 'child_process';
import {
  parseGitHubRemote,
  fetchRepoInfo,
  fetchPullRequests,
  fetchWorkflowRuns,
  type GitHubConnectionState,
} from '../services/githubService';

export async function getGitRemoteUrl(workspaceRoot: string): Promise<string | null> {
  try {
    return execSync('git remote get-url origin', {
      cwd: workspaceRoot,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return null;
  }
}

export async function loadGitHubState(
  workspaceRoot: string,
  token: string
): Promise<GitHubConnectionState> {
  const url = await getGitRemoteUrl(workspaceRoot);
  const parsed = url ? parseGitHubRemote(url) : null;

  if (!parsed || !token) {
    return {
      connected: false,
      repo: null,
      pulls: [],
      workflowRuns: [],
      error: !parsed ? 'Not a GitHub repo' : 'Token required',
    };
  }

  try {
    const [repo, pulls, workflowRuns] = await Promise.all([
      fetchRepoInfo(parsed.owner, parsed.repo, token),
      fetchPullRequests(parsed.owner, parsed.repo, token),
      fetchWorkflowRuns(parsed.owner, parsed.repo, token, 5),
    ]);
    return {
      connected: true,
      repo,
      pulls,
      workflowRuns,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      repo: null,
      pulls: [],
      workflowRuns: [],
      error: msg,
    };
  }
}
