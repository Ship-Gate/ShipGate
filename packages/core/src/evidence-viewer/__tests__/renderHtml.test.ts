/**
 * Tests for Evidence Viewer HTML Renderer
 */

import { describe, it, expect } from 'vitest';
import {
  renderHtml,
  renderSummaryCard,
  renderClausesOnly,
  renderTextSummary,
  groupClausesByState,
  calculateStats,
} from '../renderHtml.js';
import { escapeHtml, formatDate, formatDuration } from '../templates.js';
import type { EvidenceReport, EvidenceClauseResult } from '../viewerTypes.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const mockClauseResults: EvidenceClauseResult[] = [
  {
    clauseId: 'pre.1',
    state: 'PASS',
    message: 'Input validation passed',
    clauseType: 'precondition',
    evaluationTimeMs: 5,
  },
  {
    clauseId: 'pre.2',
    state: 'PASS',
    message: 'User exists',
    clauseType: 'precondition',
    evaluationTimeMs: 12,
  },
  {
    clauseId: 'post.1',
    state: 'PARTIAL',
    message: 'Timing constraint borderline',
    clauseType: 'postcondition',
    evaluationTimeMs: 150,
    expectedValue: '< 100ms',
    actualValue: '150ms',
  },
  {
    clauseId: 'inv.1',
    state: 'FAIL',
    message: 'Invariant violated',
    clauseType: 'invariant',
    evaluationTimeMs: 3,
    trace: 'user.balance < 0 after withdrawal',
  },
];

const mockReport: EvidenceReport = {
  version: '1.0',
  reportId: 'test-report-001',
  specFingerprint: 'abc123def456abc123def456abc123def456',
  specName: 'UserAuth',
  specPath: 'specs/user-auth.isl',
  clauseResults: mockClauseResults,
  scoreSummary: {
    overallScore: 75,
    passCount: 2,
    partialCount: 1,
    failCount: 1,
    totalClauses: 4,
    passRate: 50,
    confidence: 'medium',
    recommendation: 'review',
  },
  assumptions: [
    {
      id: 'asm.1',
      description: 'Database is available',
      category: 'dependency',
      impact: 'high',
      relatedClauses: ['pre.1'],
    },
    {
      id: 'asm.2',
      description: 'Network latency < 50ms',
      category: 'environment',
      impact: 'low',
    },
  ],
  openQuestions: [
    {
      id: 'q.1',
      question: 'Should negative balances be allowed temporarily?',
      priority: 'high',
      context: 'Current implementation fails on any negative balance',
      suggestedActions: ['Review business rules', 'Add grace period'],
      relatedClauses: ['inv.1'],
    },
  ],
  artifacts: [
    {
      id: 'art.1',
      type: 'test',
      name: 'UserAuth.test.ts',
      location: 'tests/UserAuth.test.ts',
      mimeType: 'application/typescript',
      size: 4096,
      createdAt: '2024-01-15T10:30:00Z',
    },
    {
      id: 'art.2',
      type: 'trace',
      name: 'execution-trace.json',
      location: 'traces/execution-trace.json',
      mimeType: 'application/json',
      size: 12288,
      createdAt: '2024-01-15T10:30:05Z',
    },
  ],
  metadata: {
    startedAt: '2024-01-15T10:30:00Z',
    completedAt: '2024-01-15T10:30:10Z',
    durationMs: 10000,
    agentVersion: '1.0.0',
    environment: 'test',
    mode: 'full',
  },
  notes: 'Manual review recommended for timing issues.',
};

// ============================================================================
// UTILITY TESTS
// ============================================================================

describe('Utility Functions', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('"test"')).toBe('&quot;test&quot;');
      expect(escapeHtml("it's")).toBe('it&#39;s');
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle strings without special characters', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('formatDate', () => {
    it('should format ISO date strings', () => {
      const result = formatDate('2024-01-15T10:30:00Z');
      expect(result).toContain('2024');
      expect(result).toContain('Jan');
    });

    it('should handle invalid dates gracefully', () => {
      const result = formatDate('invalid-date');
      // formatDate returns the original string for unparseable dates
      expect(result).toBe('invalid-date');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5.0s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
    });
  });
});

