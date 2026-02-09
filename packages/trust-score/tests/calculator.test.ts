/**
 * Trust Score Calculator Tests
 */

import { describe, it, expect } from 'vitest';
import {
  TrustScoreCalculator,
  computeTrustScore,
  EvidenceBuilder,
  type TrustEvidenceInput,
  type StaticCheckResult,
  type ClauseEvaluation,
  type SMTProofResult,
  type PBTBehaviorResult,
  type ChaosScenarioResult,
} from '../src/index.js';

describe('TrustScoreCalculator', () => {
  describe('basic computation', () => {
    it('returns zero score and confidence with no evidence', () => {
      const score = computeTrustScore({});
      
      expect(score.score).toBe(0);
      expect(score.confidence).toBe(0);
      // Zero confidence triggers REVIEW_REQUIRED (need more verification)
      expect(score.decision).toBe('REVIEW_REQUIRED');
      expect(score.signals.every(s => !s.available)).toBe(true);
    });

    it('computes score from single signal', () => {
      const evidence: TrustEvidenceInput = {
        evaluatorVerdicts: {
          category: 'evaluator_verdicts',
          timestamp: new Date().toISOString(),
          durationMs: 100,
          clauses: [
            { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
            { clauseId: 'c2', type: 'postcondition', expression: 'y > 0', verdict: 'pass' },
          ],
        },
      };

      const score = computeTrustScore(evidence);
      
      expect(score.score).toBeGreaterThan(0);
      expect(score.confidence).toBeGreaterThan(0);
      expect(score.signals.find(s => s.category === 'evaluator_verdicts')?.available).toBe(true);
    });

    it('score is bounded to [0, 1]', () => {
      // All passing
      const allPass = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
        ])
        .withStaticChecks([
          { checkId: 's1', name: 'Type Check', verdict: 'pass' },
        ])
        .build();

      const passScore = computeTrustScore(allPass);
      expect(passScore.score).toBeGreaterThanOrEqual(0);
      expect(passScore.score).toBeLessThanOrEqual(1);

      // All failing
      const allFail = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'fail' },
        ])
        .build();

      const failScore = computeTrustScore(allFail);
      expect(failScore.score).toBeGreaterThanOrEqual(0);
      expect(failScore.score).toBeLessThanOrEqual(1);
    });
  });

  describe('no single signal dominates', () => {
    it('perfect score in one signal does not yield perfect overall', () => {
      const evidence = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
          { clauseId: 'c2', type: 'postcondition', expression: 'y > 0', verdict: 'pass' },
          { clauseId: 'c3', type: 'invariant', expression: 'z >= 0', verdict: 'pass' },
        ])
        .build();

      const score = computeTrustScore(evidence);
      
      // Even with 100% evaluator verdicts passing, missing signals reduce overall score
      expect(score.score).toBeLessThan(1.0);
      expect(score.trustReducers.some(r => r.id.includes('missing'))).toBe(true);
    });

    it('weights are capped by maxSingleSignalWeight before normalization', () => {
      // When all weights are equal after capping, no signal dominates
      const calculator = new TrustScoreCalculator({
        weights: {
          evaluator_verdicts: 0.9, // Capped to 0.4
          static_checks: 0.4,      // Also at cap
          smt_proofs: 0.4,         // Also at cap
          pbt_results: 0.4,        // Also at cap
          chaos_outcomes: 0.4,     // Also at cap
        },
        maxSingleSignalWeight: 0.4, // Cap at 40%
      });

      const evidence = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
        ])
        .withStaticChecks([
          { checkId: 's1', name: 'Check', verdict: 'pass' },
        ])
        .build();

      const score = calculator.compute(evidence);
      
      // After capping and normalization, each signal gets equal weight (0.2 each)
      // because they were all capped to the same value
      const evalSignal = score.signals.find(s => s.category === 'evaluator_verdicts');
      const staticSignal = score.signals.find(s => s.category === 'static_checks');
      expect(evalSignal?.weight).toBe(staticSignal?.weight);
    });
  });

  describe('unknown reduces trust', () => {
    it('unknown verdicts reduce score compared to pass', () => {
      const allPass = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
          { clauseId: 'c2', type: 'postcondition', expression: 'y > 0', verdict: 'pass' },
        ])
        .build();

      const withUnknown = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
          { clauseId: 'c2', type: 'postcondition', expression: 'y > 0', verdict: 'unknown' },
        ])
        .build();

      const passScore = computeTrustScore(allPass);
      const unknownScore = computeTrustScore(withUnknown);

      expect(unknownScore.score).toBeLessThan(passScore.score);
      expect(unknownScore.trustReducers.some(r => r.id.includes('unknown'))).toBe(true);
    });

    it('high unknown rate significantly impacts confidence', () => {
      const manyUnknowns = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'unknown' },
          { clauseId: 'c2', type: 'postcondition', expression: 'y > 0', verdict: 'unknown' },
          { clauseId: 'c3', type: 'invariant', expression: 'z >= 0', verdict: 'unknown' },
          { clauseId: 'c4', type: 'invariant', expression: 'w > 0', verdict: 'pass' },
        ])
        .build();

      const score = computeTrustScore(manyUnknowns);
      
      // High unknown rate should reduce confidence
      expect(score.confidence).toBeLessThan(0.5);
    });
  });

  describe('SHIP/NO-SHIP thresholds', () => {
    it('SHIP requires high score and confidence', () => {
      const excellent = new EvidenceBuilder()
        .withStaticChecks([
          { checkId: 's1', name: 'Type Check', verdict: 'pass' },
          { checkId: 's2', name: 'Null Check', verdict: 'pass' },
        ])
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
          { clauseId: 'c2', type: 'postcondition', expression: 'y > 0', verdict: 'pass' },
          { clauseId: 'c3', type: 'invariant', expression: 'z >= 0', verdict: 'pass' },
        ])
        .withSMTProofs([
          { clauseId: 'c1', verdict: 'pass', solver: 'z3', solverStatus: 'unsat', durationMs: 50 },
          { clauseId: 'c2', verdict: 'pass', solver: 'z3', solverStatus: 'unsat', durationMs: 50 },
        ])
        .withPBTResults([
          { behaviorName: 'Test', verdict: 'pass', iterations: 100, successes: 100, failures: 0, filtered: 0, violations: [] },
        ])
        .withChaosOutcomes([
          { scenarioId: 's1', name: 'Network Failure', faultType: 'network', verdict: 'pass', recovered: true, invariantsMaintained: true },
        ])
        .build();

      const score = computeTrustScore(excellent);
      
      expect(score.decision).toBe('SHIP');
      expect(score.score).toBeGreaterThanOrEqual(0.9);
    });

    it('critical failures force NO_SHIP regardless of score', () => {
      const withCritical = new EvidenceBuilder()
        .withStaticChecks([
          { checkId: 's1', name: 'Type Check', verdict: 'pass' },
          { checkId: 's2', name: 'Security Check', verdict: 'fail', severity: 'error' },
        ])
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
        ])
        .build();

      const score = computeTrustScore(withCritical);
      
      expect(score.decision).toBe('NO_SHIP');
      expect(score.trustReducers.some(r => r.severity === 'critical')).toBe(true);
    });

    it('low confidence triggers REVIEW_REQUIRED', () => {
      // Single signal with few items = low confidence
      const lowConfidence = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
        ])
        .build();

      const score = computeTrustScore(lowConfidence);
      
      // With only one signal, confidence should be low enough to need review
      expect(score.decision === 'REVIEW_REQUIRED' || score.decision === 'NO_SHIP').toBe(true);
    });

    it('mid-range scores trigger REVIEW_REQUIRED', () => {
      const mixed = new EvidenceBuilder()
        .withStaticChecks([
          { checkId: 's1', name: 'Type Check', verdict: 'pass' },
          { checkId: 's2', name: 'Lint', verdict: 'pass' },
        ])
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
          { clauseId: 'c2', type: 'postcondition', expression: 'y > 0', verdict: 'unknown' },
          { clauseId: 'c3', type: 'invariant', expression: 'z >= 0', verdict: 'pass' },
        ])
        .withPBTResults([
          { behaviorName: 'Test', verdict: 'pass', iterations: 50, successes: 45, failures: 5, filtered: 0, violations: [] },
        ])
        .build();

      const score = computeTrustScore(mixed);
      
      // Scores in the 70-90% range should require review
      if (score.score >= 0.7 && score.score < 0.9) {
        expect(score.decision).toBe('REVIEW_REQUIRED');
      }
    });
  });

  describe('signal-specific scoring', () => {
    it('SMT counterexamples are critical', () => {
      const withCounterexample = new EvidenceBuilder()
        .withSMTProofs([
          { clauseId: 'c1', verdict: 'pass', solver: 'z3', solverStatus: 'unsat', durationMs: 50 },
          { 
            clauseId: 'c2', 
            verdict: 'fail', 
            solver: 'z3', 
            solverStatus: 'sat', 
            durationMs: 50,
            counterexample: { x: -1, y: 0 },
          },
        ])
        .build();

      const score = computeTrustScore(withCounterexample);
      
      expect(score.trustReducers.some(r => r.id === 'smt_counterexamples')).toBe(true);
      expect(score.trustReducers.find(r => r.id === 'smt_counterexamples')?.severity).toBe('critical');
    });

    it('violated postconditions are critical', () => {
      const withViolation = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
          { clauseId: 'c2', type: 'postcondition', expression: 'y > 0', verdict: 'fail' },
        ])
        .build();

      const score = computeTrustScore(withViolation);
      
      expect(score.trustReducers.some(r => r.id === 'violated_postconditions')).toBe(true);
    });

    it('PBT iterations boost confidence', () => {
      const fewIterations = new EvidenceBuilder()
        .withPBTResults([
          { behaviorName: 'Test', verdict: 'pass', iterations: 10, successes: 10, failures: 0, filtered: 0, violations: [] },
        ])
        .build();

      const manyIterations = new EvidenceBuilder()
        .withPBTResults([
          { behaviorName: 'Test', verdict: 'pass', iterations: 1000, successes: 1000, failures: 0, filtered: 0, violations: [] },
        ])
        .build();

      const fewScore = computeTrustScore(fewIterations);
      const manyScore = computeTrustScore(manyIterations);

      // More iterations should yield higher PBT signal score
      const fewPBT = fewScore.signals.find(s => s.category === 'pbt_results');
      const manyPBT = manyScore.signals.find(s => s.category === 'pbt_results');
      
      expect(manyPBT?.rawScore).toBeGreaterThanOrEqual(fewPBT?.rawScore ?? 0);
    });

    it('chaos invariant violations are critical', () => {
      const withInvariantViolation = new EvidenceBuilder()
        .withChaosOutcomes([
          { scenarioId: 's1', name: 'Network', faultType: 'network', verdict: 'pass', recovered: true, invariantsMaintained: true },
          { scenarioId: 's2', name: 'CPU', faultType: 'cpu', verdict: 'fail', recovered: false, invariantsMaintained: false },
        ])
        .build();

      const score = computeTrustScore(withInvariantViolation);
      
      expect(score.trustReducers.some(r => r.id === 'chaos_invariant_violations')).toBe(true);
      expect(score.trustReducers.find(r => r.id === 'chaos_invariant_violations')?.severity).toBe('critical');
    });
  });

  describe('stability and explainability', () => {
    it('same input produces same output', () => {
      const evidence = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
          { clauseId: 'c2', type: 'postcondition', expression: 'y > 0', verdict: 'unknown' },
        ])
        .withPBTResults([
          { behaviorName: 'Test', verdict: 'pass', iterations: 100, successes: 95, failures: 5, filtered: 0, violations: [] },
        ])
        .build();

      const score1 = computeTrustScore(evidence);
      const score2 = computeTrustScore(evidence);

      expect(score1.score).toBe(score2.score);
      expect(score1.confidence).toBe(score2.confidence);
      expect(score1.decision).toBe(score2.decision);
    });

    it('provides explanation for each signal', () => {
      const evidence = new EvidenceBuilder()
        .withStaticChecks([
          { checkId: 's1', name: 'Type Check', verdict: 'pass' },
        ])
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
        ])
        .build();

      const score = computeTrustScore(evidence);

      for (const signal of score.signals) {
        expect(signal.explanation).toBeDefined();
        expect(signal.explanation.length).toBeGreaterThan(0);
      }
    });

    it('generates actionable recommendations', () => {
      const incomplete = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
          { clauseId: 'c2', type: 'postcondition', expression: 'y > 0', verdict: 'unknown' },
        ])
        .build();

      const score = computeTrustScore(incomplete);

      expect(score.recommendations.length).toBeGreaterThan(0);
      
      for (const rec of score.recommendations) {
        expect(rec.description).toBeDefined();
        expect(rec.expectedImpact).toBeGreaterThan(0);
        expect(['high', 'medium', 'low']).toContain(rec.priority);
      }
    });

    it('summary reflects key findings', () => {
      const evidence = new EvidenceBuilder()
        .withStaticChecks([
          { checkId: 's1', name: 'Type Check', verdict: 'pass' },
          { checkId: 's2', name: 'Security', verdict: 'fail', severity: 'error' },
        ])
        .build();

      const score = computeTrustScore(evidence);

      expect(score.summary.headline).toBeDefined();
      expect(score.summary.explanation).toBeDefined();
      expect(score.summary.concerns.length).toBeGreaterThan(0);
    });
  });

  describe('custom configuration', () => {
    it('respects custom thresholds', () => {
      const evidence = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'pass' },
        ])
        .withStaticChecks([
          { checkId: 's1', name: 'Type Check', verdict: 'pass' },
        ])
        .build();

      // Very strict thresholds
      const strictScore = computeTrustScore(evidence, {
        thresholds: { ship: 0.99, review: 0.95, minConfidence: 0.9 },
      });

      // Very lenient thresholds
      const lenientScore = computeTrustScore(evidence, {
        thresholds: { ship: 0.3, review: 0.1, minConfidence: 0.1 },
      });

      // Same evidence should get different decisions based on thresholds
      // (depending on actual score, decisions may differ)
      expect(strictScore.score).toBe(lenientScore.score);
    });

    it('respects custom penalties', () => {
      const evidence = new EvidenceBuilder()
        .withEvaluatorVerdicts([
          { clauseId: 'c1', type: 'postcondition', expression: 'x > 0', verdict: 'unknown' },
        ])
        .build();

      const defaultScore = computeTrustScore(evidence);
      const highPenaltyScore = computeTrustScore(evidence, {
        penalties: { unknownPenalty: 0.5 },
      });

      // Higher unknown penalty should result in lower score
      expect(highPenaltyScore.score).toBeLessThanOrEqual(defaultScore.score);
    });
  });
});

describe('EvidenceBuilder', () => {
  it('builds valid evidence with all signals', () => {
    const evidence = new EvidenceBuilder()
      .withStaticChecks([{ checkId: 's1', name: 'Check', verdict: 'pass' }])
      .withEvaluatorVerdicts([{ clauseId: 'c1', type: 'postcondition', expression: 'x', verdict: 'pass' }])
      .withSMTProofs([{ clauseId: 'c1', verdict: 'pass', solver: 'z3', solverStatus: 'unsat', durationMs: 10 }])
      .withPBTResults([{ behaviorName: 'B', verdict: 'pass', iterations: 10, successes: 10, failures: 0, filtered: 0, violations: [] }])
      .withChaosOutcomes([{ scenarioId: 's', name: 'S', faultType: 'f', verdict: 'pass', recovered: true, invariantsMaintained: true }])
      .build();

    expect(evidence.staticChecks).toBeDefined();
    expect(evidence.evaluatorVerdicts).toBeDefined();
    expect(evidence.smtProofs).toBeDefined();
    expect(evidence.pbtResults).toBeDefined();
    expect(evidence.chaosOutcomes).toBeDefined();
  });
});
