/**
 * Trust Score Calculator
 *
 * Computes a trust score ∈ [0,1] based on verification evidence from
 * multiple signal sources. Ensures no single signal can dominate the
 * final score and penalizes unknowns appropriately.
 *
 * @module @isl-lang/trust-score
 */

import type {
  TrustValue,
  TrustScore,
  TrustEvidenceInput,
  TrustScoreConfig,
  SignalScore,
  SignalCategory,
  SignalVerdict,
  SignalWeights,
  TrustReducer,
  Recommendation,
  TrustSummary,
  ShipDecision,
  StaticCheckEvidence,
  EvaluatorEvidence,
  SMTProofEvidence,
  PBTEvidence,
  ChaosEvidence,
} from './types.js';

import {
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  DEFAULT_PENALTIES,
  MAX_SINGLE_SIGNAL_WEIGHT,
  ALGORITHM_VERSION,
} from './types.js';

// ============================================================================
// CALCULATOR CLASS
// ============================================================================

export class TrustScoreCalculator {
  private readonly weights: Required<SignalWeights>;
  private readonly thresholds: Required<typeof DEFAULT_THRESHOLDS>;
  private readonly penalties: Required<typeof DEFAULT_PENALTIES>;
  constructor(config: TrustScoreConfig = {}) {
    // Initialize weights, ensuring no signal dominates
    const rawWeights = { ...DEFAULT_WEIGHTS, ...config.weights };
    this.weights = this.normalizeWeights(rawWeights, config.maxSingleSignalWeight);
    
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
    this.penalties = { ...DEFAULT_PENALTIES, ...config.penalties };
  }

  /**
   * Normalize weights to sum to 1.0 and cap individual weights
   */
  private normalizeWeights(
    weights: SignalWeights,
    maxWeight: number = MAX_SINGLE_SIGNAL_WEIGHT
  ): Required<SignalWeights> {
    const entries = Object.entries(weights) as [keyof SignalWeights, number][];
    
    // Cap individual weights
    const capped = entries.map(([key, value]) => [key, Math.min(value ?? 0, maxWeight)] as const);
    
    // Normalize to sum to 1.0
    const total = capped.reduce((sum, [, v]) => sum + v, 0);
    const normalized: Required<SignalWeights> = {
      static_checks: 0,
      evaluator_verdicts: 0,
      smt_proofs: 0,
      pbt_results: 0,
      chaos_outcomes: 0,
    };
    
    for (const [key, value] of capped) {
      normalized[key] = total > 0 ? value / total : 0.2; // Equal weights if all zero
    }
    
    return normalized;
  }

  /**
   * Compute trust score from evidence
   */
  compute(evidence: TrustEvidenceInput): TrustScore {
    const signals: SignalScore[] = [];
    const trustReducers: TrustReducer[] = [];
    
    // Compute score for each signal category
    signals.push(this.computeStaticCheckScore(evidence.staticChecks, trustReducers));
    signals.push(this.computeEvaluatorScore(evidence.evaluatorVerdicts, trustReducers));
    signals.push(this.computeSMTScore(evidence.smtProofs, trustReducers));
    signals.push(this.computePBTScore(evidence.pbtResults, trustReducers));
    signals.push(this.computeChaosScore(evidence.chaosOutcomes, trustReducers));
    
    // Compute overall score
    const { score, confidence } = this.aggregateScores(signals, trustReducers);
    
    // Determine decision
    const decision = this.determineDecision(score, confidence, trustReducers);
    
    // Generate summary and recommendations
    const summary = this.generateSummary(score, confidence, signals, trustReducers);
    const recommendations = this.generateRecommendations(signals, trustReducers);
    
    return {
      score,
      confidence,
      decision,
      signals,
      summary,
      trustReducers,
      recommendations,
      computedAt: new Date().toISOString(),
      algorithmVersion: ALGORITHM_VERSION,
    };
  }

  // ============================================================================
  // SIGNAL SCORING
  // ============================================================================

