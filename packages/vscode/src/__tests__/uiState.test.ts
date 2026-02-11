/**
 * Unit tests for normalized UI state builders.
 */

import { describe, it, expect } from 'vitest';
import { buildSidebarState, buildReportState } from '../model/uiState';
import type { ScanResult } from '../model/types';
import type { FirewallState } from '../services/firewallService';
import type { GitHubConnectionState } from '../services/githubService';

// ── Fixtures ──────────────────────────────────────────────────

const mockScan: ScanResult = {
  result: {
    verdict: 'WARN',
    score: 0.72,
    coverage: { specced: 8, total: 12 },
    mode: 'mixed',
    files: [
      { file: 'src/auth.ts', status: 'PASS', mode: 'isl', score: 1, blockers: [], errors: [], duration: 10 },
      { file: 'src/pay.ts', status: 'FAIL', mode: 'isl', score: 0.3, blockers: ['Missing auth'], errors: ['Type mismatch'], duration: 15 },
      { file: 'src/api.ts', status: 'WARN', mode: 'specless', score: 0.6, blockers: [], errors: ['No spec'], duration: 8 },
    ],
    blockers: ['Missing auth on pay.ts'],
    recommendations: ['Add ISL spec for api.ts'],
    duration: 120,
    exitCode: 1,
  },
  metadata: {
    timestamp: '2026-02-10T22:00:00.000Z',
    workspaceRoot: '/test/workspace',
    executable: 'isl',
  },
};

const mockFirewall: FirewallState = {
  status: 'allowed',
  lastFile: '/test/workspace/src/index.ts',
  lastResult: null,
  violationCount: 0,
};

const mockGitHub: GitHubConnectionState = {
  connected: true,
  repo: { owner: 'shipgate', repo: 'shipgate', defaultBranch: 'main', url: 'https://github.com/shipgate/shipgate' },
  pulls: [
    { number: 42, title: 'Fix auth', state: 'open', htmlUrl: 'https://github.com/shipgate/shipgate/pull/42', headRef: 'fix-auth' },
  ],
  workflowRuns: [
    { id: 1, name: 'CI', status: 'completed', conclusion: 'success', htmlUrl: 'https://github.com/runs/1', createdAt: '2026-02-10T21:00:00Z' },
  ],
  error: null,
};

// ── Tests ─────────────────────────────────────────────────────

describe('buildSidebarState', () => {
  it('returns idle state when scan is null', () => {
    const state = buildSidebarState({
      scan: null,
      firewall: { status: 'idle', lastFile: null, lastResult: null, violationCount: 0 },
      github: { connected: false, repo: null, pulls: [], workflowRuns: [], error: null },
      workflows: [],
      islGeneratePath: null,
      workspaceRoot: '/test',
    });

    expect(state.phase).toBe('idle');
    expect(state.verdict).toBeNull();
    expect(state.score).toBeNull();
    expect(state.drift).toBeNull();
    expect(state.counts).toEqual({ total: 0, pass: 0, warn: 0, fail: 0 });
    expect(state.findingsPreview).toEqual([]);
  });

  it('builds complete state from scan result', () => {
    const state = buildSidebarState({
      scan: mockScan,
      firewall: mockFirewall,
      github: mockGitHub,
      workflows: [{ name: 'ci' }],
      islGeneratePath: 'src/index.ts',
      workspaceRoot: '/test/workspace',
    });

    expect(state.phase).toBe('complete');
    expect(state.verdict).toBe('WARN');
    expect(state.score).toBe(72);
    expect(state.counts).toEqual({ total: 3, pass: 1, warn: 1, fail: 1 });
    expect(state.drift).toBeDefined();
    expect(state.drift?.pct).toBe(72);
    expect(state.drift?.failedFiles).toContain('src/pay.ts');

    // Findings preview: only non-PASS, sorted by score asc, max 5
    expect(state.findingsPreview.length).toBe(2);
    expect(state.findingsPreview[0].file).toBe('src/pay.ts'); // lowest score first

    // GitHub
    expect(state.github.connected).toBe(true);
    expect(state.github.prCount).toBe(1);
    expect(state.github.pulls[0].number).toBe(42);
    expect(state.github.runs[0].name).toBe('CI');

    // Firewall
    expect(state.firewall.status).toBe('allowed');

    // Metadata
    expect(state.metadata.workspaceRoot).toBe('/test/workspace');
  });
});

describe('buildReportState', () => {
  it('returns empty state when scan is null', () => {
    const state = buildReportState(null, '/test', null);
    expect(state.verdict).toBeNull();
    expect(state.findings).toEqual([]);
    expect(state.counts).toEqual({ total: 0, pass: 0, warn: 0, fail: 0 });
  });

  it('builds full report from scan result', () => {
    const state = buildReportState(mockScan, '/test/workspace', '.shipgate.yml');

    expect(state.verdict).toBe('WARN');
    expect(state.score).toBe(72);
    expect(state.coverage).toEqual({ specced: 8, total: 12 });
    expect(state.counts).toEqual({ total: 3, pass: 1, warn: 1, fail: 1 });
    expect(state.findings.length).toBe(3);
    expect(state.blockers).toContain('Missing auth on pay.ts');
    expect(state.recommendations).toContain('Add ISL spec for api.ts');
    expect(state.metadata.configPath).toBe('.shipgate.yml');
    expect(state.metadata.duration).toBe(120);
  });
});
