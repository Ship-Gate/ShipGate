/**
 * Trust Score Calculator
 *
 * Computes a defensible 0-100 trust score from verification results
 * across six categories with configurable weights and unknown-penalty.
 *
 * Scoring rules:
 * - Each category produces a raw 0-100 score from its clause results
 * - pass = 100, fail = 0, partial = 50, unknown = (1 - unknownPenalty) * 100
 * - Category scores are combined via weighted average
 * - criticalFailsBlock: a single failing clause can force score to 0
 * - Final score is always an integer 0-100
 *
 * @module @isl-lang/gate/trust-score/calculator
 */

import type {
  TrustCategory,
  TrustScoreInput,
  TrustScoreConfig,
  TrustScoreResult,
  CategoryScore,
  TrustVerdict,
  ResolvedTrustConfig,
  ClauseStatus,
  TrustClauseResult,
} from './types.js';

import {
  TRUST_CATEGORIES,
  DEFAULT_WEIGHTS,
} from './types.js';

// ============================================================================
// Configuration Resolution
// ============================================================================

/**
 * Resolve partial user config into a fully-populated config.
 */
export function resolveConfig(config?: TrustScoreConfig): ResolvedTrustConfig {
  const weights = { ...DEFAULT_WEIGHTS, ...config?.weights };
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);

  if (weightSum <= 0) {
    throw new Error('Trust score weights must sum to a positive number');
  }

  const normalizedWeights = {} as Record<TrustCategory, number>;
  for (const cat of TRUST_CATEGORIES) {
    normalizedWeights[cat] = weights[cat] / weightSum;
  }

  return {
    weights,
    normalizedWeights,
    unknownPenalty: clamp(config?.unknownPenalty ?? 0.5, 0, 1),
    shipThreshold: config?.shipThreshold ?? 80,
    warnThreshold: config?.warnThreshold ?? 60,
    criticalFailsBlock: config?.criticalFailsBlock ?? true,
    historyPath: config?.historyPath ?? '.isl-gate/trust-history.json',
    maxHistoryEntries: config?.maxHistoryEntries ?? 50,
  };
}

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Compute the trust score from verification clause results.
 */
export function calculateTrustScore(
  input: TrustScoreInput,
  config?: TrustScoreConfig,
): TrustScoreResult {
  const resolved = resolveConfig(config);
  const clauses = input.clauses;

  // Group clauses by category
  const grouped = groupByCategory(clauses);

  // Score each category
  const categoryScores: CategoryScore[] = TRUST_CATEGORIES.map(cat => {
    const catClauses = grouped.get(cat) ?? [];
    return scoreSingleCategory(cat, catClauses, resolved);
  });

  // Check for critical blockers
  const criticalBlock = resolved.criticalFailsBlock && hasCriticalFailure(clauses);

  // Compute overall weighted score
  let overallScore: number;
  if (criticalBlock) {
    overallScore = 0;
  } else {
    overallScore = Math.round(
      categoryScores.reduce((sum, cs) => sum + cs.weightedScore, 0),
    );
  }
  overallScore = clamp(overallScore, 0, 100);

  // Aggregate counts
  const counts = aggregateCounts(categoryScores);

  // Determine verdict
  const verdict = determineVerdict(overallScore, resolved);

  // Build reasons
  const reasons = buildReasons(overallScore, verdict, criticalBlock, categoryScores, resolved);

  return {
    score: overallScore,
    verdict,
    categories: categoryScores,
    totalClauses: clauses.length,
    counts,
    criticalBlock,
    reasons,
    config: resolved,
    timestamp: input.metadata?.timestamp ?? new Date().toISOString(),
  };
}

// ============================================================================
// Category Scoring
// ============================================================================

/**
 * Score a single category from its clause results.
 */
function scoreSingleCategory(
  category: TrustCategory,
  clauses: TrustClauseResult[],
  config: ResolvedTrustConfig,
): CategoryScore {
  const weight = config.normalizedWeights[category];

  if (clauses.length === 0) {
    // No clauses for this category: treat as unknown
    const unknownScore = Math.round((1 - config.unknownPenalty) * 100);
    return {
      category,
      score: unknownScore,
      weight,
      weightedScore: unknownScore * weight,
      clauseCount: 0,
      counts: { pass: 0, fail: 0, partial: 0, unknown: 0 },
    };
  }

  const counts = { pass: 0, fail: 0, partial: 0, unknown: 0 };
  let scoreSum = 0;

  for (const clause of clauses) {
    counts[clause.status]++;
    scoreSum += clauseStatusToScore(clause.status, config.unknownPenalty);
  }

  const rawScore = Math.round(scoreSum / clauses.length);
  const score = clamp(rawScore, 0, 100);

  return {
    category,
    score,
    weight,
    weightedScore: score * weight,
    clauseCount: clauses.length,
    counts,
  };
}

