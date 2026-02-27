/**
 * GitHub Service for VS Code Extension
 *
 * Fetches repo info, PRs, and workflow runs via GitHub API.
 * Requires shipgate.github.token in settings.
 */

const GITHUB_API = 'https://api.github.com';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
  headRef: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
}

export interface GitHubConnectionState {
  connected: boolean;
  repo: GitHubRepoInfo | null;
  pulls: GitHubPullRequest[];
  workflowRuns: GitHubWorkflowRun[];
  error: string | null;
}

/**
 * Parse owner/repo from git remote URL.
 */
export function parseGitHubRemote(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/**
 * Fetch GitHub repo info.
 */
export async function fetchRepoInfo(
  owner: string,
  repo: string,
  token: string
): Promise<GitHubRepoInfo> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
  const data = (await res.json()) as { default_branch: string; html_url: string };
  return {
    owner,
    repo,
    defaultBranch: data.default_branch ?? 'main',
    url: data.html_url ?? `https://github.com/${owner}/${repo}`,
  };
}

/**
 * Fetch open pull requests.
 */
export async function fetchPullRequests(
  owner: string,
  repo: string,
  token: string
): Promise<GitHubPullRequest[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=open&per_page=10`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    number: number;
    title: string;
    state: string;
    html_url: string;
    head: { ref: string };
  }>;
  return data.map((p) => ({
    number: p.number,
    title: p.title,
    state: p.state,
    htmlUrl: p.html_url,
    headRef: p.head?.ref ?? '',
  }));
}

/**
 * Fetch recent workflow runs.
 */
export async function fetchWorkflowRuns(
  owner: string,
  repo: string,
  token: string,
  limit = 5
): Promise<GitHubWorkflowRun[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/runs?per_page=${limit}`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    workflow_runs?: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
      created_at: string;
    }>;
  };
  const runs = data.workflow_runs ?? [];
  return runs.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    htmlUrl: r.html_url,
    createdAt: r.created_at,
  }));
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: token.startsWith('ghp_') ? `token ${token}` : `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Shipgate-VSCode',
  };
}
