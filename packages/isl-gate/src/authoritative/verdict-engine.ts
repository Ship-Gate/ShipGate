/**
 * Verdict Engine — SHIP / WARN / NO_SHIP
 *
 * Produces scored, explainable verdicts with full evidence trails.
 * ISL-verified evidence is weighted 2× relative to specless evidence.
 *
 * Decision flow:
 * 1. Scan evidence for critical failures → NO_SHIP immediately
 * 2. Compute weighted score from evidence confidence values
 * 3. Apply thresholds: score ≥ 0.85 → SHIP, ≥ 0.50 → WARN, else → NO_SHIP
 *
 * @module @isl-lang/gate/authoritative/verdict-engine
 */

// ============================================================================
// Scoring Thresholds
// ============================================================================

/**
 * Scoring thresholds that map a 0–1 confidence score to a verdict.
 */
export const SCORING_THRESHOLDS = {
  /** High confidence — all critical checks pass */
  SHIP: 0.85,
  /** Mixed signals — non-critical issues present */
  WARN: 0.50,
  /** Below WARN threshold or any critical failure */
  NO_SHIP: 0,
} as const;

export type ScoringThresholds = typeof SCORING_THRESHOLDS;

// ============================================================================
// Critical Failures
// ============================================================================

/**
 * Critical failure categories that force NO_SHIP regardless of score.
 */
export const CRITICAL_FAILURES = [
  /** Spec says X, code does Y */
  'postcondition_violation',
  /** Auth bypass, secret exposure */
  'security_violation',
  /** CVE with CVSS ≥ 9.0 */
  'critical_vulnerability',
  /** Code compiles but doesn't work */
  'fake_feature_detected',
] as const;

export type CriticalFailureKind = typeof CRITICAL_FAILURES[number];

// ============================================================================
// Gate Evidence
// ============================================================================

/**
 * Source of a piece of gate evidence.
 *
 * 'isl-spec' evidence is weighted 2× in score aggregation.
 */
export type GateEvidenceSource =
  | 'isl-spec'
  | 'static-analysis'
  | 'runtime-eval'
  | 'specless-scanner';

/**
 * A single piece of evidence collected during gate evaluation.
 */
export interface GateEvidence {
  /** Where this evidence came from */
  source: GateEvidenceSource;
  /** What was checked, e.g. "postcondition: User.exists(result.id)" */
  check: string;
  /** Outcome of the check */
  result: 'pass' | 'fail' | 'warn' | 'skip';
  /** Confidence in this result, 0–1 */
  confidence: number;
  /** Human-readable details */
  details: string;
}

// ============================================================================
// Gate Verdict
// ============================================================================

/** Tri-state verdict: SHIP, WARN, or NO_SHIP */
export type VerdictDecision = 'SHIP' | 'WARN' | 'NO_SHIP';

/**
 * Complete gate verdict with evidence trail and actionable feedback.
 */
export interface GateVerdict {
  /** Final decision */
  decision: VerdictDecision;
  /** Aggregated score 0–1 */
  score: number;
  /** All evidence used to reach this verdict */
  evidence: GateEvidence[];
  /** One-line human-readable summary */
  summary: string;
  /** What specifically blocked (non-empty only for NO_SHIP) */
  blockers: string[];
  /** Actionable fixes / next steps */
  recommendations: string[];
}

// ============================================================================
// Evidence Helpers
// ============================================================================

/**
 * Create a gate evidence entry with validated confidence.
 */
export function createGateEvidence(
  source: GateEvidenceSource,
  check: string,
  result: GateEvidence['result'],
  confidence: number,
  details: string,
): GateEvidence {
  const clampedConfidence = Math.max(0, Math.min(1, confidence));
  return { source, check, result, confidence: clampedConfidence, details };
}

// ============================================================================
// Score Computation
// ============================================================================

/**
 * Source weight multiplier.
 * ISL-verified evidence counts 2× relative to specless evidence.
 */
function sourceWeight(source: GateEvidenceSource): number {
  return source === 'isl-spec' ? 2 : 1;
}

/**
 * Map a result to a contribution factor.
 * - pass  → 1.0 (full positive contribution)
 * - warn  → 0.5 (half contribution)
 * - fail  → 0.0 (no positive contribution)
 * - skip  → excluded from calculation
 */
function resultFactor(result: GateEvidence['result']): number {
  switch (result) {
    case 'pass': return 1.0;
    case 'warn': return 0.5;
    case 'fail': return 0.0;
    case 'skip': return 0; // should not be called for skip
  }
}

