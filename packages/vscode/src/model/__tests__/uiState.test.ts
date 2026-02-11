/**
 * uiState — Unit tests for buildSidebarState and buildReportState
 */

import { describe, it, expect } from 'vitest';
import { buildSidebarState, buildReportState } from '../uiState';
import type { ScanResult } from '../types';

const mockScanResult: ScanResult = {
  result: {
    verdict: 'SHIP',
    score: 0.85,
    coverage: { specced: 8, total: 10 },
    mode: 'isl',
    files: [
      { file: 'src/a.ts', status: 'PASS', mode: 'isl', score: 1, blockers: [], errors: [], duration: 10 },
      { file: 'src/b.ts', status: 'WARN', mode: 'isl', score: 0.7, blockers: ['x'], errors: [], duration: 5 },
      { file: 'src/c.ts', status: 'FAIL', mode: 'specless', score: 0.3, blockers: ['y'], errors: ['z'], duration: 0 },
    ],
    blockers: ['y'],
    recommendations: ['Fix c.ts'],
    duration: 150,
    exitCode: 0,
  },
  metadata: {
    timestamp: '2025-01-15T12:00:00.000Z',
    workspaceRoot: '/workspace',
    executable: 'isl',
  },
};

describe('buildSidebarState', () => {
  it('normalizes scan result into SidebarUiState', () => {
    const state = buildSidebarState({
      scan: mockScanResult,
      github: { connected: false, repo: null, pulls: [], workflowRuns: [], error: null },
      workflows: [{ name: 'ci.yml', path: '/.github/workflows/ci.yml' }],
      islGeneratePath: 'src/foo.ts',
      firewall: { status: 'allowed', lastFile: 'src/a.ts', lastResult: null, violationCount: 0 },
    });

    expect(state.phase).toBe('complete');
    expect(state.verdict).toBe('SHIP');
    expect(state.score).toBe(85);
    expect(state.drift).toEqual({
      pct: 85,
      color: '#238636',
      failedFiles: expect.arrayContaining(['src/c.ts']),
    });
    expect(state.counts).toEqual({ total: 3, pass: 1, warn: 1, fail: 1 });
    expect(state.findingsPreview).toHaveLength(3);
    expect(state.findingsPreview[0].file).toBe('src/a.ts');
    expect(state.findingsPreview[0].status).toBe('PASS');
    expect(state.firewall.status).toBe('allowed');
    expect(state.firewall.violationCount).toBe(0);
    expect(state.workflows).toEqual([{ name: 'ci.yml' }]);
    expect(state.metadata.timestamp).toBe('2025-01-15T12:00:00.000Z');
    expect(state.metadata.duration).toBe(150);
    expect(state.islGeneratePath).toBe('src/foo.ts');
  });

  it('returns idle state when scan is null', () => {
    const state = buildSidebarState({
      scan: null,
      github: { connected: false, repo: null, pulls: [], workflowRuns: [], error: null },
      workflows: [],
      islGeneratePath: null,
      firewall: { status: 'idle', lastFile: null, lastResult: null, violationCount: 0 },
    });

    expect(state.phase).toBe('idle');
    expect(state.verdict).toBeNull();
    expect(state.score).toBeNull();
    expect(state.drift).toBeNull();
    expect(state.counts).toEqual({ total: 0, pass: 0, warn: 0, fail: 0 });
    expect(state.findingsPreview).toEqual([]);
  });
});

describe('buildReportState', () => {
  it('normalizes scan result into ReportUiState', () => {
    const state = buildReportState(mockScanResult, '/workspace', '.shipgate.yml');

    expect(state.verdict).toBe('SHIP');
    expect(state.score).toBe(85);
    expect(state.coverage).toEqual({ specced: 8, total: 10 });
    expect(state.metadata.timestamp).toBe('2025-01-15T12:00:00.000Z');
    expect(state.metadata.duration).toBe(150);
    expect(state.metadata.configPath).toBe('.shipgate.yml');
    expect(state.counts).toEqual({ total: 3, pass: 1, warn: 1, fail: 1 });
    expect(state.findings).toHaveLength(3);
    expect(state.findings[0].file).toBe('src/a.ts');
    expect(state.findings[1].blockers).toEqual(['x']);
    expect(state.blockers).toEqual(['y']);
    expect(state.recommendations).toEqual(['Fix c.ts']);
  });

  it('returns empty state when scan is null', () => {
    const state = buildReportState(null, '/workspace', null);

    expect(state.verdict).toBeNull();
    expect(state.score).toBeNull();
    expect(state.coverage).toEqual({ specced: 0, total: 0 });
    expect(state.metadata.timestamp).toBe('');
    expect(state.metadata.workspaceRoot).toBe('/workspace');
    expect(state.counts).toEqual({ total: 0, pass: 0, warn: 0, fail: 0 });
    expect(state.findings).toEqual([]);
    expect(state.blockers).toEqual([]);
    expect(state.recommendations).toEqual([]);
  });
});