  private computeStaticCheckScore(
    evidence: StaticCheckEvidence | undefined,
    reducers: TrustReducer[]
  ): SignalScore {
    const category: SignalCategory = 'static_checks';
    const weight = this.weights.static_checks;
    
    if (!evidence || evidence.checks.length === 0) {
      reducers.push({
        id: 'missing_static_checks',
        description: 'Static analysis was not performed',
        impact: this.penalties.missingSignalPenalty * weight,
        category,
        severity: 'minor',
      });
      
      return this.createEmptySignalScore(category, weight, 'No static check evidence available');
    }
    
    const counts = this.countVerdicts(evidence.checks.map(c => c.verdict));
    const rawScore = this.computeRawScore(counts, reducers, category);
    
    // Additional penalty for error-severity failures
    const criticalFailures = evidence.checks.filter(
      c => c.verdict === 'fail' && c.severity === 'error'
    ).length;
    
    if (criticalFailures > 0) {
      const penalty = criticalFailures * this.penalties.failurePenalty * this.penalties.criticalFailureMultiplier;
      reducers.push({
        id: 'critical_static_failures',
        description: `${criticalFailures} critical static analysis error(s)`,
        impact: Math.min(penalty, 0.3),
        category,
        severity: 'critical',
      });
    }
    
    return {
      category,
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      ...counts,
      available: true,
      explanation: this.explainScore(category, rawScore, counts),
    };
  }

  private computeEvaluatorScore(
    evidence: EvaluatorEvidence | undefined,
    reducers: TrustReducer[]
  ): SignalScore {
    const category: SignalCategory = 'evaluator_verdicts';
    const weight = this.weights.evaluator_verdicts;
    
    if (!evidence || evidence.clauses.length === 0) {
      reducers.push({
        id: 'missing_evaluator_verdicts',
        description: 'No postcondition/invariant evaluations performed',
        impact: this.penalties.missingSignalPenalty * weight,
        category,
        severity: 'major',
      });
      
      return this.createEmptySignalScore(category, weight, 'No evaluator verdict evidence available');
    }
    
    const counts = this.countVerdicts(evidence.clauses.map(c => c.verdict));
    const rawScore = this.computeRawScore(counts, reducers, category);
    
    // Extra penalty for violated postconditions (they're contractual)
    const violatedPostconditions = evidence.clauses.filter(
      c => c.type === 'postcondition' && c.verdict === 'fail'
    ).length;
    
    if (violatedPostconditions > 0) {
      reducers.push({
        id: 'violated_postconditions',
        description: `${violatedPostconditions} postcondition(s) violated`,
        impact: violatedPostconditions * this.penalties.failurePenalty * 1.5,
        category,
        severity: 'critical',
      });
    }
    
    return {
      category,
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      ...counts,
      available: true,
      explanation: this.explainScore(category, rawScore, counts),
    };
  }

  private computeSMTScore(
    evidence: SMTProofEvidence | undefined,
    reducers: TrustReducer[]
  ): SignalScore {
    const category: SignalCategory = 'smt_proofs';
    const weight = this.weights.smt_proofs;
    
    if (!evidence || evidence.proofs.length === 0) {
      reducers.push({
        id: 'missing_smt_proofs',
        description: 'SMT verification was not performed',
        impact: this.penalties.missingSignalPenalty * weight,
        category,
        severity: 'minor',
      });
      
      return this.createEmptySignalScore(category, weight, 'No SMT proof evidence available');
    }
    
    const counts = this.countVerdicts(evidence.proofs.map(p => p.verdict));
    const rawScore = this.computeRawScore(counts, reducers, category);
    
    // Check for counterexamples (disproved clauses)
    const disprovedWithCounterexample = evidence.proofs.filter(
      p => p.verdict === 'fail' && p.counterexample
    ).length;
    
    if (disprovedWithCounterexample > 0) {
      reducers.push({
        id: 'smt_counterexamples',
        description: `SMT found ${disprovedWithCounterexample} counterexample(s)`,
        impact: disprovedWithCounterexample * this.penalties.failurePenalty * this.penalties.criticalFailureMultiplier,
        category,
        severity: 'critical',
      });
    }
    
    // Timeouts reduce confidence but not as severely
    const timeouts = evidence.proofs.filter(p => p.solverStatus === 'timeout').length;
    if (timeouts > 0) {
      reducers.push({
        id: 'smt_timeouts',
        description: `${timeouts} SMT check(s) timed out`,
        impact: timeouts * this.penalties.unknownPenalty * 0.5,
        category,
        severity: 'minor',
      });
    }
    
    return {
      category,
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      ...counts,
      available: true,
      explanation: this.explainScore(category, rawScore, counts),
    };
  }

