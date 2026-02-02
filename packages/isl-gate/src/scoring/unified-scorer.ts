/**
 * Unified Scorer
 * 
 * Single source of truth for all gate scoring.
 * 
 * Rules:
 * - Score is always 0-100, higher is better
 * - Verdict thresholds: SHIP >= 80, WARN >= 60, BLOCK < 60
 * - Scores are always integers (Math.round)
 * - Critical blockers force BLOCK regardless of score
 * 
 * @module @isl-lang/gate/scoring/unified-scorer
 */

import type {
  CommandVerdict,
  CommandCounts,
  CommandScores,
  CommandVerdictInfo,
  SeverityCounts,
  CriticalBlockers,
} from '../types/index.js';

import {
  VERDICT_THRESHOLDS,
  SEVERITY_PENALTIES,
  createEmptySeverityCounts,
  createEmptyCommandCounts,
  assertCountsValid,
  assertScoresValid,
} from '../types/index.js';

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Calculate overall health score from finding counts
 * 
 * Formula: score = 100 - penalty
 * where penalty = min(100, sum(count * weight))
 * 
 * @param counts - Severity counts
 * @returns Score from 0-100 (integer)
 */
export function calculateHealthScore(counts: SeverityCounts): number {
  const penalty = 
    (counts.critical * SEVERITY_PENALTIES.critical) +
    (counts.high * SEVERITY_PENALTIES.high) +
    (counts.medium * SEVERITY_PENALTIES.medium) +
    (counts.low * SEVERITY_PENALTIES.low);
  
  const score = Math.max(0, 100 - Math.min(100, penalty));
  return Math.round(score);
}

/**
 * Calculate score from command counts
 */
export function calculateScoreFromCounts(counts: CommandCounts): number {
  return calculateHealthScore(counts.findingsBySeverity);
}

/**
 * Calculate pass rate as a percentage
 */
export function calculatePassRate(passed: number, total: number): number {
  if (total === 0) return 100;
  const rate = (passed / total) * 100;
  return Math.round(Math.max(0, Math.min(100, rate)));
}

/**
 * Calculate score from pass/fail counts
 */
export function calculateScoreFromPassRate(passed: number, total: number): number {
  return calculatePassRate(passed, total);
}

// ============================================================================
// Verdict Determination
// ============================================================================

/**
 * Get critical blocker reasons
 */
export function getCriticalBlockerReasons(blockers: CriticalBlockers): string[] {
  const reasons: string[] = [];
  
  if (blockers.missingRequiredEnvVars && blockers.missingRequiredEnvVars > 0) {
    reasons.push(`Missing ${blockers.missingRequiredEnvVars} required environment variable(s)`);
  }
  
  if (blockers.unprotectedSensitiveRoutes && blockers.unprotectedSensitiveRoutes > 2) {
    reasons.push(`${blockers.unprotectedSensitiveRoutes} sensitive routes without authentication`);
  }
  
  if (blockers.ghostRoutes && blockers.ghostRoutes > 5) {
    reasons.push(`${blockers.ghostRoutes} unverified ghost routes detected`);
  }
  
  if (blockers.credentialFindings && blockers.credentialFindings > 0) {
    reasons.push(`${blockers.credentialFindings} credential(s) found in code`);
  }
  
  if (blockers.fakeAuthFindings && blockers.fakeAuthFindings > 0) {
    reasons.push(`${blockers.fakeAuthFindings} fake auth pattern(s) detected`);
  }
  
  if (blockers.customBlockers) {
    reasons.push(...blockers.customBlockers);
  }
  
  return reasons;
}

/**
 * Determine verdict from score
 */
export function getVerdictFromScore(score: number): CommandVerdict {
  if (score >= VERDICT_THRESHOLDS.SHIP) return 'SHIP';
  if (score >= VERDICT_THRESHOLDS.WARN) return 'WARN';
  return 'BLOCK';
}

/**
 * Determine verdict with full context
 */
export function determineVerdict(
  score: number,
  blockers?: CriticalBlockers
): CommandVerdictInfo {
  const reasons: string[] = [];
  
  // Check for critical blockers first
  if (blockers) {
    const blockerReasons = getCriticalBlockerReasons(blockers);
    if (blockerReasons.length > 0) {
      return {
        status: 'BLOCK',
        reasons: blockerReasons,
      };
    }
  }
  
  // Score-based verdict
  const status = getVerdictFromScore(score);
  
  if (status === 'SHIP') {
    reasons.push('All checks passed');
  } else if (status === 'WARN') {
    reasons.push(`Score ${score} is below SHIP threshold (${VERDICT_THRESHOLDS.SHIP})`);
  } else {
    reasons.push(`Score ${score} is below WARN threshold (${VERDICT_THRESHOLDS.WARN})`);
  }
  
  return { status, reasons };
}