/**
 * Compute the aggregate score from a list of evidence.
 *
 * Score = Σ(confidence × resultFactor × sourceWeight) / Σ(sourceWeight)
 *
 * 'skip' evidence is excluded entirely.
 * Returns 0 when no scoreable evidence exists.
 */
export function computeScore(evidence: readonly GateEvidence[]): number {
  const scoreable = evidence.filter(e => e.result !== 'skip');
  if (scoreable.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const e of scoreable) {
    const sw = sourceWeight(e.source);
    totalWeight += sw;
    weightedSum += e.confidence * resultFactor(e.result) * sw;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// ============================================================================
// Critical Failure Detection
// ============================================================================

/**
 * Find all evidence entries that represent critical failures.
 * A critical failure is a 'fail' result whose check name contains
 * one of the CRITICAL_FAILURES identifiers.
 */
export function findCriticalFailures(evidence: readonly GateEvidence[]): GateEvidence[] {
  return evidence.filter(
    e => e.result === 'fail' && CRITICAL_FAILURES.some(cf => e.check.includes(cf)),
  );
}

/**
 * Check whether any evidence contains a critical failure.
 */
export function hasCriticalFailure(evidence: readonly GateEvidence[]): boolean {
  return findCriticalFailures(evidence).length > 0;
}

// ============================================================================
// Verdict Production
// ============================================================================

/**
 * Produce a complete, explainable verdict from collected evidence.
 *
 * Decision algorithm:
 * 1. If any critical failure → NO_SHIP (regardless of score)
 * 2. If score ≥ 0.85 → SHIP
 * 3. If score ≥ 0.50 → WARN
 * 4. Otherwise → NO_SHIP
 */
export function produceVerdict(
  evidence: readonly GateEvidence[],
  thresholds: ScoringThresholds = SCORING_THRESHOLDS,
): GateVerdict {
  // Defensively copy to avoid mutation
  const evidenceList = [...evidence];

  // ── Step 1: Check for critical failures ──────────────────────────────
  const criticalFailures = findCriticalFailures(evidenceList);
  if (criticalFailures.length > 0) {
    const score = computeScore(evidenceList);
    const blockers = criticalFailures.map(e => `${e.check}: ${e.details}`);
    const recommendations = criticalFailures.map(
      e => `Fix critical issue in "${e.check}": ${e.details}`,
    );

    return {
      decision: 'NO_SHIP',
      score,
      evidence: evidenceList,
      summary: `NO_SHIP: Critical failure — ${criticalFailures[0].check}` +
        (criticalFailures.length > 1 ? ` (+${criticalFailures.length - 1} more)` : ''),
      blockers,
      recommendations,
    };
  }

  // ── Step 2: Compute score ────────────────────────────────────────────
  const score = computeScore(evidenceList);
  const failingEvidence = evidenceList.filter(e => e.result === 'fail');
  const warningEvidence = evidenceList.filter(e => e.result === 'warn');

  // ── Step 3: Apply thresholds ─────────────────────────────────────────
  if (score >= thresholds.SHIP) {
    const recs: string[] = [];
    // Even in SHIP, surface warnings as recommendations
    for (const w of warningEvidence) {
      recs.push(`Consider: ${w.check} — ${w.details}`);
    }

    return {
      decision: 'SHIP',
      score,
      evidence: evidenceList,
      summary: `SHIP: All checks passed — score ${formatPct(score)}`,
      blockers: [],
      recommendations: recs,
    };
  }

  if (score >= thresholds.WARN) {
    const recs: string[] = [];
    for (const f of failingEvidence) {
      recs.push(`Fix: ${f.check} — ${f.details}`);
    }
    for (const w of warningEvidence) {
      recs.push(`Address: ${w.check} — ${w.details}`);
    }

    return {
      decision: 'WARN',
      score,
      evidence: evidenceList,
      summary: `WARN: Mixed signals — score ${formatPct(score)}, ` +
        `${failingEvidence.length} failure(s), ${warningEvidence.length} warning(s)`,
      blockers: [],
      recommendations: recs,
    };
  }

  // ── NO_SHIP (score below WARN threshold) ─────────────────────────────
  const blockers = failingEvidence.map(e => `${e.check}: ${e.details}`);
  const recommendations = failingEvidence.map(
    e => `Fix: ${e.check} — ${e.details}`,
  );

  return {
    decision: 'NO_SHIP',
    score,
    evidence: evidenceList,
    summary: `NO_SHIP: Score ${formatPct(score)} below threshold ${formatPct(thresholds.WARN)}`,
    blockers,
    recommendations,
  };
}

// ============================================================================
// Utility
// ============================================================================

/** Format a 0–1 score as a percentage string, e.g. "85.0%" */
function formatPct(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}