/**
 * Convert a clause status into a 0-100 score.
 */
function clauseStatusToScore(status: ClauseStatus, unknownPenalty: number): number {
  switch (status) {
    case 'pass':
      return 100;
    case 'fail':
      return 0;
    case 'partial':
      return 50;
    case 'unknown':
      return Math.round((1 - unknownPenalty) * 100);
  }
}

// ============================================================================
// Verdict Logic
// ============================================================================

/**
 * Determine the verdict from the overall score.
 */
function determineVerdict(score: number, config: ResolvedTrustConfig): TrustVerdict {
  if (score >= config.shipThreshold) return 'SHIP';
  if (score >= config.warnThreshold) return 'WARN';
  return 'BLOCK';
}

/**
 * Check if any clause is a critical failure (fail status with explicit confidence < 10).
 * A failing clause in the invariants or preconditions category is always critical.
 */
function hasCriticalFailure(clauses: TrustClauseResult[]): boolean {
  const criticalCategories: TrustCategory[] = ['invariants', 'preconditions'];

  return clauses.some(c => {
    if (c.status !== 'fail') return false;
    // Explicit critical marker via low confidence
    if (c.confidence !== undefined && c.confidence < 10) return true;
    // Invariant/precondition failures are always critical
    if (criticalCategories.includes(c.category)) return true;
    return false;
  });
}

// ============================================================================
// Reason Building
// ============================================================================

/**
 * Build human-readable reasons for the verdict.
 */
function buildReasons(
  score: number,
  verdict: TrustVerdict,
  criticalBlock: boolean,
  categories: CategoryScore[],
  config: ResolvedTrustConfig,
): string[] {
  const reasons: string[] = [];

  if (criticalBlock) {
    reasons.push('Critical clause failure detected -- score forced to 0');
  }

  if (verdict === 'SHIP') {
    reasons.push(`Trust score ${score}/100 meets SHIP threshold (>= ${config.shipThreshold})`);
  } else if (verdict === 'WARN') {
    reasons.push(`Trust score ${score}/100 is below SHIP threshold (${config.shipThreshold}) but above BLOCK (${config.warnThreshold})`);
  } else {
    reasons.push(`Trust score ${score}/100 is below BLOCK threshold (${config.warnThreshold})`);
  }

  // Flag weak categories
  const weakCategories = categories.filter(c => c.score < config.warnThreshold && c.clauseCount > 0);
  for (const wc of weakCategories) {
    reasons.push(`${wc.category}: ${wc.score}/100 (${wc.counts.fail} failed, ${wc.counts.unknown} unknown)`);
  }

  // Flag empty categories subject to unknown penalty
  const emptyCategories = categories.filter(c => c.clauseCount === 0 && config.unknownPenalty > 0);
  if (emptyCategories.length > 0) {
    const names = emptyCategories.map(c => c.category).join(', ');
    reasons.push(`Unknown penalty applied to uncovered categories: ${names}`);
  }

  return reasons;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Group clause results by their category.
 */
function groupByCategory(
  clauses: TrustClauseResult[],
): Map<TrustCategory, TrustClauseResult[]> {
  const map = new Map<TrustCategory, TrustClauseResult[]>();
  for (const clause of clauses) {
    const existing = map.get(clause.category) ?? [];
    existing.push(clause);
    map.set(clause.category, existing);
  }
  return map;
}

/**
 * Aggregate counts across all categories.
 */
function aggregateCounts(
  categories: CategoryScore[],
): { pass: number; fail: number; partial: number; unknown: number } {
  return categories.reduce(
    (acc, cs) => ({
      pass: acc.pass + cs.counts.pass,
      fail: acc.fail + cs.counts.fail,
      partial: acc.partial + cs.counts.partial,
      unknown: acc.unknown + cs.counts.unknown,
    }),
    { pass: 0, fail: 0, partial: 0, unknown: 0 },
  );
}

/**
 * Clamp a number to a range.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
