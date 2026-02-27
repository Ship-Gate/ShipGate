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
  /** Tests did not execute (import errors, TS config, runtime crash, all-skipped) */
  'verification_blocked',
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
  | 'test-execution'
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
 * Options for verdict production.
 */
export interface VerdictOptions {
  /** Custom thresholds */
  thresholds?: ScoringThresholds;
  /**
   * If true, verification_blocked downgrades to WARN instead of NO_SHIP,
   * but ONLY when specs are fully typed (high-confidence) and at least
   * one minimal runtime sanity check ran.
   * Default: false (NO_SHIP on execution failure).
   */
  warnOnExecFailure?: boolean;
}

/**
 * Produce a complete, explainable verdict from collected evidence.
 *
 * Decision algorithm:
 * 1. If any critical failure → NO_SHIP (regardless of score)
 *    - verification_blocked can be downgraded to WARN if warnOnExecFailure is set
 *      AND specs are high-confidence AND at least one runtime check passed
 * 2. If score ≥ 0.85 → SHIP
 * 3. If score ≥ 0.50 → WARN
 * 4. Otherwise → NO_SHIP
 *
 * But **never** SHIP when verification_blocked is present.
 */
export function produceVerdict(
  evidence: readonly GateEvidence[],
  thresholdsOrOptions?: ScoringThresholds | VerdictOptions,
): GateVerdict {
  // Support both old (thresholds-only) and new (options object) signatures
  const options: VerdictOptions = thresholdsOrOptions && 'SHIP' in thresholdsOrOptions
    ? { thresholds: thresholdsOrOptions as ScoringThresholds }
    : (thresholdsOrOptions as VerdictOptions) ?? {};
  const thresholds = options.thresholds ?? SCORING_THRESHOLDS;
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

    // Check if ALL critical failures are verification_blocked and
    // warnOnExecFailure is enabled with qualifying conditions
    const allBlockedOnly = criticalFailures.every(e => e.check.includes('verification_blocked'));
    if (allBlockedOnly && options.warnOnExecFailure) {
      // Only allow WARN downgrade if:
      // 1. At least one ISL spec check passed (high-confidence typed specs)
      // 2. At least one runtime-eval or static-analysis check passed
      const hasHighConfidenceSpec = evidenceList.some(
        e => e.source === 'isl-spec' && e.result === 'pass' && e.confidence >= 0.85,
      );
      const hasMinimalRuntimeCheck = evidenceList.some(
        e => (e.source === 'runtime-eval' || e.source === 'static-analysis') && e.result === 'pass',
      );
      if (hasHighConfidenceSpec && hasMinimalRuntimeCheck) {
        return {
          decision: 'WARN',
          score,
          evidence: evidenceList,
          summary: `WARN: Verification blocked (tests did not run) but specs are high-confidence — warn-on-exec-failure enabled`,
          blockers: [],
          recommendations: [
            ...recommendations,
            'Fix test execution to achieve full verification',
          ],
        };
      }
    }

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

  // ── TRUTH MODE: Empty evidence = NO_SHIP ───────────────────────────
  // Never claim safety without executed evidence.
  const scoreableEvidence = evidenceList.filter(e => e.result !== 'skip');
  if (scoreableEvidence.length === 0) {
    return {
      decision: 'NO_SHIP',
      score: 0,
      evidence: evidenceList,
      summary: 'NO_SHIP: No scoreable evidence — cannot verify intent',
      blockers: ['No evidence collected: verification produced no actionable results'],
      recommendations: ['Add ISL specs with behaviors, postconditions, and error cases'],
    };
  }

  // ── TRUTH MODE: No passing evidence = cannot SHIP ──────────────────
  const passingEvidence = evidenceList.filter(e => e.result === 'pass');
  if (passingEvidence.length === 0 && score >= thresholds.SHIP) {
    // Score is high but nothing actually passed — cap to WARN
    return {
      decision: 'WARN',
      score,
      evidence: evidenceList,
      summary: `WARN: Score ${formatPct(score)} but no checks passed — insufficient evidence for SHIP`,
      blockers: [],
      recommendations: ['Add executable checks that produce pass/fail evidence'],
    };
  }

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