// ============================================================================
// GROUPING TESTS
// ============================================================================

describe('groupClausesByState', () => {
  it('should group clauses correctly', () => {
    const grouped = groupClausesByState(mockClauseResults);

    expect(grouped.pass).toHaveLength(2);
    expect(grouped.partial).toHaveLength(1);
    expect(grouped.fail).toHaveLength(1);
  });

  it('should handle empty array', () => {
    const grouped = groupClausesByState([]);

    expect(grouped.pass).toHaveLength(0);
    expect(grouped.partial).toHaveLength(0);
    expect(grouped.fail).toHaveLength(0);
  });

  it('should handle all same state', () => {
    const allPass: EvidenceClauseResult[] = [
      { clauseId: 'c1', state: 'PASS' },
      { clauseId: 'c2', state: 'PASS' },
    ];

    const grouped = groupClausesByState(allPass);

    expect(grouped.pass).toHaveLength(2);
    expect(grouped.partial).toHaveLength(0);
    expect(grouped.fail).toHaveLength(0);
  });
});

// ============================================================================
// STATS TESTS
// ============================================================================

describe('calculateStats', () => {
  it('should calculate correct statistics', () => {
    const stats = calculateStats(mockReport);

    expect(stats.totalClauses).toBe(4);
    expect(stats.passCount).toBe(2);
    expect(stats.partialCount).toBe(1);
    expect(stats.failCount).toBe(1);
    expect(stats.passRate).toBe(50);
    expect(stats.assumptionCount).toBe(2);
    expect(stats.questionCount).toBe(1);
    expect(stats.artifactCount).toBe(2);
    expect(stats.highPriorityQuestions).toBe(1);
    expect(stats.criticalAssumptions).toBe(0);
  });
});

// ============================================================================
// RENDER HTML TESTS
// ============================================================================

