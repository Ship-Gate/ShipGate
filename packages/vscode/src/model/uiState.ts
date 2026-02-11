/**
 * Normalized webview state types for Shipgate sidebar and report.
 *
 * Both webviews consume these JSON-safe types via postMessage.
 */

import type { ScanResult } from './types';
import type { GitHubConnectionState } from '../services/githubService';
import type { FirewallState } from '../services/firewallService';

export type VerdictType = 'SHIP' | 'WARN' | 'NO_SHIP';

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
  conclusion: string | null;
  status: string;
  htmlUrl: string;
}

export interface SidebarUiState {
  phase: 'idle' | 'running' | 'complete';
  verdict: VerdictType | null;
  score: number | null;
  drift: { pct: number; color: string; failedFiles: string[] } | null;
  counts: { total: number; pass: number; warn: number; fail: number };
  findingsPreview: FindingRow[];
  firewall: {
    enabled: boolean;
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
  };
  workflows: { name: string }[];
  metadata: {
    timestamp: string | null;
    duration: number | null;
    workspaceRoot: string;
  };
  islGeneratePath: string | null;
  intentBuilder: {
    phase: 'idle' | 'generating' | 'scanning' | 'codegen' | 'done';
    prompt: string | null;
    message: string | null;
    error: string | null;
    score: number | null;
    verdict: string | null;
    hasApiKey: boolean;
  };
}

export interface ReportUiState {
  verdict: VerdictType | null;
  score: number | null;
  coverage: { specced: number; total: number };
  metadata: {
    timestamp: string;
    duration: number;
    workspaceRoot: string;
    configPath: string | null;
  };
  counts: { total: number; pass: number; warn: number; fail: number };
  findings: FindingRow[];
  blockers: string[];
  recommendations: string[];
}

export interface SidebarInput {
  scan: ScanResult | null;
  github: GitHubConnectionState;
  workflows: { name: string; path?: string }[];
  islGeneratePath: string | null;
  firewall: FirewallState;
  firewallEnabled?: boolean;
  intentBuilder?: {
    phase: 'idle' | 'generating' | 'scanning' | 'codegen' | 'done';
    prompt: string | null;
    message: string | null;
    error: string | null;
    score: number | null;
    verdict: string | null;
    hasApiKey: boolean;
  };
  phase?: 'idle' | 'running' | 'complete';
  workspaceRoot?: string;
}

/**
 * Build normalized sidebar state from extension state.
 */
export function buildSidebarState(input: SidebarInput): SidebarUiState {
  const {
    scan,
    github,
    workflows,
    islGeneratePath,
    firewall,
    phase: inputPhase = scan ? 'complete' : 'idle',
    workspaceRoot: inputWorkspaceRoot = '',
  } = input;

  const phase = inputPhase;

  const z = scan?.result;
  const counts = z
    ? {
        total: z.files.length,
        pass: z.files.filter((f) => f.status === 'PASS').length,
        warn: z.files.filter((f) => f.status === 'WARN').length,
        fail: z.files.filter((f) => f.status === 'FAIL').length,
      }
    : { total: 0, pass: 0, warn: 0, fail: 0 };

  const drift = z
    ? (() => {
        const pct = Math.round(z.score * 100);
        const failedFiles = z.files
          .filter((f) => f.status === 'FAIL' || (f.status === 'WARN' && f.blockers.length > 0))
          .map((f) => f.file)
          .slice(0, 8);
        const color =
          pct >= 80
            ? '#238636'
            : pct >= 50
              ? '#9e6a03'
              : '#da3633';
        return { pct, color, failedFiles };
      })()
    : null;

  const findingsPreview: FindingRow[] = z
    ? z.files.slice(0, 5).map((f) => ({
        file: f.file,
        status: f.status,
        mode: f.mode,
        score: f.score,
        blockers: f.blockers,
        errors: f.errors,
      }))
    : [];

  const pulls: PrRow[] = (github.pulls ?? []).map((p) => ({
    number: p.number,
    title: p.title,
    htmlUrl: p.htmlUrl,
  }));

  const runs: RunRow[] = (github.workflowRuns ?? []).map((r) => ({
    name: r.name,
    conclusion: r.conclusion,
    status: r.status,
    htmlUrl: r.htmlUrl,
  }));

  return {
    phase,
    verdict: z?.verdict ?? null,
    score: z ? Math.round(z.score * 100) : null,
    drift,
    counts,
    findingsPreview,
    firewall: {
      enabled: input.firewallEnabled !== false,
      status: firewall.status,
      violationCount: firewall.violationCount,
      lastFile: firewall.lastFile,
    },
    github: {
      connected: github.connected,
      owner: github.repo?.owner ?? null,
      repo: github.repo?.repo ?? null,
      prCount: pulls.length,
      pulls,
      runs,
    },
    workflows: workflows.map((w) => ({ name: w.name })),
    metadata: {
      timestamp: scan?.metadata?.timestamp ?? null,
      duration: z?.duration ?? null,
      workspaceRoot: scan?.metadata?.workspaceRoot ?? inputWorkspaceRoot,
    },
    islGeneratePath,
    intentBuilder: input.intentBuilder ?? {
      phase: 'idle',
      prompt: null,
      message: null,
      error: null,
      score: null,
      verdict: null,
      hasApiKey: false,
    },
  };
}

/**
 * Build normalized report state from scan result.
 */
export function buildReportState(
  scanResult: ScanResult | null,
  workspaceRoot: string,
  configPath: string | null
): ReportUiState {
  if (!scanResult) {
    return {
      verdict: null,
      score: null,
      coverage: { specced: 0, total: 0 },
      metadata: {
        timestamp: '',
        duration: 0,
        workspaceRoot,
        configPath,
      },
      counts: { total: 0, pass: 0, warn: 0, fail: 0 },
      findings: [],
      blockers: [],
      recommendations: [],
    };
  }

  const z = scanResult.result;

  return {
    verdict: z.verdict,
    score: Math.round(z.score * 100),
    coverage: z.coverage,
    metadata: {
      timestamp: scanResult.metadata.timestamp,
      duration: z.duration,
      workspaceRoot: scanResult.metadata.workspaceRoot,
      configPath,
    },
    counts: {
      total: z.files.length,
      pass: z.files.filter((f) => f.status === 'PASS').length,
      warn: z.files.filter((f) => f.status === 'WARN').length,
      fail: z.files.filter((f) => f.status === 'FAIL').length,
    },
    findings: z.files.map((f) => ({
      file: f.file,
      status: f.status,
      mode: f.mode,
      score: f.score,
      blockers: f.blockers,
      errors: f.errors,
    })),
    blockers: z.blockers,
    recommendations: z.recommendations,
  };
}