  private computePBTScore(
    evidence: PBTEvidence | undefined,
    reducers: TrustReducer[]
  ): SignalScore {
    const category: SignalCategory = 'pbt_results';
    const weight = this.weights.pbt_results;
    
    if (!evidence || evidence.behaviors.length === 0) {
      reducers.push({
        id: 'missing_pbt_results',
        description: 'Property-based testing was not performed',
        impact: this.penalties.missingSignalPenalty * weight,
        category,
        severity: 'minor',
      });
      
      return this.createEmptySignalScore(category, weight, 'No PBT evidence available');
    }
    
    const counts = this.countVerdicts(evidence.behaviors.map(b => b.verdict));
    const rawScore = this.computeRawScore(counts, reducers, category);
    
    // Compute coverage-based confidence boost
    const totalIterations = evidence.behaviors.reduce((sum, b) => sum + b.iterations, 0);
    const coverageBoost = Math.min(totalIterations / 1000, 0.1); // Max 10% boost for high iteration count
    
    // Property violations are serious
    const totalViolations = evidence.behaviors.reduce((sum, b) => sum + b.violations.length, 0);
    if (totalViolations > 0) {
      reducers.push({
        id: 'pbt_violations',
        description: `${totalViolations} property violation(s) found`,
        impact: totalViolations * this.penalties.failurePenalty,
        category,
        severity: 'major',
      });
    }
    
    return {
      category,
      rawScore: Math.min(rawScore + coverageBoost, 1.0),
      weight,
      weightedScore: Math.min(rawScore + coverageBoost, 1.0) * weight,
      ...counts,
      available: true,
      explanation: this.explainScore(category, rawScore, counts) + 
        (totalIterations > 100 ? ` (${totalIterations} iterations)` : ''),
    };
  }

  private computeChaosScore(
    evidence: ChaosEvidence | undefined,
    reducers: TrustReducer[]
  ): SignalScore {
    const category: SignalCategory = 'chaos_outcomes';
    const weight = this.weights.chaos_outcomes;
    
    if (!evidence || evidence.scenarios.length === 0) {
      reducers.push({
        id: 'missing_chaos_results',
        description: 'Chaos testing was not performed',
        impact: this.penalties.missingSignalPenalty * weight,
        category,
        severity: 'minor',
      });
      
      return this.createEmptySignalScore(category, weight, 'No chaos testing evidence available');
    }
    
    const counts = this.countVerdicts(evidence.scenarios.map(s => s.verdict));
    const rawScore = this.computeRawScore(counts, reducers, category);
    
    // Invariant violations during chaos are severe
    const invariantViolations = evidence.scenarios.filter(s => !s.invariantsMaintained).length;
    if (invariantViolations > 0) {
      reducers.push({
        id: 'chaos_invariant_violations',
        description: `${invariantViolations} scenario(s) violated invariants under chaos`,
        impact: invariantViolations * this.penalties.failurePenalty * this.penalties.criticalFailureMultiplier,
        category,
        severity: 'critical',
      });
    }
    
    // Non-recovery is concerning
    const nonRecoveries = evidence.scenarios.filter(s => s.verdict === 'pass' && !s.recovered).length;
    if (nonRecoveries > 0) {
      reducers.push({
        id: 'chaos_non_recovery',
        description: `${nonRecoveries} scenario(s) did not recover`,
        impact: nonRecoveries * this.penalties.failurePenalty * 0.5,
        category,
        severity: 'major',
      });
    }
    
    return {
      category,
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      ...counts,
      available: true,
      explanation: this.explainScore(category, rawScore, counts),
    };
  }

  // ============================================================================
  // AGGREGATION
  // ============================================================================

