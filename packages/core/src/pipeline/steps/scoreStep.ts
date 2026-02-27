/**
 * Scoring Step
 *
 * Computes the final score from verification results and generates a score summary.
 */

import type { ScoreStepResult, PipelineState } from '../pipelineTypes.js';
import type { ScoreSummary, EvidenceClauseResult } from '../../evidence/evidenceTypes.js';
import type { ScoringResult, ClauseResult } from '../../isl-agent/scoring/scoringTypes.js';
import { computeScore } from '../../isl-agent/scoring/scoring.js';

/**
 * Convert EvidenceClauseResult to ClauseResult for scoring
 *
 * @param results - Evidence clause results
 * @returns Clause results compatible with scoring module
 */
function toClauseResults(results: EvidenceClauseResult[]): ClauseResult[] {
  return results.map((r) => ({
    clauseId: r.clauseId,
    state: r.state,
    message: r.message,
  }));
}

/**
 * Determine confidence level based on verification coverage
 *
 * @param results - Clause results
 * @returns Confidence level
 */
function determineConfidence(
  results: EvidenceClauseResult[]
): 'low' | 'medium' | 'high' {
  if (results.length === 0) return 'low';

  // Check how many have explicit verification (not just stub)
  const passRate =
    results.filter((r) => r.state === 'PASS').length / results.length;

  if (passRate >= 0.9) return 'high';
  if (passRate >= 0.7) return 'medium';
  return 'low';
}

/**
 * Determine recommendation based on scoring result
 *
 * @param scoringResult - The scoring result
 * @param confidence - Confidence level
 * @returns Recommendation
 */
function determineRecommendation(
  scoringResult: ScoringResult,
  confidence: 'low' | 'medium' | 'high'
): 'ship' | 'review' | 'block' {
  // If score allows shipping and confidence is not low
  if (scoringResult.shipDecision === 'SHIP' && confidence !== 'low') {
    return 'ship';
  }

  // If there are failures, block
  if (scoringResult.breakdown.failCount > 0) {
    return 'block';
  }

  // Otherwise review
  return 'review';
}

/**
 * Create a score summary from scoring result
 *
 * @param scoringResult - The raw scoring result
 * @param clauseResults - The clause results
 * @returns Score summary for evidence report
 */
function createScoreSummary(
  scoringResult: ScoringResult,
  clauseResults: EvidenceClauseResult[]
): ScoreSummary {
  const { breakdown, score } = scoringResult;
  const confidence = determineConfidence(clauseResults);
  const recommendation = determineRecommendation(scoringResult, confidence);

  const passRate =
    breakdown.totalCount > 0
      ? Math.round((breakdown.passCount / breakdown.totalCount) * 100)
      : 100;

  return {
    overallScore: score,
    passCount: breakdown.passCount,
    partialCount: breakdown.partialCount,
    failCount: breakdown.failCount,
    totalClauses: breakdown.totalCount,
    passRate,
    confidence,
    recommendation,
  };
}

/**
 * Run the scoring step
 *
 * @param state - Current pipeline state
 * @returns Scoring step result
 */
export async function runScoreStep(state: PipelineState): Promise<ScoreStepResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  try {
    if (!state.clauseResults) {
      return {
        stepName: 'score',
        success: false,
        error: 'No clause results available for scoring',
        durationMs: performance.now() - startTime,
        warnings,
      };
    }

    // Convert to scoring format
    const clauseResults = toClauseResults(state.clauseResults);

    // Compute score
    const scoringResult = computeScore(clauseResults);

    // Create summary
    const summary = createScoreSummary(scoringResult, state.clauseResults);

    // Add warnings for low confidence or review recommendations
    if (summary.confidence === 'low') {
      warnings.push(
        'Low confidence in verification results - consider adding more explicit bindings'
      );
    }

    if (summary.recommendation === 'review') {
      warnings.push(
        'Recommend manual review before shipping - some clauses need attention'
      );
    }

    return {
      stepName: 'score',
      success: true,
      data: {
        scoringResult,
        summary,
      },
      durationMs: performance.now() - startTime,
      warnings,
    };
  } catch (error) {
    return {
      stepName: 'score',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: performance.now() - startTime,
      warnings,
    };
  }
}
