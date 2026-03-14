import { describe, it, expect } from 'vitest';
import {
  formatSummaryReport,
  formatFileBlameReport,
  toCSV,
  fileToCSV,
  generateDashboardSummary,
} from './reporter.js';
import type { ProjectAttribution, FileAttribution } from './types.js';

function makeFileAttr(overrides: Partial<FileAttribution> = {}): FileAttribution {
  return {
    path: 'src/index.ts',
    totalLines: 3,
    humanLines: 1,
    aiLines: 2,
    unknownLines: 0,
    byAgent: { cursor: 2 },
    byAuthor: { 'john@test.com': 3 },
    lines: [
      { line: 1, content: 'import x;', author: { name: 'John', email: 'john@test.com' }, agent: { tool: 'cursor', model: 'claude-sonnet-4', detectionMethod: 'commit-trailer' }, commit: { hash: 'abc123', message: 'init', timestamp: '2026-03-01T10:00:00Z' }, confidence: 'high' },
      { line: 2, content: 'const y = 1;', author: { name: 'John', email: 'john@test.com' }, agent: { tool: 'cursor', model: 'claude-sonnet-4', detectionMethod: 'commit-trailer' }, commit: { hash: 'abc123', message: 'init', timestamp: '2026-03-01T10:00:00Z' }, confidence: 'high' },
      { line: 3, content: 'export { y };', author: { name: 'John', email: 'john@test.com' }, agent: null, commit: { hash: 'def456', message: 'export', timestamp: '2026-03-02T10:00:00Z' }, confidence: 'high' },
    ],
    ...overrides,
  };
}

function makeProjectAttr(): ProjectAttribution {
  return {
    repository: 'https://github.com/test/repo.git',
    branch: 'main',
    commit: 'abc1234',
    generatedAt: '2026-03-02T12:00:00Z',
    files: [makeFileAttr()],
    summary: {
      totalLines: 3,
      humanAuthored: 1,
      aiAuthored: 2,
      unknown: 0,
      byAgent: { cursor: 2 },
      byAuthor: { 'john@test.com': { total: 3, withAi: 2 } },
      topContributors: [{ name: 'John', email: 'john@test.com', lines: 3, aiPercentage: 67 }],
    },
  };
}

describe('formatSummaryReport', () => {
  it('produces a report with key sections', () => {
    const report = formatSummaryReport(makeProjectAttr());
    expect(report).toContain('Code Provenance Report');
    expect(report).toContain('main');
    expect(report).toContain('Attribution Summary');
    expect(report).toContain('Total lines:');
    expect(report).toContain('Human-authored:');
    expect(report).toContain('AI-assisted:');
    expect(report).toContain('By AI Agent');
    expect(report).toContain('By Operator');
  });

  it('shows repository and branch', () => {
    const report = formatSummaryReport(makeProjectAttr());
    expect(report).toContain('https://github.com/test/repo.git');
    expect(report).toContain('abc1234');
  });
});

describe('formatFileBlameReport', () => {
  it('shows line numbers and content', () => {
    const report = formatFileBlameReport(makeFileAttr());
    expect(report).toContain('src/index.ts');
    expect(report).toContain('import x;');
    expect(report).toContain('const y = 1;');
    expect(report).toContain('export { y };');
  });

  it('shows agent info for AI lines', () => {
    const report = formatFileBlameReport(makeFileAttr());
    expect(report).toContain('Cursor');
  });

  it('shows Human for non-AI lines', () => {
    const report = formatFileBlameReport(makeFileAttr());
    expect(report).toContain('Human');
  });
});

describe('toCSV', () => {
  it('produces valid CSV with header', () => {
    const csv = toCSV(makeProjectAttr());
    const lines = csv.split('\n');
    expect(lines[0]).toBe('file,line,content,author_name,author_email,commit_hash,commit_date,agent,model,confidence,detection_method');
    expect(lines.length).toBe(4); // header + 3 lines
  });

  it('escapes commas in content', () => {
    const file = makeFileAttr({
      lines: [
        { line: 1, content: 'const a = [1, 2, 3];', author: { name: 'A', email: 'a@test.com' }, agent: null, commit: { hash: 'x', message: 'm', timestamp: '2026-01-01' }, confidence: 'high' },
      ],
    });
    const csv = fileToCSV(file);
    expect(csv).toContain('"const a = [1, 2, 3];"');
  });
});

describe('generateDashboardSummary', () => {
  it('returns structured summary for dashboard', () => {
    const summary = generateDashboardSummary(makeProjectAttr());
    expect(summary.totalLines).toBe(3);
    expect(summary.aiAuthored).toBe(2);
    expect(summary.humanAuthored).toBe(1);
    expect(summary.aiPercentage).toBe(67);
    expect(summary.byAgent).toHaveLength(1);
    expect(summary.byAgent[0]!.tool).toBe('cursor');
    expect(summary.topContributors).toHaveLength(1);
    expect(summary.fileCount).toBe(1);
    expect(summary.topAiFiles).toHaveLength(1);
  });
});
