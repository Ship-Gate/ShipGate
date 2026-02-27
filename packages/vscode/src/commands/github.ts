/**
 * GitHub connection commands
 *
 * Uses VS Code's built-in GitHub authentication provider (OAuth magic link).
 * Falls back to manual token from settings if the auth provider is unavailable.
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

/**
 * Acquire a GitHub token via VS Code's built-in OAuth (magic link).
 * Falls back to the manual `shipgate.github.token` setting.
 */
export async function acquireGitHubToken(interactive: boolean = true): Promise<string | null> {
  // 1. Try VS Code built-in GitHub auth provider (magic link / OAuth)
  try {
    const session = await vscode.authentication.getSession('github', ['repo', 'read:org'], {
      createIfNone: interactive,
    });
    if (session) {
      return session.accessToken;
    }
  } catch {
    // Auth provider unavailable or user cancelled — fall through
  }

  // 2. Fallback: manual token from settings
  const manualToken = vscode.workspace.getConfiguration('shipgate').get<string>('github.token', '');
  return manualToken || null;
}

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
      error: !parsed ? 'Not a GitHub repo' : 'Sign in to GitHub to connect.',
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