describe('renderHtml', () => {
  it('should render a complete HTML document', () => {
    const html = renderHtml(mockReport);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('should include the report title', () => {
    const html = renderHtml(mockReport);

    expect(html).toContain('UserAuth');
  });

  it('should include the score', () => {
    const html = renderHtml(mockReport);

    expect(html).toContain('75');
  });

  it('should include ship decision', () => {
    const html = renderHtml(mockReport);

    expect(html).toContain('REVIEW');
  });

  it('should include clause results', () => {
    const html = renderHtml(mockReport);

    expect(html).toContain('pre.1');
    expect(html).toContain('post.1');
    expect(html).toContain('inv.1');
  });

  it('should include assumptions', () => {
    const html = renderHtml(mockReport);

    expect(html).toContain('Database is available');
    expect(html).toContain('Network latency');
  });

  it('should include open questions', () => {
    const html = renderHtml(mockReport);

    expect(html).toContain('negative balances');
  });

  it('should include artifacts', () => {
    const html = renderHtml(mockReport);

    expect(html).toContain('UserAuth.test.ts');
    expect(html).toContain('execution-trace.json');
  });

  it('should respect custom title option', () => {
    const html = renderHtml(mockReport, { title: 'Custom Report Title' });

    expect(html).toContain('Custom Report Title');
  });

  it('should respect dark mode option', () => {
    const html = renderHtml(mockReport, { darkMode: true });

    expect(html).toContain('#1a1a2e'); // Dark theme background
  });

  it('should render without full document when specified', () => {
    const html = renderHtml(mockReport, { fullDocument: false });

    expect(html).not.toContain('<!DOCTYPE html>');
    expect(html).toContain('<style>');
  });

  it('should include styles by default', () => {
    const html = renderHtml(mockReport);

    expect(html).toContain('<style>');
    expect(html).toContain('.ev-report');
  });

  it('should exclude styles when specified', () => {
    const html = renderHtml(mockReport, { includeStyles: false, fullDocument: false });

    expect(html).not.toContain('<style>');
  });

  it('should include custom footer text', () => {
    const html = renderHtml(mockReport, { footerText: 'Custom Footer' });

    expect(html).toContain('Custom Footer');
  });

  it('should include notes when present', () => {
    const html = renderHtml(mockReport);

    expect(html).toContain('Manual review recommended');
  });

  it('should escape HTML in user content', () => {
    const reportWithXss: EvidenceReport = {
      ...mockReport,
      specName: '<script>alert("xss")</script>',
    };

    const html = renderHtml(reportWithXss);

    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});

// ============================================================================
// SUMMARY CARD TESTS
// ============================================================================

describe('renderSummaryCard', () => {
  it('should render score card HTML', () => {
    const html = renderSummaryCard(mockReport);

    expect(html).toContain('<style>');
    expect(html).toContain('75'); // Score
    expect(html).toContain('REVIEW');
  });

  it('should support dark mode', () => {
    const html = renderSummaryCard(mockReport, { darkMode: true });

    expect(html).toContain('#1a1a2e');
  });

  it('should use custom class prefix', () => {
    const html = renderSummaryCard(mockReport, { classPrefix: 'custom' });

    expect(html).toContain('custom-report');
    expect(html).toContain('custom-score-card');
  });
});

// ============================================================================
// CLAUSES ONLY TESTS
// ============================================================================

describe('renderClausesOnly', () => {
  it('should render clause lists', () => {
    const html = renderClausesOnly(mockClauseResults);

    expect(html).toContain('Failed Clauses');
    expect(html).toContain('Partial Clauses');
    expect(html).toContain('Passed Clauses');
  });

  it('should include clause IDs', () => {
    const html = renderClausesOnly(mockClauseResults);

    expect(html).toContain('pre.1');
    expect(html).toContain('post.1');
    expect(html).toContain('inv.1');
  });

  it('should handle empty clauses', () => {
    const html = renderClausesOnly([]);

    expect(html).toContain('No fail clauses');
    expect(html).toContain('No partial clauses');
    expect(html).toContain('No pass clauses');
  });
});

// ============================================================================
// TEXT SUMMARY TESTS
// ============================================================================

describe('renderTextSummary', () => {
  it('should render plain text summary', () => {
    const text = renderTextSummary(mockReport);

    expect(text).toContain('UserAuth');
    expect(text).toContain('SCORE: 75/100');
    expect(text).toContain('DECISION: REVIEW');
  });

  it('should include clause counts', () => {
    const text = renderTextSummary(mockReport);

    expect(text).toContain('PASS:   2');
    expect(text).toContain('PARTIAL:   1');
    expect(text).toContain('FAIL:   1');
  });

  it('should list failed clauses', () => {
    const text = renderTextSummary(mockReport);

    expect(text).toContain('FAILED CLAUSES (1)');
    expect(text).toContain('✗ inv.1');
  });

  it('should list partial clauses', () => {
    const text = renderTextSummary(mockReport);

    expect(text).toContain('PARTIAL CLAUSES (1)');
    expect(text).toContain('◐ post.1');
  });

  it('should list passed clauses', () => {
    const text = renderTextSummary(mockReport);

    expect(text).toContain('PASSED CLAUSES (2)');
    expect(text).toContain('✓ pre.1');
  });

  it('should include assumptions', () => {
    const text = renderTextSummary(mockReport);

    expect(text).toContain('ASSUMPTIONS (2)');
    expect(text).toContain('Database is available');
  });

  it('should include open questions', () => {
    const text = renderTextSummary(mockReport);

    expect(text).toContain('OPEN QUESTIONS (1)');
    expect(text).toContain('negative balances');
  });

  it('should include artifacts', () => {
    const text = renderTextSummary(mockReport);

    expect(text).toContain('ARTIFACTS (2)');
    expect(text).toContain('UserAuth.test.ts');
  });

  it('should include fingerprint', () => {
    const text = renderTextSummary(mockReport);

    expect(text).toContain('Fingerprint: abc123def456abc1...');
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle report with no assumptions', () => {
    const reportNoAssumptions: EvidenceReport = {
      ...mockReport,
      assumptions: [],
    };

    const html = renderHtml(reportNoAssumptions);
    expect(html).toContain('No assumptions recorded');
  });

  it('should handle report with no questions', () => {
    const reportNoQuestions: EvidenceReport = {
      ...mockReport,
      openQuestions: [],
    };

    const html = renderHtml(reportNoQuestions);
    expect(html).toContain('No open questions');
  });

  it('should handle report with no artifacts', () => {
    const reportNoArtifacts: EvidenceReport = {
      ...mockReport,
      artifacts: [],
    };

    const html = renderHtml(reportNoArtifacts);
    expect(html).toContain('No artifacts collected');
  });

  it('should handle report with no notes', () => {
    const reportNoNotes: EvidenceReport = {
      ...mockReport,
      notes: undefined,
    };

    const html = renderHtml(reportNoNotes);
    expect(html).not.toContain('Notes');
  });

  it('should handle report with all passing clauses', () => {
    const reportAllPass: EvidenceReport = {
      ...mockReport,
      clauseResults: [
        { clauseId: 'c1', state: 'PASS' },
        { clauseId: 'c2', state: 'PASS' },
      ],
      scoreSummary: {
        ...mockReport.scoreSummary,
        overallScore: 100,
        passCount: 2,
        partialCount: 0,
        failCount: 0,
        totalClauses: 2,
        passRate: 100,
        recommendation: 'ship',
      },
    };

    const html = renderHtml(reportAllPass);
    expect(html).toContain('SHIP');
    expect(html).toContain('No fail clauses');
    expect(html).toContain('No partial clauses');
  });

  it('should handle report with all failing clauses', () => {
    const reportAllFail: EvidenceReport = {
      ...mockReport,
      clauseResults: [
        { clauseId: 'c1', state: 'FAIL' },
        { clauseId: 'c2', state: 'FAIL' },
      ],
      scoreSummary: {
        ...mockReport.scoreSummary,
        overallScore: 0,
        passCount: 0,
        partialCount: 0,
        failCount: 2,
        totalClauses: 2,
        passRate: 0,
        recommendation: 'block',
      },
    };

    const html = renderHtml(reportAllFail);
    expect(html).toContain('BLOCK');
    expect(html).toContain('No pass clauses');
    expect(html).toContain('No partial clauses');
  });

  it('should handle empty spec name', () => {
    const reportNoName: EvidenceReport = {
      ...mockReport,
      specName: undefined,
    };

    const html = renderHtml(reportNoName);
    expect(html).toContain('Evidence Report');
  });

  it('should handle long clause messages', () => {
    const longMessage = 'A'.repeat(1000);
    const reportLongMessage: EvidenceReport = {
      ...mockReport,
      clauseResults: [
        { clauseId: 'long', state: 'FAIL', message: longMessage },
      ],
      scoreSummary: { ...mockReport.scoreSummary, totalClauses: 1, failCount: 1, passCount: 0, partialCount: 0 },
    };

    const html = renderHtml(reportLongMessage);
    expect(html).toContain(longMessage);
  });
});

// ============================================================================
// SHIP DECISION VARIATIONS
// ============================================================================

describe('Ship Decision Rendering', () => {
  it('should render SHIP decision with green styling', () => {
    const shipReport: EvidenceReport = {
      ...mockReport,
      scoreSummary: { ...mockReport.scoreSummary, recommendation: 'ship' },
    };

    const html = renderHtml(shipReport);
    expect(html).toContain('SHIP');
    expect(html).toContain('ev-badge-ship');
  });

  it('should render REVIEW decision with orange styling', () => {
    const reviewReport: EvidenceReport = {
      ...mockReport,
      scoreSummary: { ...mockReport.scoreSummary, recommendation: 'review' },
    };

    const html = renderHtml(reviewReport);
    expect(html).toContain('REVIEW');
    expect(html).toContain('ev-badge-review');
  });

  it('should render BLOCK decision with red styling', () => {
    const blockReport: EvidenceReport = {
      ...mockReport,
      scoreSummary: { ...mockReport.scoreSummary, recommendation: 'block' },
    };

    const html = renderHtml(blockReport);
    expect(html).toContain('BLOCK');
    expect(html).toContain('ev-badge-block');
  });
});