  private aggregateScores(
    signals: SignalScore[],
    reducers: TrustReducer[]
  ): { score: TrustValue; confidence: TrustValue } {
    const availableSignals = signals.filter(s => s.available);
    
    if (availableSignals.length === 0) {
      return { score: 0, confidence: 0 };
    }
    
    // Compute weighted sum
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const signal of availableSignals) {
      weightedSum += signal.weightedScore;
      totalWeight += signal.weight;
    }
    
    // Normalize by actual total weight
    const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    // Apply reducer penalties
    const totalPenalty = reducers.reduce((sum, r) => sum + r.impact, 0);
    const score = Math.max(0, Math.min(1, baseScore - totalPenalty));
    
    // Compute confidence based on signal coverage and unknown rate
    const totalUnknowns = signals.reduce((sum, s) => sum + s.unknown, 0);
    const totalItems = signals.reduce((sum, s) => sum + s.total, 0);
    const unknownRate = totalItems > 0 ? totalUnknowns / totalItems : 0;
    
    const signalCoverage = availableSignals.length / signals.length;
    const confidence = Math.max(0, Math.min(1, signalCoverage * (1 - unknownRate)));
    
    return { score, confidence };
  }

  // ============================================================================
  // DECISION LOGIC
  // ============================================================================

  private determineDecision(
    score: TrustValue,
    confidence: TrustValue,
    reducers: TrustReducer[]
  ): ShipDecision {
    // Critical failures always result in NO_SHIP
    const hasCritical = reducers.some(r => r.severity === 'critical');
    if (hasCritical) {
      return 'NO_SHIP';
    }
    
    // Low confidence requires review
    if (confidence < this.thresholds.minConfidence) {
      return 'REVIEW_REQUIRED';
    }
    
    // Score-based decision
    if (score >= this.thresholds.ship) {
      return 'SHIP';
    }
    
    if (score >= this.thresholds.review) {
      return 'REVIEW_REQUIRED';
    }
    
    return 'NO_SHIP';
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private countVerdicts(verdicts: SignalVerdict[]): {
    passed: number;
    failed: number;
    unknown: number;
    skipped: number;
    total: number;
  } {
    return {
      passed: verdicts.filter(v => v === 'pass').length,
      failed: verdicts.filter(v => v === 'fail').length,
      unknown: verdicts.filter(v => v === 'unknown').length,
      skipped: verdicts.filter(v => v === 'skipped').length,
      total: verdicts.length,
    };
  }

  private computeRawScore(
    counts: ReturnType<typeof this.countVerdicts>,
    reducers: TrustReducer[],
    category: SignalCategory
  ): TrustValue {
    if (counts.total === 0) return 0;
    
    // Base score from pass rate
    const evaluated = counts.total - counts.skipped;
    if (evaluated === 0) return 0.5; // All skipped = uncertain
    
    const passRate = counts.passed / evaluated;
    
    // Penalty for unknowns (they reduce trust)
    const unknownPenalty = (counts.unknown / evaluated) * this.penalties.unknownPenalty;
    
    // Penalty for failures
    const failurePenalty = (counts.failed / evaluated) * this.penalties.failurePenalty;
    
    // Apply penalties
    const rawScore = Math.max(0, passRate - unknownPenalty - failurePenalty);
    
    // Track unknown penalty if significant
    if (counts.unknown > 0) {
      reducers.push({
        id: `${category}_unknowns`,
        description: `${counts.unknown} unknown result(s) in ${category.replace('_', ' ')}`,
        impact: unknownPenalty * this.weights[category],
        category,
        severity: counts.unknown > counts.passed ? 'major' : 'minor',
      });
    }
    
    return rawScore;
  }

  private createEmptySignalScore(
    category: SignalCategory,
    weight: number,
    explanation: string
  ): SignalScore {
    return {
      category,
      rawScore: 0,
      weight,
      weightedScore: 0,
      passed: 0,
      failed: 0,
      unknown: 0,
      skipped: 0,
      total: 0,
      available: false,
      explanation,
    };
  }

  private explainScore(
    category: SignalCategory,
    score: TrustValue,
    counts: ReturnType<typeof this.countVerdicts>
  ): string {
    const categoryName = category.replace('_', ' ');
    const percentage = Math.round(score * 100);
    
    if (counts.total === 0) {
      return `No ${categoryName} evaluated`;
    }
    
    return `${categoryName}: ${counts.passed}/${counts.total - counts.skipped} passed (${percentage}% trust)` +
      (counts.unknown > 0 ? `, ${counts.unknown} unknown` : '') +
      (counts.failed > 0 ? `, ${counts.failed} failed` : '');
  }

  // ============================================================================
  // SUMMARY & RECOMMENDATIONS
  // ============================================================================

  private generateSummary(
    score: TrustValue,
    confidence: TrustValue,
    signals: SignalScore[],
    reducers: TrustReducer[]
  ): TrustSummary {
    const percentage = Math.round(score * 100);
    const confidencePercentage = Math.round(confidence * 100);
    
    // Generate headline
    let headline: string;
    if (score >= this.thresholds.ship && confidence >= this.thresholds.minConfidence) {
      headline = `Trust score ${percentage}% - Ready to ship`;
    } else if (score >= this.thresholds.review) {
      headline = `Trust score ${percentage}% - Review recommended`;
    } else {
      headline = `Trust score ${percentage}% - Not ready to ship`;
    }
    
    // Gather strengths
    const strengths: string[] = [];
    for (const signal of signals.filter(s => s.available && s.rawScore >= 0.9)) {
      strengths.push(`Strong ${signal.category.replace('_', ' ')} (${Math.round(signal.rawScore * 100)}%)`);
    }
    
    // Gather concerns
    const concerns: string[] = [];
    for (const reducer of reducers.filter(r => r.severity === 'critical' || r.severity === 'major')) {
      concerns.push(reducer.description);
    }
    
    const unavailableSignals = signals.filter(s => !s.available);
    if (unavailableSignals.length > 0) {
      concerns.push(`Missing evidence: ${unavailableSignals.map(s => s.category.replace('_', ' ')).join(', ')}`);
    }
    
    // Generate explanation
    const availableCount = signals.filter(s => s.available).length;
    const explanation = `Based on ${availableCount} of ${signals.length} verification signals. ` +
      `Confidence: ${confidencePercentage}%. ` +
      (reducers.length > 0 ? `${reducers.length} factor(s) reduced trust.` : 'No trust reducers.');
    
    return {
      headline,
      explanation,
      strengths,
      concerns,
    };
  }

  private generateRecommendations(
    signals: SignalScore[],
    reducers: TrustReducer[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Recommend missing signals
    for (const signal of signals.filter(s => !s.available)) {
      recommendations.push({
        id: `add_${signal.category}`,
        description: `Add ${signal.category.replace('_', ' ')} to verification pipeline`,
        expectedImpact: signal.weight * 0.5,
        priority: signal.weight > 0.2 ? 'high' : 'medium',
        category: signal.category,
      });
    }
    
    // Address critical reducers
    for (const reducer of reducers.filter(r => r.severity === 'critical')) {
      recommendations.push({
        id: `fix_${reducer.id}`,
        description: `Fix: ${reducer.description}`,
        expectedImpact: reducer.impact,
        priority: 'high',
        category: reducer.category,
      });
    }
    
    // Address high-unknown signals
    for (const signal of signals.filter(s => s.available && s.unknown > s.passed)) {
      recommendations.push({
        id: `reduce_unknowns_${signal.category}`,
        description: `Reduce unknowns in ${signal.category.replace('_', ' ')} (${signal.unknown} unknown vs ${signal.passed} passed)`,
        expectedImpact: (signal.unknown / signal.total) * signal.weight * 0.5,
        priority: 'medium',
        category: signal.category,
      });
    }
    
    // Sort by expected impact
    recommendations.sort((a, b) => b.expectedImpact - a.expectedImpact);
    
    return recommendations.slice(0, 5); // Top 5 recommendations
  }
}

// ============================================================================
// CONVENIENCE FUNCTION
// ============================================================================

/**
 * Compute trust score from evidence
 */
export function computeTrustScore(
  evidence: TrustEvidenceInput,
  config?: TrustScoreConfig
): TrustScore {
  const calculator = new TrustScoreCalculator(config);
  return calculator.compute(evidence);
}
