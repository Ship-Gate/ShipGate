/**
 * Verified Intent — Evaluator
 *
 * The core function that enforces the 3-pillar contract:
 *   SHIP requires ALL three pillars to pass.
 *   If ANY pillar is missing/failed → WARN or NO_SHIP (configurable).
 *
 * @module @isl-lang/gate/verified-intent/evaluator
 */

import type {
  VerifiedIntentResult,
  VerifiedIntentConfig,
  PillarResult,
  ProvenanceReport,
} from './types.js';

import { DEFAULT_VERIFIED_INTENT_CONFIG } from './types.js';

import type {
  VerificationSignal,
  AggregatedSignals,
} from '../authoritative/types.js';

import type { GateEvidence } from '../authoritative/verdict-engine.js';

import {
  evaluateSpecFidelity,
  evaluateCoverage,
  evaluateExecution,
  extractSpecFidelityInput,
  extractCoverageInput,
  extractExecutionInput,
} from './pillars.js';

import type {
  SpecFidelityInput,
  CoverageInput,
  ExecutionInput,
} from './pillars.js';

import { buildProvenanceReport, formatProvenanceReport } from './provenance.js';

// ============================================================================
// Main Evaluator
// ============================================================================

/**
 * Evaluate the Verified Intent contract.
 *
 * Accepts raw signals + evidence (from the gate pipeline) and produces
 * a VerifiedIntentResult that enforces the 3-pillar rule.
 *
 * SHIP is only possible when all three pillars pass.
 */
export function evaluateVerifiedIntent(
  signals: VerificationSignal[],
  aggregation: AggregatedSignals,
  evidence: readonly GateEvidence[],
  config: VerifiedIntentConfig = DEFAULT_VERIFIED_INTENT_CONFIG,
): VerifiedIntentResult {
  // Extract inputs for each pillar from raw signals/evidence
  const specInput = extractSpecFidelityInput(signals, evidence);
  const coverageInput = extractCoverageInput(signals, evidence);
  const execInput = extractExecutionInput(aggregation, evidence);

  return evaluateVerifiedIntentFromInputs(specInput, coverageInput, execInput, config);
}

/**
 * Evaluate from explicit pillar inputs (useful for testing or when
 * callers have pre-computed data).
 */
export function evaluateVerifiedIntentFromInputs(
  specInput: SpecFidelityInput,
  coverageInput: CoverageInput,
  execInput: ExecutionInput,
  config: VerifiedIntentConfig = DEFAULT_VERIFIED_INTENT_CONFIG,
): VerifiedIntentResult {
  // ── Evaluate each pillar ─────────────────────────────────────────────
  const specFidelity = evaluateSpecFidelity(specInput, config);
  const coverage = evaluateCoverage(coverageInput, config);
  const execution = evaluateExecution(execInput, config);

  // ── Check all-three-pass rule ────────────────────────────────────────
  const pillarResults: PillarResult[] = [specFidelity, coverage, execution];
  const allPassed = pillarResults.every(p => p.status === 'passed');
  const failedPillars = pillarResults.filter(p => p.status !== 'passed');
  const missingPillars = pillarResults.filter(p => p.status === 'missing');

  // ── Build provenance report ──────────────────────────────────────────
  const provenance = buildProvenanceReport(pillarResults);

  // ── Determine verdict ────────────────────────────────────────────────
  let verdict: 'SHIP' | 'WARN' | 'NO_SHIP';

  if (allPassed) {
    verdict = 'SHIP';
  } else if (config.missingPillarVerdict === 'NO_SHIP') {
    verdict = 'NO_SHIP';
  } else {
    // missingPillarVerdict === 'WARN'
    // If any pillar is outright 'failed' (not just degraded), still NO_SHIP
    const hasHardFailure = pillarResults.some(p => p.status === 'failed' || p.status === 'missing');
    verdict = hasHardFailure ? 'NO_SHIP' : 'WARN';
  }

  // ── Composite score ──────────────────────────────────────────────────
  const compositeScore = allPassed
    ? (specFidelity.score + coverage.score + execution.score) / 3
    : 0;

  // ── Blockers ─────────────────────────────────────────────────────────
  const blockers: string[] = [];
  for (const p of failedPillars) {
    blockers.push(`Pillar "${p.pillar}" ${p.status}: ${p.summary}`);
    for (const d of p.details.filter(d => !d.passed)) {
      blockers.push(`  → ${d.check}: ${d.message}`);
    }
  }

  // ── Recommendations ──────────────────────────────────────────────────
  const recommendations: string[] = [];
  if (specFidelity.status !== 'passed') {
    recommendations.push('Improve spec fidelity: ensure all signatures and types in the ISL spec match the source implementation.');
  }
  if (coverage.status !== 'passed') {
    recommendations.push('Improve coverage: add postconditions, invariants, and error cases to the ISL spec.');
  }
  if (execution.status !== 'passed') {
    recommendations.push('Improve execution: ensure tests run (not skipped) and results are attributable to spec clauses.');
  }
  if (missingPillars.length > 0) {
    recommendations.push(`Missing pillars: ${missingPillars.map(p => p.pillar).join(', ')}. These must be present for SHIP.`);
  }

  // ── Summary ──────────────────────────────────────────────────────────
  const pillarSummaries = [
    `Fidelity:${statusBadge(specFidelity.status)}`,
    `Coverage:${statusBadge(coverage.status)}`,
    `Execution:${statusBadge(execution.status)}`,
  ].join('  ');

  const summary = `${verdict}: ${allPassed ? 'All 3 pillars passed' : `${failedPillars.length}/3 pillar(s) not passing`} | ${pillarSummaries}`;

  return {
    verdict,
    allPillarsPassed: allPassed,
    pillars: {
      specFidelity,
      coverage,
      execution,
    },
    compositeScore,
    provenance,
    summary,
    blockers,
    recommendations,
  };
}

