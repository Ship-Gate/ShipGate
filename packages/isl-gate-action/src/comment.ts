/**
 * ShipGate ISL Verify — PR Comment
 *
 * Generates a structured Markdown PR comment with verification results
 * and upserts it on the pull request (updates existing comment on re-run).
 *
 * @module @isl-lang/gate-action/comment
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import type { VerifyResult, FileResult } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMMENT_MARKER = '<!-- shipgate-isl-verify -->';
const VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Markdown builder
// ---------------------------------------------------------------------------

function verdictEmoji(verdict: string): string {
  switch (verdict) {
    case 'SHIP':
      return '\u2705';
    case 'WARN':
      return '\u26A0\uFE0F';
    case 'NO_SHIP':
      return '\u274C';
    default:
      return '\u2753';
  }
}

function statusEmoji(status: string): string {
  switch (status) {
    case 'PASS':
      return '\u2705';
    case 'WARN':
      return '\u26A0\uFE0F';
    case 'FAIL':
      return '\u274C';
    default:
      return '\u2796';
  }
}

function formatScore(score: number): string {
  return score.toFixed(2);
}

/**
 * Build the Markdown body for the PR comment.
 */
export function buildCommentBody(result: VerifyResult): string {
  const lines: string[] = [];

  lines.push(COMMENT_MARKER);
  lines.push('');
  lines.push(`## ShipGate ISL Verify`);
  lines.push('');
  lines.push(
    `**Verdict: ${verdictEmoji(result.verdict)} ${result.verdict}** (Score: ${formatScore(result.score)})`,
  );
  lines.push('');

  // Coverage line
  const covPct =
    result.coverage.total > 0
      ? Math.round(
          (result.coverage.specced / result.coverage.total) * 100,
        )
      : 0;
  lines.push(
    `> **Coverage:** ${result.coverage.specced}/${result.coverage.total} files have ISL specs (${covPct}%)`,
  );
  lines.push('');

  // File results table
  if (result.files.length > 0) {
    lines.push('| File | Status | Method | Score |');
    lines.push('|------|--------|--------|-------|');

    // Sort: failures first, then warnings, then passes
    const sorted = [...result.files].sort((a, b) => {
      const order = { FAIL: 0, WARN: 1, PASS: 2 };
      return (
        (order[a.status] ?? 3) - (order[b.status] ?? 3)
      );
    });

    // Show up to 25 files, truncate the rest
    const displayFiles = sorted.slice(0, 25);
    for (const file of displayFiles) {
      lines.push(
        `| \`${file.file}\` | ${statusEmoji(file.status)} ${file.status} | ${file.method} | ${formatScore(file.score)} |`,
      );
    }

    if (sorted.length > 25) {
      lines.push(
        `| *...and ${sorted.length - 25} more files* | | | |`,
      );
    }

    lines.push('');
  }

  // Blockers section
  if (result.blockers.length > 0) {
    lines.push('**Blockers:**');
    const displayBlockers = result.blockers.slice(0, 10);
    for (const blocker of displayBlockers) {
      lines.push(`- ${blocker}`);
    }
    if (result.blockers.length > 10) {
      lines.push(
        `- *...and ${result.blockers.length - 10} more blockers*`,
      );
    }
    lines.push('');
  }

  // Recommendations section
  if (result.recommendations.length > 0) {
    lines.push('**Recommendations:**');
    for (const rec of result.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  // Verdict-specific message
  if (result.verdict === 'SHIP') {
    lines.push('**All checks passed. Safe to merge.**');
    lines.push('');
  } else if (result.verdict === 'NO_SHIP') {
    lines.push('**Fix issues before merging.**');
    lines.push('');
    lines.push('Run locally:');
    lines.push('```bash');
    lines.push('npx shipgate verify --ci');
    lines.push('```');
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(
    `<sub>ShipGate ISL v${VERSION} \u2022 <a href="https://shipgate.dev">Docs</a></sub>`,
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PR comment upsert
// ---------------------------------------------------------------------------

/**
 * Post (or update) a PR comment with the verification results.
 * Requires `GITHUB_TOKEN` to be set in the environment.
 */
export async function postPRComment(result: VerifyResult): Promise<void> {
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
  const body = buildCommentBody(result);

  try {
    // List existing comments to find our previous one
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: ctx.repo.owner,
      repo: ctx.repo.repo,
      issue_number: issueNumber,
    });

    const existing = comments.find(
      (c) => c.body?.includes(COMMENT_MARKER),
    );

    const commentPayload = {
      owner: ctx.repo.owner,
      repo: ctx.repo.repo,
      body,
    };

    if (existing) {
      await octokit.rest.issues.updateComment({
        ...commentPayload,
        comment_id: existing.id,
      });
      core.info(`Updated PR comment #${existing.id}`);
    } else {
      const { data: newComment } = await octokit.rest.issues.createComment({
        ...commentPayload,
        issue_number: issueNumber,
      });
      core.info(`Created PR comment #${newComment.id}`);
    }
  } catch (err) {
    core.warning(
      `Failed to post PR comment: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