// ============================================================================
// Score Building
// ============================================================================

/**
 * Build scores object from counts
 */
export function buildScores(
  counts: CommandCounts,
  confidence?: number
): CommandScores {
  const scores: CommandScores = {
    overall: calculateScoreFromCounts(counts),
  };
  
  if (confidence !== undefined) {
    scores.confidence = Math.round(Math.max(0, Math.min(100, confidence)));
  }
  
  return scores;
}

/**
 * Build scores from pass rate
 */
export function buildScoresFromPassRate(
  passed: number,
  total: number,
  confidence?: number
): CommandScores {
  const scores: CommandScores = {
    overall: calculateScoreFromPassRate(passed, total),
  };
  
  if (confidence !== undefined) {
    scores.confidence = Math.round(Math.max(0, Math.min(100, confidence)));
  }
  
  return scores;
}

// ============================================================================
// Count Building
// ============================================================================

/**
 * Build severity counts from items
 */
export function buildSeverityCounts<T extends { severity: string }>(
  items: T[]
): SeverityCounts {
  const counts = createEmptySeverityCounts();
  
  for (const item of items) {
    const severity = item.severity.toLowerCase();
    if (severity === 'critical') counts.critical++;
    else if (severity === 'high' || severity === 'error') counts.high++;
    else if (severity === 'medium' || severity === 'warning') counts.medium++;
    else if (severity === 'low' || severity === 'info') counts.low++;
  }
  
  return counts;
}

/**
 * Build type counts from items
 */
export function buildTypeCounts<T extends { type: string }>(
  items: T[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  
  for (const item of items) {
    counts[item.type] = (counts[item.type] || 0) + 1;
  }
  
  return counts;
}

/**
 * Build full command counts from findings
 */
export function buildCommandCounts<T extends { severity: string; type: string }>(
  findings: T[],
  filesConsidered: number,
  filesScanned: number
): CommandCounts {
  const findingsBySeverity = buildSeverityCounts(findings);
  const findingsByType = buildTypeCounts(findings);
  const findingsTotal = findings.length;
  
  const counts: CommandCounts = {
    filesConsidered,
    filesScanned,
    filesSkipped: filesConsidered - filesScanned,
    findingsTotal,
    findingsBySeverity,
    findingsByType,
  };
  
  assertCountsValid(counts);
  
  return counts;
}

// ============================================================================
// Complete Result Building
// ============================================================================

/**
 * Options for building a complete result
 */
export interface BuildResultOptions<T extends { severity: string; type: string }> {
  findings: T[];
  filesConsidered: number;
  filesScanned: number;
  confidence?: number;
  blockers?: CriticalBlockers;
}

/**
 * Result of building scores and verdict
 */
export interface BuiltResult {
  counts: CommandCounts;
  scores: CommandScores;
  verdict: CommandVerdictInfo;
}

/**
 * Build complete result from findings
 */
export function buildResult<T extends { severity: string; type: string }>(
  options: BuildResultOptions<T>
): BuiltResult {
  const counts = buildCommandCounts(
    options.findings,
    options.filesConsidered,
    options.filesScanned
  );
  
  const scores = buildScores(counts, options.confidence);
  assertScoresValid(scores);
  
  const verdict = determineVerdict(scores.overall, options.blockers);
  
  return { counts, scores, verdict };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get color for score display
 */
export function getScoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= VERDICT_THRESHOLDS.SHIP) return 'green';
  if (score >= VERDICT_THRESHOLDS.WARN) return 'yellow';
  return 'red';
}

/**
 * Get status label for score
 */
export function getScoreStatus(score: number): 'optimal' | 'stable' | 'warning' | 'critical' {
  if (score >= 90) return 'optimal';
  if (score >= VERDICT_THRESHOLDS.SHIP) return 'stable';
  if (score >= VERDICT_THRESHOLDS.WARN) return 'warning';
  return 'critical';
}

/**
 * Format score for display
 */
export function formatScore(score: number): string {
  return `${score}/100`;
}

/**
 * Format verdict for display
 */
export function formatVerdict(verdict: CommandVerdict): string {
  const emojis = {
    SHIP: '✅',
    WARN: '⚠️',
    BLOCK: '🛑',
  };
  return `${emojis[verdict]} ${verdict}`;
}

// Re-exports
export {
  VERDICT_THRESHOLDS,
  SEVERITY_PENALTIES,
  createEmptySeverityCounts,
  createEmptyCommandCounts,
  assertCountsValid,
  assertScoresValid,
};
