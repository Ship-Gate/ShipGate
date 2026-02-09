/**
 * Trust Score Formatter Tests
 */

import { describe, it, expect } from 'vitest';
import {
  computeTrustScore,
  EvidenceBuilder,
  formatAsJSON,
  formatForTerminal,
  formatAsMarkdown,
} from '../src/index.js';

describe('Formatters', () => {
  const sampleEvidence = new EvidenceBuilder()
    .withStaticChecks([
      { checkId: 's1', name: 'Type Check', verdict: 'pass' },
      { checkId: 's2', name: 'Lint Check', verdict: 'pass' },
    ])
    .withEvaluatorVerdicts([
      { clauseId: 'c1', type: 'postcondition', expression: 'result > 0', verdict: 'pass' },
      { clauseId: 'c2', type: 'invariant', expression: 'balance >= 0', verdict: 'pass' },
      { clauseId: 'c3', type: 'postcondition', expression: 'user != null', verdict: 'unknown' },
    ])
    .withPBTResults([
      { behaviorName: 'CreateUser', verdict: 'pass', iterations: 100, successes: 98, failures: 2, filtered: 0, violations: [] },
    ])
    .build();

  const score = computeTrustScore(sampleEvidence);

  describe('formatAsJSON', () => {
    it('produces valid JSON', () => {
      const json = formatAsJSON(score);
      const parsed = JSON.parse(json);

      expect(parsed).toBeDefined();
      expect(typeof parsed.trust_score).toBe('number');
      expect(typeof parsed.confidence).toBe('number');
      expect(typeof parsed.decision).toBe('string');
    });

    it('includes all required fields', () => {
      const json = formatAsJSON(score);
      const parsed = JSON.parse(json);

      expect(parsed.trust_score).toBeDefined();
      expect(parsed.confidence).toBeDefined();
      expect(parsed.decision).toBeDefined();
      expect(parsed.algorithm_version).toBeDefined();
      expect(parsed.computed_at).toBeDefined();
      expect(parsed.signals).toBeDefined();
      expect(Array.isArray(parsed.signals)).toBe(true);
      expect(parsed.reducers).toBeDefined();
      expect(parsed.recommendations).toBeDefined();
      expect(parsed.summary).toBeDefined();
    });

    it('scores are bounded correctly', () => {
      const json = formatAsJSON(score);
      const parsed = JSON.parse(json);

      expect(parsed.trust_score).toBeGreaterThanOrEqual(0);
      expect(parsed.trust_score).toBeLessThanOrEqual(1);
      expect(parsed.confidence).toBeGreaterThanOrEqual(0);
      expect(parsed.confidence).toBeLessThanOrEqual(1);
    });

    it('compact mode removes whitespace', () => {
      const pretty = formatAsJSON(score, true);
      const compact = formatAsJSON(score, false);

      expect(compact.length).toBeLessThan(pretty.length);
      expect(compact).not.toContain('\n');
    });
  });

  describe('formatForTerminal', () => {
    it('includes score and decision', () => {
      const output = formatForTerminal(score);

      expect(output).toContain('Trust Score');
      expect(output).toMatch(/\d+%/); // Contains percentage
      expect(output).toMatch(/SHIP|NO_SHIP|REVIEW/);
    });

    it('includes signal breakdown', () => {
      const output = formatForTerminal(score);

      expect(output).toContain('Signal Breakdown');
      expect(output).toContain('Static Checks');
      expect(output).toContain('Evaluator Verdicts');
    });

    it('works without colors', () => {
      const withColors = formatForTerminal(score, true);
      const noColors = formatForTerminal(score, false);

      // Without colors should not have ANSI escape codes
      expect(noColors).not.toMatch(/\x1b\[/);
      // With colors should have ANSI escape codes
      expect(withColors).toMatch(/\x1b\[/);
    });

    it('shows trust reducers when present', () => {
      const output = formatForTerminal(score);

      if (score.trustReducers.length > 0) {
        expect(output).toContain('Trust Reducers');
      }
    });

    it('shows recommendations when present', () => {
      const output = formatForTerminal(score);

      if (score.recommendations.length > 0) {
        expect(output).toContain('Recommendations');
      }
    });
  });

  describe('formatAsMarkdown', () => {
    it('produces valid markdown structure', () => {
      const md = formatAsMarkdown(score);

      expect(md).toContain('# Trust Score Report');
      expect(md).toContain('## Summary');
      expect(md).toContain('## Signal Breakdown');
    });

    it('includes decision badge', () => {
      const md = formatAsMarkdown(score);

      expect(md).toMatch(/🟢|🟡|🔴/); // Contains one of the badge emojis
      expect(md).toMatch(/\*\*SHIP\*\*|\*\*NO_SHIP\*\*|\*\*REVIEW_REQUIRED\*\*/);
    });

    it('includes signal breakdown table', () => {
      const md = formatAsMarkdown(score);

      expect(md).toContain('| Signal |');
      expect(md).toContain('| Score |');
      expect(md).toContain('|--------|');
    });

    it('includes metadata footer', () => {
      const md = formatAsMarkdown(score);

      expect(md).toContain('Computed at');
      expect(md).toContain('algorithm');
    });
  });
});

describe('Formatter consistency', () => {
  it('all formats show same decision', () => {
    const evidence = new EvidenceBuilder()
      .withEvaluatorVerdicts([
        { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
      ])
      .build();

    const score = computeTrustScore(evidence);
    
    const json = JSON.parse(formatAsJSON(score));
    const terminal = formatForTerminal(score, false);
    const markdown = formatAsMarkdown(score);

    expect(json.decision).toBe(score.decision);
    expect(terminal).toContain(score.decision);
    expect(markdown).toContain(score.decision);
  });
});
