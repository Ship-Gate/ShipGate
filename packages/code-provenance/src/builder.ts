/**
 * Line Attribution Builder
 *
 * Combines git blame data with agent classification to produce
 * per-line, per-file, and per-project attribution reports.
 *
 * @module @isl-lang/code-provenance
 */

import { execSync } from 'child_process';
import type {
  LineAttribution,
  FileAttribution,
  ProjectAttribution,
  ProjectSummary,
  AgentTool,
  Confidence,
  ProvenanceScanOptions,
  AuthorStats,
  ContributorSummary,
} from './types.js';
import { blameFile, listTrackedFiles } from './blame.js';
import { extractAISignals } from './commit-parser.js';
import { CommitCache } from './cache.js';
import {
  detectConfigSignals,
  loadProvenanceSession,
  determineConfidence,
  type ClassifierContext,
} from './classifier.js';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE } from './types.js';

/**
 * Build line-level attribution for a single file.
 */
export function buildFileAttribution(
  filePath: string,
  commitCache: CommitCache,
  cwd: string,
): FileAttribution {
  const entries = blameFile(filePath, cwd);

  const lines: LineAttribution[] = [];
  const byAgent: Partial<Record<AgentTool, number>> = {};
  const byAuthor: Record<string, number> = {};
  let humanLines = 0;
  let aiLines = 0;
  let unknownLines = 0;

  for (const entry of entries) {
    const cached = commitCache.get(entry.commitHash);

    const agent = cached?.agent ?? null;
    const commitMessage = cached?.meta.message ?? entry.summary;
    const signals = cached?.meta ? extractAISignals(cached.meta) : [];
    const confidence: Confidence = cached
      ? determineConfidence(agent, signals)
      : 'low';

    const timestamp = new Date(entry.authorTimestamp * 1000).toISOString();

    lines.push({
      line: entry.lineNumber,
      content: entry.content,
      author: { name: entry.authorName, email: entry.authorEmail },
      agent,
      commit: { hash: entry.commitHash, message: commitMessage, timestamp },
      confidence,
    });

    const authorKey = entry.authorEmail || entry.authorName;
    byAuthor[authorKey] = (byAuthor[authorKey] ?? 0) + 1;

    if (agent) {
      aiLines++;
      byAgent[agent.tool] = (byAgent[agent.tool] ?? 0) + 1;
    } else if (entry.commitHash === '0000000000000000000000000000000000000000') {
      unknownLines++;
    } else {
      humanLines++;
    }
  }

  return {
    path: filePath,
    totalLines: lines.length,
    humanLines,
    aiLines,
    unknownLines,
    byAgent,
    byAuthor,
    lines,
  };
}

/**
 * Get git repository info (repository URL, branch, commit hash).
 */
function getGitInfo(cwd: string): { repository: string; branch: string; commit: string } {
  const run = (cmd: string) => {
    try {
      return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch {
      return 'unknown';
    }
  };
  return {
    repository: run('git remote get-url origin'),
    branch: run('git rev-parse --abbrev-ref HEAD'),
    commit: run('git rev-parse --short HEAD'),
  };
}

/**
 * Build a project summary from file attributions.
 */
function buildSummary(files: FileAttribution[]): ProjectSummary {
  let totalLines = 0;
  let humanAuthored = 0;
  let aiAuthored = 0;
  let unknown = 0;
  const byAgent: Partial<Record<AgentTool, number>> = {};
  const authorMap = new Map<string, { total: number; withAi: number; name: string }>();

  for (const file of files) {
    totalLines += file.totalLines;
    humanAuthored += file.humanLines;
    aiAuthored += file.aiLines;
    unknown += file.unknownLines;

    for (const [agent, count] of Object.entries(file.byAgent)) {
      const key = agent as AgentTool;
      byAgent[key] = (byAgent[key] ?? 0) + (count ?? 0);
    }

    for (const line of file.lines) {
      const key = line.author.email || line.author.name;
      const existing = authorMap.get(key) ?? { total: 0, withAi: 0, name: line.author.name };
      existing.total++;
      if (line.agent) existing.withAi++;
      authorMap.set(key, existing);
    }
  }

  const byAuthor: Record<string, AuthorStats> = {};
  const contributors: ContributorSummary[] = [];

  for (const [email, stats] of authorMap.entries()) {
    byAuthor[email] = { total: stats.total, withAi: stats.withAi };
    contributors.push({
      name: stats.name,
      email,
      lines: stats.total,
      aiPercentage: stats.total > 0 ? Math.round((stats.withAi / stats.total) * 100) : 0,
    });
  }

  contributors.sort((a, b) => b.lines - a.lines);

  return {
    totalLines,
    humanAuthored,
    aiAuthored,
    unknown,
    byAgent,
    byAuthor,
    topContributors: contributors.slice(0, 20),
  };
}

/**
 * Build full project-level attribution by scanning all tracked files.
 */
export function buildProjectAttribution(
  options: ProvenanceScanOptions = {},
): ProjectAttribution {
  const cwd = options.cwd ?? process.cwd();
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;

  const provenanceSession = loadProvenanceSession(cwd);
  const configSignals = detectConfigSignals(cwd);

  const ctx: ClassifierContext = { cwd, provenanceSession, configSignals };
  const commitCache = new CommitCache(ctx);

  let trackedFiles = listTrackedFiles(cwd, include, exclude);

  if (options.maxFiles && trackedFiles.length > options.maxFiles) {
    trackedFiles = trackedFiles.slice(0, options.maxFiles);
  }

  const files: FileAttribution[] = [];
  for (const filePath of trackedFiles) {
    const fileAttr = buildFileAttribution(filePath, commitCache, cwd);
    if (fileAttr.totalLines > 0) {
      files.push(fileAttr);
    }
  }

  const gitInfo = getGitInfo(cwd);
  const summary = buildSummary(files);

  return {
    repository: gitInfo.repository,
    branch: gitInfo.branch,
    commit: gitInfo.commit,
    generatedAt: new Date().toISOString(),
    files,
    summary,
  };
}

/**
 * Build attribution for a single file path.
 */
export function buildSingleFileAttribution(
  filePath: string,
  cwd?: string,
): FileAttribution {
  const resolvedCwd = cwd ?? process.cwd();

  const provenanceSession = loadProvenanceSession(resolvedCwd);
  const configSignals = detectConfigSignals(resolvedCwd);

  const ctx: ClassifierContext = { cwd: resolvedCwd, provenanceSession, configSignals };
  const commitCache = new CommitCache(ctx);

  return buildFileAttribution(filePath, commitCache, resolvedCwd);
}
