/**
 * isl-verify GitHub Action
 *
 * Runs ISL verification on pull request code and posts results as a PR comment.
 *
 * Usage:
 *   - uses: ./.github/actions/isl-verify
 *     with:
 *       isl-spec-path: ./spec.isl
 *       threshold: 70
 *       fail-on-no-ship: true
 *       api-key: ${{ secrets.ISL_API_KEY }}
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import { existsSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerifyOutput {
  verdict?: string;
  score?: number;
  trustScore?: number;
  mode?: string;
  files?: Array<{
    file: string;
    status: string;
    mode: string;
    score: number;
    specFile?: string | null;
    blockers: string[];
    errors: string[];
  }>;
  blockers?: string[];
  recommendations?: string[];
  coverage?: { specced: number; total: number };
  duration?: number;
  exitCode?: number;
}

interface ActionInputs {
  islSpecPath: string;
  threshold: number;
  failOnNoShip: boolean;
  apiKey: string;
  workingDirectory: string;
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

function parseInputs(): ActionInputs {
  const islSpecPath = core.getInput('isl-spec-path') || './spec.isl';
  const threshold = Math.max(0, Math.min(100, parseInt(core.getInput('threshold') || '70', 10)));
  const failOnNoShip = core.getInput('fail-on-no-ship') !== 'false';
  const apiKey = core.getInput('api-key', { required: true });
  const workingDirectory = core.getInput('working-directory') || '.';

  return { islSpecPath, threshold, failOnNoShip, apiKey, workingDirectory };
}

// ---------------------------------------------------------------------------
// Run ISL verify
// ---------------------------------------------------------------------------

async function runVerify(inputs: ActionInputs): Promise<VerifyOutput | null> {
  const cwd = resolve(process.cwd(), inputs.workingDirectory);

  // Build verify command
  const args: string[] = ['verify'];
  const hasSpec = existsSync(resolve(cwd, inputs.islSpecPath));
  if (hasSpec) {
    args.push('--spec', inputs.islSpecPath, '--impl', '.');
  } else {
    args.push('.');
  }
  args.push('--json', '--ci', '--min-score', String(inputs.threshold));

  core.info(`Running: npx isl ${args.join(' ')}`);

  let stdout = '';
  let stderr = '';

  const options = {
    cwd,
    silent: true,
    ignoreReturnCode: true,
    env: {
      ...process.env,
      ISL_API_KEY: inputs.apiKey,
      SHIPGATE_API_KEY: inputs.apiKey,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      },
    },
  };

  await exec.exec('npx', ['isl', ...args], options);

  // Parse JSON from output (CLI may emit non-JSON lines)
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as VerifyOutput;
    } catch {
      core.warning('Failed to parse JSON output');
    }
  }

  // Fallback: try to parse from stderr (some errors go there)
  const stderrMatch = stderr.match(/\{[\s\S]*\}/);
  if (stderrMatch) {
    try {
      return JSON.parse(stderrMatch[0]) as VerifyOutput;
    } catch {
      // ignore
    }
  }

  core.warning('No valid JSON in CLI output');
  return null;
}

// ---------------------------------------------------------------------------
// PR comment
// ---------------------------------------------------------------------------

const COMMENT_MARKER = '<!-- isl-verify -->';

function buildCommentBody(result: VerifyOutput, inputs: ActionInputs): string {
  const verdict = (result.verdict ?? 'NO_SHIP').toUpperCase();
  const score = result.score ?? result.trustScore ?? 0;
  const isShip = verdict === 'SHIP' || (verdict === 'WARN' && score >= inputs.threshold);

  const emoji = isShip ? '✅' : '❌';
  const statusText = isShip ? 'SHIP' : 'NO_SHIP';

  const lines: string[] = [
    COMMENT_MARKER,
    '',
    '## ISL Verify',
    '',
    `**Verdict: ${emoji} ${statusText}** (Score: ${score}% | Threshold: ${inputs.threshold}%)`,
    '',
  ];

  if (result.coverage && result.coverage.total > 0) {
    const pct = Math.round((result.coverage.specced / result.coverage.total) * 100);
    lines.push(`> **Coverage:** ${result.coverage.specced}/${result.coverage.total} files with ISL specs (${pct}%)`);
    lines.push('');
  }

  if (result.files && result.files.length > 0) {
    lines.push('| File | Status | Score |');
    lines.push('|------|--------|-------|');
    const displayFiles = result.files.slice(0, 20);
    for (const f of displayFiles) {
      const statusEmoji = f.status === 'PASS' ? '✅' : f.status === 'WARN' ? '⚠️' : '❌';
      lines.push(`| \`${f.file}\` | ${statusEmoji} ${f.status} | ${f.score}% |`);
    }
    if (result.files.length > 20) {
      lines.push(`| *...and ${result.files.length - 20} more* | | |`);
    }
    lines.push('');
  }

  if (result.blockers && result.blockers.length > 0) {
    lines.push('**Blockers:**');
    for (const b of result.blockers.slice(0, 10)) {
      lines.push(`- ${b}`);
    }
    if (result.blockers.length > 10) {
      lines.push(`- *...and ${result.blockers.length - 10} more*`);
    }
    lines.push('');
  }

  if (result.recommendations && result.recommendations.length > 0) {
    lines.push('**Recommendations:**');
    for (const r of result.recommendations.slice(0, 5)) {
      lines.push(`- ${r}`);
    }
    lines.push('');
  }

  if (!isShip) {
    lines.push('**Fix issues before merging.** Run locally:');
    lines.push('```bash');
    lines.push('npx isl verify . --json --ci');
    lines.push('```');
    lines.push('');
  }

  lines.push('---');
  lines.push('<sub>isl-verify • [Docs](https://intentlang.dev)</sub>');

  return lines.join('\n');
}

async function postPRComment(body: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.warning('GITHUB_TOKEN not available; skipping PR comment');
    return;
  }

  const ctx = github.context;
  if (!ctx.payload.pull_request) {
    core.info('Not a pull request event; skipping PR comment');
    return;
  }

  const octokit = github.getOctokit(token);
  const issueNumber = ctx.payload.pull_request.number;

  try {
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: ctx.repo.owner,
      repo: ctx.repo.repo,
      issue_number: issueNumber,
    });

    const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

    if (existing) {
      await octokit.rest.issues.updateComment({
        owner: ctx.repo.owner,
        repo: ctx.repo.repo,
        comment_id: existing.id,
        body,
      });
      core.info(`Updated PR comment #${existing.id}`);
    } else {
      const { data: newComment } = await octokit.rest.issues.createComment({
        owner: ctx.repo.owner,
        repo: ctx.repo.repo,
        issue_number: issueNumber,
        body,
      });
      core.info(`Created PR comment #${newComment.id}`);
    }
  } catch (err) {
    core.warning(`Failed to post PR comment: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  try {
    const inputs = parseInputs();

    // Node 20 is provided by the action runtime. Use npx isl (resolves to local or npm)
    core.info('Running ISL verification...');
    const result = await runVerify(inputs);

    if (!result) {
      core.setFailed('ISL verification failed: no parseable output');
      return;
    }

    const verdict = (result.verdict ?? 'NO_SHIP').toUpperCase();
    const score = result.score ?? result.trustScore ?? 0;
    const isShip = verdict === 'SHIP' || (verdict === 'WARN' && score >= inputs.threshold);
    const passed = isShip;

    core.setOutput('verdict', isShip ? 'SHIP' : 'NO_SHIP');
    core.setOutput('score', String(score));
    core.setOutput('passed', String(passed));

    core.info('');
    core.info('='.repeat(50));
    core.info(`  ISL Verify: ${isShip ? 'SHIP' : 'NO_SHIP'} (score: ${score}%)`);
    core.info('='.repeat(50));
    core.info('');

    await postPRComment(buildCommentBody(result, inputs));

    if (inputs.failOnNoShip && !passed) {
      core.setFailed(`ISL verification failed: ${verdict} (score ${score}% below threshold ${inputs.threshold}%)`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(`isl-verify action failed: ${msg}`);
    if (error instanceof Error && error.stack) {
      core.debug(error.stack);
    }
  }
}

run();
