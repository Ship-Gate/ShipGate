/**
 * ISL Policy Engine - Explainer Tests
 *
 * Tests the output formatters for terminal, markdown, JSON, and CI.
 */

import { describe, it, expect } from 'vitest';
import {
  formatTerminal,
  formatMarkdown,
  formatJSON,
  formatCILine,
  explainDecision,
} from '../src/explainer.js';
import type { PolicyEngineResult, PolicyDecisionEntry } from '../src/types.js';

// ============================================================================
// Helpers
// ============================================================================

function makeDecision(overrides: Partial<PolicyDecisionEntry> = {}): PolicyDecisionEntry {
  return {
    policyId: 'test/block',
    policyName: 'Test Block',
    action: 'block',
    severity: 'error',
    tier: 'hard_block',
    explanation: 'blocked because test',
    evidenceRefs: [
      { type: 'metric', id: 'confidence', label: 'Confidence', detail: 'Confidence: 42%' },
    ],
    relatedClaims: ['claim-1'],
    timestamp: '2026-02-09T00:00:00.000Z',
    ...overrides,
  };
}

function makeResult(overrides: Partial<PolicyEngineResult> = {}): PolicyEngineResult {
  const blockers = overrides.blockers ?? [makeDecision()];
  const warnings = overrides.warnings ?? [];
  const decisions = overrides.decisions ?? [...blockers, ...warnings];
  return {
    allowed: blockers.length === 0,
    decisions,
    blockers,
    warnings,
    summary: blockers.length > 0
      ? `BLOCKED: ${blockers.length} policy violation(s)`
      : 'All policies passed',
    durationMs: 5,
    metadata: {
      policiesEvaluated: 3,
      policiesTriggered: decisions.length,
      blockerCount: blockers.length,
      warningCount: warnings.length,
      allowCount: 0,
      timestamp: '2026-02-09T00:00:00.000Z',
    },
    ...overrides,
  };
}

// ============================================================================
// formatTerminal
// ============================================================================

describe('formatTerminal', () => {
  it('shows BLOCKED banner when not allowed', () => {
    const output = formatTerminal(makeResult());
    expect(output).toContain('BLOCKED');
    expect(output).toContain('[BLOCK]');
    expect(output).toContain('Test Block');
    expect(output).toContain('blocked because test');
  });

  it('shows PASSED banner when allowed', () => {
    const output = formatTerminal(makeResult({ blockers: [], warnings: [], decisions: [] }));
    expect(output).toContain('PASSED');
    expect(output).not.toContain('[BLOCK]');
  });

  it('shows evidence references', () => {
    const output = formatTerminal(makeResult());
    expect(output).toContain('Confidence: 42%');
  });

  it('shows warnings section', () => {
    const warn = makeDecision({ action: 'warn', policyId: 'test/warn', policyName: 'Test Warn', explanation: 'low confidence' });
    const output = formatTerminal(makeResult({ blockers: [], warnings: [warn], decisions: [warn] }));
    expect(output).toContain('[WARN]');
    expect(output).toContain('Test Warn');
  });

  it('shows stats', () => {
    const output = formatTerminal(makeResult());
    expect(output).toContain('Policies evaluated: 3');
    expect(output).toContain('Duration:');
  });
});

// ============================================================================
// formatMarkdown
// ============================================================================

describe('formatMarkdown', () => {
  it('starts with heading', () => {
    const md = formatMarkdown(makeResult());
    expect(md).toMatch(/^# Policy Check: BLOCKED/);
  });

  it('lists blockers with details', () => {
    const md = formatMarkdown(makeResult());
    expect(md).toContain('## Blockers');
    expect(md).toContain('### Test Block');
    expect(md).toContain('`test/block`');
    expect(md).toContain('hard_block');
  });

  it('includes summary table', () => {
    const md = formatMarkdown(makeResult());
    expect(md).toContain('| Policies evaluated | 3 |');
  });

  it('shows PASSED heading when allowed', () => {
    const md = formatMarkdown(makeResult({ blockers: [], warnings: [], decisions: [] }));
    expect(md).toContain('# Policy Check: PASSED');
  });

  it('lists warnings when present', () => {
    const warn = makeDecision({ action: 'warn', policyId: 'test/warn', policyName: 'Warn Rule' });
    const md = formatMarkdown(makeResult({ blockers: [], warnings: [warn], decisions: [warn] }));
    expect(md).toContain('## Warnings');
    expect(md).toContain('Warn Rule');
  });
});

// ============================================================================
// formatJSON
// ============================================================================

describe('formatJSON', () => {
  it('returns valid JSON', () => {
    const json = formatJSON(makeResult());
    const parsed = JSON.parse(json);
    expect(parsed.allowed).toBe(false);
    expect(parsed.blockers).toHaveLength(1);
    expect(parsed.metadata.policiesEvaluated).toBe(3);
  });

  it('is pretty-printed', () => {
    const json = formatJSON(makeResult());
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });
});

// ============================================================================
// formatCILine
// ============================================================================

describe('formatCILine', () => {
  it('returns FAIL line with blocker IDs', () => {
    const line = formatCILine(makeResult());
    expect(line).toContain('FAIL');
    expect(line).toContain('test/block');
  });

  it('returns PASS line when allowed', () => {
    const line = formatCILine(makeResult({ blockers: [], warnings: [], decisions: [] }));
    expect(line).toContain('PASS');
  });

  it('includes policy count', () => {
    const line = formatCILine(makeResult());
    expect(line).toContain('1 blockers');
  });
});

// ============================================================================
// explainDecision
// ============================================================================

describe('explainDecision', () => {
  it('formats block decision', () => {
    const explanation = explainDecision(makeDecision());
    expect(explanation).toContain('blocked because');
    expect(explanation).toContain('test');
    expect(explanation).toContain('Confidence');
  });

  it('formats warn decision', () => {
    const explanation = explainDecision(makeDecision({ action: 'warn', explanation: 'low conf' }));
    expect(explanation).toContain('warning:');
    expect(explanation).toContain('low conf');
  });

  it('formats allow decision', () => {
    const explanation = explainDecision(makeDecision({ action: 'allow', explanation: 'explicitly allowed' }));
    expect(explanation).toContain('allowed by');
  });

  it('includes evidence labels', () => {
    const explanation = explainDecision(makeDecision({
      evidenceRefs: [
        { type: 'metric', id: 'trust', label: 'Trust Score', detail: '95%' },
        { type: 'file', id: 'f1', label: 'Files', detail: '3 files' },
      ],
    }));
    expect(explanation).toContain('Trust Score');
    expect(explanation).toContain('Files');
  });

  it('handles empty evidence', () => {
    const explanation = explainDecision(makeDecision({ evidenceRefs: [] }));
    expect(explanation).not.toContain('[evidence:');
  });
});
