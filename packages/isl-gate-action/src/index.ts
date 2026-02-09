/**
 * Shipgate GitHub Action
 *
 * Unified gate: runs ISL spec verification (when spec exists) + firewall on
 * all changed files. Returns SHIP or NO_SHIP.
 *
 * Usage:
 *   - uses: shipgate/isl-verify@v1
 *     with:
 *       spec: specs/auth.isl        # optional
 *       implementation: src/
 *       threshold: 70
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { DefaultArtifactClient } from '@actions/artifact';
import {
  runUnifiedGate,
  type CombinedVerdictResult,
} from '@isl-lang/verified-build';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChangedFiles(): string[] {
  try {
    const eventName = github.context.eventName;
    let base: string;

    if (eventName === 'pull_request') {
      base = github.context.payload.pull_request?.base?.sha ?? 'HEAD~1';
    } else {
      base = 'HEAD~1';
    }

    const raw = execSync(`git diff --name-only ${base} HEAD`, {
      encoding: 'utf-8',
    });

    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && /\.(ts|js|tsx|jsx)$/.test(l));
  } catch {
    core.warning('Could not determine changed files via git diff');
    return [];
  }
}

function autoDiscoverSpec(): string | undefined {
  const candidates = [
    'specs',
    '.shipgate/specs',
    '.vibecheck/specs',
    'src',
    '.',
  ];

  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    try {
      const raw = execSync(
        `git ls-files "${dir}" -- "*.isl" 2>/dev/null || find "${dir}" -name "*.isl" -type f -not -path "*/node_modules/*" 2>/dev/null`,
        { encoding: 'utf-8' },
      );
      const first = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.endsWith('.isl'));
      if (first) return first;
    } catch {
      // continue
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// PR Comment
// ---------------------------------------------------------------------------

async function commentOnPR(result: CombinedVerdictResult): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.warning('GITHUB_TOKEN not available; skipping PR comment');
    return;
  }

  const octokit = github.getOctokit(token);
  const ctx = github.context;

  if (!ctx.payload.pull_request) return;

  const issueNumber = ctx.payload.pull_request.number;
  const emoji = result.verdict === 'SHIP' ? '✅' : '❌';
  const sources = result.sources.join(', ') || 'none';

  const blockers = result.reasons.filter((r) => r.blocking);
  const warnings = result.reasons.filter((r) => !r.blocking);

  let body = `## ${emoji} Shipgate: ${result.verdict}\n\n`;
  body += `| Metric | Value |\n`;
  body += `|--------|-------|\n`;
  body += `| Score | ${result.score}/100 |\n`;
  body += `| Sources | ${sources} |\n`;

  if (blockers.length > 0) {
    body += `\n### Blockers (${blockers.length})\n\n`;
    body += `| Severity | Code | Message |\n`;
    body += `|----------|------|---------|\n`;
    for (const b of blockers.slice(0, 15)) {
      body += `| ${b.severity} | \`${b.code}\` | ${b.message} |\n`;
    }
    if (blockers.length > 15) {
      body += `\n*...and ${blockers.length - 15} more blockers*\n`;
    }
  }

  if (warnings.length > 0) {
    body += `\n<details>\n<summary>Warnings (${warnings.length})</summary>\n\n`;
    for (const w of warnings.slice(0, 10)) {
      body += `- **${w.code}**: ${w.message}\n`;
    }
    body += `\n</details>\n`;
  }

  if (result.verdict === 'SHIP') {
    body += `\n**All checks passed. Safe to merge.**\n`;
  } else {
    body += `\n**Fix issues before merging.**\n`;
    body += `\nRun locally:\n\`\`\`bash\nnpx shipgate verify --ci\n\`\`\`\n`;
  }

  body += `\n---\n*Shipgate — One YAML file between your AI and production.*`;

  // Upsert comment
  const { data: comments } = await octokit.rest.issues.listComments({
    owner: ctx.repo.owner,
    repo: ctx.repo.repo,
    issue_number: issueNumber,
  });

  const existing = comments.find(
    (c) => c.user?.type === 'Bot' && c.body?.includes('Shipgate:'),
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
  } else {
    await octokit.rest.issues.createComment({
      ...commentPayload,
      issue_number: issueNumber,
    });
  }
}

// ---------------------------------------------------------------------------
// Evidence Upload
// ---------------------------------------------------------------------------

async function uploadEvidence(evidenceDir: string): Promise<void> {
  if (!existsSync(evidenceDir)) return;

  try {
    const artifact = new DefaultArtifactClient();
    const files = execSync(`find "${evidenceDir}" -type f`, {
      encoding: 'utf-8',
    })
      .split(/\r?\n/)
      .filter(Boolean);

    if (files.length === 0) return;

    const sha = github.context.sha.slice(0, 8);
    await artifact.uploadArtifact(
      `shipgate-evidence-${sha}`,
      files,
      evidenceDir,
      { retentionDays: 90 },
    );

    core.info(`Uploaded ${files.length} evidence files`);
  } catch (err) {
    core.warning(
      `Evidence upload failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  const startTime = Date.now();

  try {
    // Parse inputs
    const specInput = core.getInput('spec') || undefined;
    const implementation = core.getInput('implementation') || '.';
    const threshold = parseInt(core.getInput('threshold') || '70', 10);
    const failOnNoShip = core.getInput('fail-on-no-ship') !== 'false';
    const shouldComment = core.getInput('comment-on-pr') !== 'false';
    const shouldUpload = core.getInput('upload-evidence') !== 'false';
    const dependencyAudit = core.getInput('dependency-audit') === 'true';

    // Resolve spec (explicit or auto-discover)
    const spec = specInput || autoDiscoverSpec();
    if (spec) {
      core.info(`Spec: ${spec}`);
    } else {
      core.info('No ISL spec found; running firewall-only mode');
    }

    // Get changed files
    const changedFiles = getChangedFiles();
    core.info(`Changed files: ${changedFiles.length}`);

    // Evidence directory
    const evidenceDir = resolve(process.cwd(), 'evidence');
    mkdirSync(evidenceDir, { recursive: true });

    // Run unified gate
    core.info('Running Shipgate unified gate...');
    const result = await runUnifiedGate({
      projectRoot: process.cwd(),
      spec,
      implementation,
      filesToCheck: changedFiles.length > 0 ? changedFiles : undefined,
      evidencePath: './evidence',
      writeBundle: true,
      dependencyAudit,
      git: {
        sha: github.context.sha,
        branch: github.context.ref.replace('refs/heads/', ''),
      },
      ci: {
        runId: String(github.context.runId),
        provider: 'github',
      },
    });

    const durationMs = Date.now() - startTime;

    // Write result JSON for downstream steps
    const resultPath = join(process.cwd(), 'shipgate-result.json');
    writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');

    // Log summary
    const blockerCount = result.reasons.filter((r) => r.blocking).length;
    core.info('');
    core.info('='.repeat(60));
    if (result.verdict === 'SHIP') {
      core.info(`  Shipgate: SHIP (score: ${result.score}/100) [${durationMs}ms]`);
    } else {
      core.info(
        `  Shipgate: NO_SHIP (score: ${result.score}/100, ${blockerCount} blockers) [${durationMs}ms]`,
      );
    }
    core.info('='.repeat(60));
    core.info('');

    // Set outputs
    core.setOutput('verdict', result.verdict);
    core.setOutput('score', String(result.score));
    core.setOutput('sources', result.sources.join(','));
    core.setOutput('evidence-path', 'evidence/');

    // Upload evidence
    if (shouldUpload) {
      await uploadEvidence(evidenceDir);
    }

    // Comment on PR
    if (shouldComment && github.context.eventName === 'pull_request') {
      await commentOnPR(result);
    }

    // Fail workflow on NO_SHIP
    if (failOnNoShip && result.verdict === 'NO_SHIP') {
      core.setFailed(
        `Shipgate: NO_SHIP (score: ${result.score}/100, ${blockerCount} blockers)`,
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(`Shipgate action failed: ${msg}`);
    if (error instanceof Error && error.stack) {
      core.debug(error.stack);
    }
  }
}

run();
