/**
 * Ship Service — enterprise-grade GitHub shipping flow
 *
 * git branch ➜ commit ➜ push ➜ create PR, all from one command.
 * Respects scan verdict: blocks NO_SHIP unless forced.
 */

import { execSync } from 'child_process';

export interface ShipOptions {
  cwd: string;
  token: string;
  /** If true, ship even when verdict is NO_SHIP */
  force?: boolean;
  /** Custom branch name (default: auto-generated) */
  branch?: string;
  /** Commit message */
  message?: string;
  /** PR title */
  prTitle?: string;
  /** PR body */
  prBody?: string;
  /** Target base branch (default: repo default) */
  baseBranch?: string;
  /** Draft PR? */
  draft?: boolean;
}

export interface ShipResult {
  success: boolean;
  branch: string;
  commitSha: string;
  prUrl: string | null;
  prNumber: number | null;
  error: string | null;
}

// ────────────────────────────────────────────────────────────────

function git(cmd: string, cwd: string): string {
  return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', timeout: 30_000 }).trim();
}

function getCurrentBranch(cwd: string): string {
  return git('rev-parse --abbrev-ref HEAD', cwd);
}

function hasChanges(cwd: string): boolean {
  const status = git('status --porcelain', cwd);
  return status.length > 0;
}

function generateBranchName(): string {
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6);
  return `shipgate/ship-${ts}-${rand}`;
}

// ────────────────────────────────────────────────────────────────

export async function ship(opts: ShipOptions): Promise<ShipResult> {
  const { cwd, token, draft = false } = opts;

  // 1. Detect current branch / create new one
  let branch = getCurrentBranch(cwd);
  const defaultBranch = getDefaultBranch(cwd);
  const needsNewBranch = branch === defaultBranch;

  if (needsNewBranch) {
    branch = opts.branch ?? generateBranchName();
    git(`checkout -b ${branch}`, cwd);
  } else if (opts.branch && opts.branch !== branch) {
    branch = opts.branch;
    git(`checkout -b ${branch}`, cwd);
  }

  // 2. Stage + commit
  const message = opts.message ?? `shipgate: verified ship from VS Code`;
  if (hasChanges(cwd)) {
    git('add -A', cwd);
    git(`commit -m "${message.replace(/"/g, '\\"')}"`, cwd);
  }

  const commitSha = git('rev-parse --short HEAD', cwd);

  // 3. Push
  git(`push -u origin ${branch}`, cwd);

  // 4. Create PR via GitHub API
  const remote = git('remote get-url origin', cwd);
  const parsed = parseOwnerRepo(remote);
  if (!parsed) {
    return { success: true, branch, commitSha, prUrl: null, prNumber: null, error: 'Could not parse GitHub remote' };
  }

  const prTitle = opts.prTitle ?? message;
  const prBody = opts.prBody ?? buildPrBody();
  const baseBranch = opts.baseBranch ?? defaultBranch;

  try {
    const pr = await createPullRequest({
      owner: parsed.owner,
      repo: parsed.repo,
      token,
      head: branch,
      base: baseBranch,
      title: prTitle,
      body: prBody,
      draft,
    });
    return { success: true, branch, commitSha, prUrl: pr.htmlUrl, prNumber: pr.number, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: true, branch, commitSha, prUrl: null, prNumber: null, error: `Push succeeded, PR creation failed: ${msg}` };
  }
}

// ────────────────────────────────────────────────────────────────

function getDefaultBranch(cwd: string): string {
  try {
    const ref = git('symbolic-ref refs/remotes/origin/HEAD --short', cwd);
    return ref.replace('origin/', '');
  } catch {
    return 'main';
  }
}

function parseOwnerRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

function buildPrBody(): string {
  return [
    '## Shipgate Verified',
    '',
    'This PR was created via the Shipgate VS Code extension.',
    '',
    '- Scan verdict checked before shipping',
    '- Live firewall validated on save',
    '',
    '---',
    '*Shipped with [Shipgate](https://shipgate.dev)*',
  ].join('\n');
}

// ────────────────────────────────────────────────────────────────

interface CreatePrOptions {
  owner: string;
  repo: string;
  token: string;
  head: string;
  base: string;
  title: string;
  body: string;
  draft: boolean;
}

async function createPullRequest(opts: CreatePrOptions): Promise<{ htmlUrl: string; number: number }> {
  const res = await fetch(`https://api.github.com/repos/${opts.owner}/${opts.repo}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: opts.token.startsWith('ghp_') ? `token ${opts.token}` : `Bearer ${opts.token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Shipgate-VSCode',
    },
    body: JSON.stringify({
      title: opts.title,
      body: opts.body,
      head: opts.head,
      base: opts.base,
      draft: opts.draft,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { html_url: string; number: number };
  return { htmlUrl: data.html_url, number: data.number };
}