// ============================================================================
// Verdict Cap — apply verified-intent as a cap on the gate verdict
// ============================================================================

/**
 * Apply the verified-intent 3-pillar rule as a verdict cap.
 *
 * If the gate would otherwise produce SHIP but verified-intent says
 * not all pillars pass, cap the verdict to WARN or NO_SHIP.
 *
 * @param gateVerdict - The verdict the gate would produce without the cap
 * @param intentResult - The verified-intent evaluation result
 * @returns The capped verdict (never higher than what verified-intent allows)
 */
export function applyVerifiedIntentCap(
  gateVerdict: 'SHIP' | 'WARN' | 'NO_SHIP',
  intentResult: VerifiedIntentResult,
): 'SHIP' | 'WARN' | 'NO_SHIP' {
  const order: Record<string, number> = { 'NO_SHIP': 0, 'WARN': 1, 'SHIP': 2 };

  // The intent result provides the maximum allowed verdict
  const maxAllowed = intentResult.verdict;

  // Return the lower of the two
  return order[gateVerdict] <= order[maxAllowed] ? gateVerdict : maxAllowed;
}

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Format a complete VerifiedIntentResult as a human-readable report.
 */
export function formatVerifiedIntentReport(result: VerifiedIntentResult): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════════╗');
  lines.push(`║  VERIFIED INTENT: ${result.verdict.padEnd(30)}║`);
  lines.push('╚══════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(result.summary);
  lines.push('');

  // Per-pillar detail
  lines.push('─── Pillar 1: Spec Fidelity ──────────────────────');
  lines.push(formatPillar(result.pillars.specFidelity));
  lines.push('');

  lines.push('─── Pillar 2: Coverage ───────────────────────────');
  lines.push(formatPillar(result.pillars.coverage));
  lines.push('');

  lines.push('─── Pillar 3: Execution ──────────────────────────');
  lines.push(formatPillar(result.pillars.execution));
  lines.push('');

  // Blockers
  if (result.blockers.length > 0) {
    lines.push('─── Blockers ────────────────────────────────────');
    for (const b of result.blockers) {
      lines.push(`  ✗ ${b}`);
    }
    lines.push('');
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('─── Recommendations ─────────────────────────────');
    for (const r of result.recommendations) {
      lines.push(`  → ${r}`);
    }
    lines.push('');
  }

  // Provenance
  lines.push(formatProvenanceReport(result.provenance));

  return lines.join('\n');
}

function formatPillar(p: PillarResult): string {
  const lines: string[] = [];
  lines.push(`  Status: ${statusBadge(p.status)}  Score: ${(p.score * 100).toFixed(1)}%`);
  lines.push(`  ${p.summary}`);
  for (const d of p.details) {
    const icon = d.passed ? '✓' : '✗';
    lines.push(`    ${icon} ${d.check}: ${d.message}`);
  }
  return lines.join('\n');
}

function statusBadge(status: string): string {
  switch (status) {
    case 'passed': return 'PASS';
    case 'failed': return 'FAIL';
    case 'degraded': return 'DEGRADED';
    case 'missing': return 'MISSING';
    default: return status.toUpperCase();
  }
}
