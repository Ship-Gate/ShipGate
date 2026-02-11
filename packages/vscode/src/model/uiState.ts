/**
 * Normalized UI State Types + Builders
 *
 * JSON-safe types consumed by sidebar.js and report.js via postMessage.
 * Builders transform raw ScanResult / FirewallState / GitHubConnectionState
 * into these stable shapes — webviews never see raw CLI output.
 */

import type { ScanResult, FileFinding, Verdict } from './types';
import type { FirewallState } from '../services/firewallService';
import type { GitHubConnectionState } from '../services/githubService';

// ============================================================================
// Shared row types
// ============================================================================

export interface FindingRow {
  file: string;
  status: string;
  mode: string;
  score: number;
  blockers: string[];
  errors: string[];
}

export interface PrRow {
  number: number;
  title: string;
  htmlUrl: string;
}

export interface RunRow {
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
}

// ============================================================================
// Sidebar state
// ============================================================================

export interface SidebarUiState {
  phase: 'idle' | 'running' | 'complete';
  verdict: Verdict | null;
  score: number | null;
  drift: { pct: number; color: string; failedFiles: string[] } | null;
  counts: { total: number; pass: number; warn: number; fail: number };
  findingsPreview: FindingRow[];
  firewall: {
    status: string;
    violationCount: number;
    lastFile: string | null;
  };
  github: {
    connected: boolean;
    owner: string | null;
    repo: string | null;
    prCount: number;
    pulls: PrRow[];
    runs: RunRow[];
    error: string | null;
  };
  workflows: { name: string }[];
  islGeneratePath: string | null;
  metadata: {
    timestamp: string | null;
    duration: number | null;
    workspaceRoot: string;
  };
}

// ============================================================================
// Report state
// ============================================================================

export interface ReportUiState {
  verdict: Verdict | null;
  score: number | null;
  coverage: { specced: number; total: number };
  metadata: {
    timestamp: string | null;
    duration: number | null;
    workspaceRoot: string;
    configPath: string | null;
  };
  counts: { total: number; pass: number; warn: number; fail: number };
  findings: FindingRow[];
  blockers: string[];
  recommendations: string[];
}

// ============================================================================
// Builders
// ============================================================================

function fileToRow(f: FileFinding): FindingRow {
  return {
    file: f.file,
    status: f.status,
    mode: f.mode,
    score: f.score,
    blockers: f.blockers,
    errors: f.errors,
  };
}

function buildCounts(files: FileFinding[]): { total: number; pass: number; warn: number; fail: number } {
  let pass = 0;
  let warn = 0;
  let fail = 0;
  for (const f of files) {
    if (f.status === 'PASS') pass++;
    else if (f.status === 'WARN') warn++;
    else fail++;
  }
  return { total: files.length, pass, warn, fail };
}

function buildDrift(scan: ScanResult): { pct: number; color: string; failedFiles: string[] } {
  const pct = Math.round(scan.result.score * 100);
  const failedFiles = scan.result.files
    .filter((f) => f.status === 'FAIL' || (f.status === 'WARN' && f.blockers.length > 0))
    .map((f) => f.file)
    .slice(0, 8);
  const color =
    pct >= 80
      ? 'var(--vscode-testing-iconPassed, #238636)'
      : pct >= 50
        ? 'var(--vscode-editorWarning-foreground, #9e6a03)'
        : 'var(--vscode-editorError-foreground, #da3633)';
  return { pct, color, failedFiles };
}

export function buildSidebarState(opts: {
  scan: ScanResult | null;
  firewall: FirewallState;
  github: GitHubConnectionState;
  workflows: { name: string; path?: string }[];
  islGeneratePath: string | null;
  workspaceRoot: string;
}): SidebarUiState {
  const { scan, firewall, github, workflows, islGeneratePath, workspaceRoot } = opts;

  const files = scan?.result.files ?? [];
  const counts = buildCounts(files);

  const failAndWarn = files
    .filter((f) => f.status !== 'PASS')
    .sort((a, b) => a.score - b.score);
  const preview = failAndWarn.slice(0, 5).map(fileToRow);

  return {
    phase: scan ? 'complete' : 'idle',
    verdict: scan?.result.verdict ?? null,
    score: scan ? Math.round(scan.result.score * 100) : null,
    drift: scan ? buildDrift(scan) : null,
    counts,
    findingsPreview: preview,
    firewall: {
      status: firewall.status,
      violationCount: firewall.violationCount,
      lastFile: firewall.lastFile,
    },
    github: {
      connected: github.connected,
      owner: github.repo?.owner ?? null,
      repo: github.repo?.repo ?? null,
      prCount: github.pulls.length,
      pulls: github.pulls.slice(0, 5).map((p) => ({
        number: p.number,
        title: p.title,
        htmlUrl: p.htmlUrl,
      })),
      runs: (github.workflowRuns ?? []).slice(0, 5).map((r) => ({
        name: r.name,
        status: r.status,
        conclusion: r.conclusion,
        htmlUrl: r.htmlUrl,
      })),
      error: github.error,
    },
    workflows: workflows.map((w) => ({ name: w.name })),
    islGeneratePath,
    metadata: {
      timestamp: scan?.metadata.timestamp ?? null,
      duration: scan?.result.duration ?? null,
      workspaceRoot,
    },
  };
}

export function buildReportState(
  scan: ScanResult | null,
  workspaceRoot: string,
  configPath: string | null
): ReportUiState {
  if (!scan) {
    return {
      verdict: null,
      score: null,
      coverage: { specced: 0, total: 0 },
      metadata: { timestamp: null, duration: null, workspaceRoot, configPath },
      counts: { total: 0, pass: 0, warn: 0, fail: 0 },
      findings: [],
      blockers: [],
      recommendations: [],
    };
  }

  const z = scan.result;
  return {
    verdict: z.verdict,
    score: Math.round(z.score * 100),
    coverage: z.coverage,
    metadata: {
      timestamp: scan.metadata.timestamp,
      duration: z.duration,
      workspaceRoot,
      configPath,
    },
    counts: buildCounts(z.files),
    findings: z.files.map(fileToRow),
    blockers: z.blockers,
    recommendations: z.recommendations,
  };
}
