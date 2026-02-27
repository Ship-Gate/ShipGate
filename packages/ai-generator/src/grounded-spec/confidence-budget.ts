/**
 * Spec Confidence Budget
 *
 * Implements the "Spec Confidence Budget" concept:
 * - Total confidence is capped by evidence quality
 * - Speculative rules cannot contribute full score unless validated by tests
 * - Prevents AI from making up "business rules" you never had
 *
 * @module @isl-lang/ai-generator/grounded-spec/confidence-budget
 */

import type {
  GroundedBehavior,
  GroundedCondition,
  GroundedError,
  GroundedEffect,
  EvidenceQuality,
  ConfidenceAssessment,
  SpecConfidenceBudget,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Maximum contribution per evidence quality tier */
const QUALITY_CAPS: Record<EvidenceQuality, number> = {
  strong: 1.0,
  moderate: 0.75,
  weak: 0.5,
  speculative: 0.25,
};

/** Weight multiplier per evidence quality tier */
const QUALITY_WEIGHTS: Record<EvidenceQuality, number> = {
  strong: 1.0,
  moderate: 0.8,
  weak: 0.5,
  speculative: 0.2,
};

// ============================================================================
// Main entry
// ============================================================================

/**
 * Compute the confidence budget for a set of grounded behaviors.
 * This analyzes every condition/error/effect and produces an overall score
 * that reflects how well-grounded the spec is in actual code evidence.
 */
export function computeConfidenceBudget(behaviors: GroundedBehavior[]): SpecConfidenceBudget {
  const assessments: ConfidenceAssessment[] = [];

  for (const behavior of behaviors) {
    // Assess preconditions
    for (const cond of behavior.preconditions) {
      assessments.push(assessCondition(cond, `${behavior.name}.precondition`));
    }

    // Assess postconditions
    for (const cond of behavior.postconditions) {
      assessments.push(assessCondition(cond, `${behavior.name}.postcondition`));
    }

    // Assess invariants
    for (const cond of behavior.invariants) {
      assessments.push(assessCondition(cond, `${behavior.name}.invariant`));
    }

    // Assess errors
    for (const err of behavior.errors) {
      assessments.push(assessError(err, behavior.name));
    }

    // Assess effects
    for (const eff of behavior.effects) {
      assessments.push(assessEffect(eff, behavior.name));
    }
  }

  // Compute tier counts
  let strongCount = 0;
  let moderateCount = 0;
  let weakCount = 0;
  let speculativeCount = 0;

  for (const a of assessments) {
    switch (a.evidenceQuality) {
      case 'strong': strongCount++; break;
      case 'moderate': moderateCount++; break;
      case 'weak': weakCount++; break;
      case 'speculative': speculativeCount++; break;
    }
  }

  // Compute overall score as weighted average of adjusted confidences
  const totalRules = assessments.length;
  if (totalRules === 0) {
    return {
      totalBudget: 1.0,
      usedBudget: 0,
      remainingBudget: 1.0,
      assessments,
      strongCount,
      moderateCount,
      weakCount,
      speculativeCount,
      overallScore: 0,
    };
  }

  let weightedSum = 0;
  let weightTotal = 0;

  for (const a of assessments) {
    const weight = QUALITY_WEIGHTS[a.evidenceQuality];
    weightedSum += a.adjustedConfidence * weight;
    weightTotal += weight;
  }

  const overallScore = weightTotal > 0 ? weightedSum / weightTotal : 0;

  // Budget: speculative rules "use up" budget faster
  const totalBudget = 1.0;
  const usedBudget = assessments.reduce((sum, a) => {
    // Speculative rules cost more budget
    const cost = a.speculative ? 0.15 : 0.05;
    return sum + cost;
  }, 0);

  return {
    totalBudget,
    usedBudget: Math.min(totalBudget, usedBudget),
    remainingBudget: Math.max(0, totalBudget - usedBudget),
    assessments,
    strongCount,
    moderateCount,
    weakCount,
    speculativeCount,
    overallScore: Math.min(1, Math.max(0, overallScore)),
  };
}

// ============================================================================
// Assessment logic
// ============================================================================

function assessCondition(cond: GroundedCondition, context: string): ConfidenceAssessment {
  const evidenceQuality = classifyEvidence(cond.evidence, cond.confidence);
  const cap = QUALITY_CAPS[evidenceQuality];
  const adjustedConfidence = Math.min(cond.confidence, cap);
  const speculative = evidenceQuality === 'speculative';

  return {
    condition: `${context}: ${cond.expr}`,
    rawConfidence: cond.confidence,
    evidenceQuality,
    adjustedConfidence,
    evidenceCount: cond.evidence.length,
    speculative,
    reason: speculative
      ? `No strong evidence; AI confidence ${cond.confidence.toFixed(2)} capped at ${cap}`
      : `Evidence quality "${evidenceQuality}" supports confidence ${adjustedConfidence.toFixed(2)}`,
  };
}

function assessError(err: GroundedError, behaviorName: string): ConfidenceAssessment {
  const evidenceQuality = classifyEvidence(err.evidence, err.confidence);
  const cap = QUALITY_CAPS[evidenceQuality];
  const adjustedConfidence = Math.min(err.confidence, cap);
  const speculative = evidenceQuality === 'speculative';

  return {
    condition: `${behaviorName}.error: ${err.throws} when ${err.when}`,
    rawConfidence: err.confidence,
    evidenceQuality,
    adjustedConfidence,
    evidenceCount: err.evidence.length,
    speculative,
    reason: speculative
      ? `Error "${err.throws}" lacks direct throw-site evidence`
      : `Error "${err.throws}" supported by ${err.evidence.length} evidence(s)`,
  };
}

function assessEffect(eff: GroundedEffect, behaviorName: string): ConfidenceAssessment {
  const evidenceQuality = classifyEvidence(eff.evidence, eff.confidence);
  const cap = QUALITY_CAPS[evidenceQuality];
  const adjustedConfidence = Math.min(eff.confidence, cap);
  const speculative = evidenceQuality === 'speculative';

  return {
    condition: `${behaviorName}.effect: ${eff.type} → ${eff.target}`,
    rawConfidence: eff.confidence,
    evidenceQuality,
    adjustedConfidence,
    evidenceCount: eff.evidence.length,
    speculative,
    reason: speculative
      ? `Effect "${eff.type}" on "${eff.target}" is speculative`
      : `Effect supported by ${eff.evidence.length} evidence(s)`,
  };
}

// ============================================================================
// Evidence classification
// ============================================================================

/**
 * Classify the quality of evidence for a rule.
 * Looks at both the evidence strings and the AI's self-reported confidence.
 */
function classifyEvidence(evidence: string[], rawConfidence: number): EvidenceQuality {
  if (evidence.length === 0) return 'speculative';

  // Check if any evidence is explicitly speculative
  const hasSpeculativeMarker = evidence.some(
    (e) => e.toLowerCase().includes('speculative') || e.toLowerCase().includes('no direct evidence'),
  );
  if (hasSpeculativeMarker) return 'speculative';

  // Strong evidence indicators
  const strongPatterns = [
    /^throw\s/i,
    /^zod:/i,
    /^yup:/i,
    /^joi:/i,
    /^prisma\./i,
    /^schema:/i,
    /^return\s*\{/i,
    /^type\s+constraint/i,
    /line\s+\d+/i,
  ];

  let strongHits = 0;
  let moderateHits = 0;

  for (const e of evidence) {
    if (strongPatterns.some((p) => p.test(e))) {
      strongHits++;
    } else {
      moderateHits++;
    }
  }

  // Classify based on evidence strength + AI confidence
  if (strongHits > 0 && rawConfidence >= 0.7) return 'strong';
  if (strongHits > 0 || (moderateHits > 0 && rawConfidence >= 0.6)) return 'moderate';
  if (moderateHits > 0 || rawConfidence >= 0.4) return 'weak';
  return 'speculative';
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format the confidence budget as a human-readable report.
 */
export function formatBudgetReport(budget: SpecConfidenceBudget): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════════╗');
  lines.push('║          SPEC CONFIDENCE BUDGET REPORT          ║');
  lines.push('╠══════════════════════════════════════════════════╣');
  lines.push(`║ Overall Score:  ${padRight(`${(budget.overallScore * 100).toFixed(1)}%`, 33)}║`);
  lines.push(`║ Strong rules:   ${padRight(String(budget.strongCount), 33)}║`);
  lines.push(`║ Moderate rules: ${padRight(String(budget.moderateCount), 33)}║`);
  lines.push(`║ Weak rules:     ${padRight(String(budget.weakCount), 33)}║`);
  lines.push(`║ Speculative:    ${padRight(String(budget.speculativeCount), 33)}║`);
  lines.push('╠══════════════════════════════════════════════════╣');

  if (budget.speculativeCount > 0) {
    lines.push('║ ⚠ Speculative rules detected:                   ║');
    for (const a of budget.assessments) {
      if (a.speculative) {
        const label = truncate(a.condition, 44);
        lines.push(`║   ${padRight(label, 47)}║`);
      }
    }
    lines.push('╠══════════════════════════════════════════════════╣');
  }

  lines.push('║ Tip: Run tests to validate speculative rules     ║');
  lines.push('╚══════════════════════════════════════════════════╝');

  return lines.join('\n');
}

function padRight(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
}
