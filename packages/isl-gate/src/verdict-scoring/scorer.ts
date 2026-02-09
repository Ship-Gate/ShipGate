/**
 * Verdict Scorer
 * 
 * Implements deterministic scoring of claims and evidence to produce
 * explainable SHIP/WARN/NO_SHIP verdicts.
 * 
 * @module @isl-lang/gate/verdict-scoring/scorer
 */

import type {
  ISLClaim,
  ScoredClaim,
  VerdictScoringResult,
  VerdictExplanation,
  ScoringConfig,
  BlastRadius,
  Severity,
} from './types.js';
import {
  BLAST_RADIUS,
  SEVERITY_BY_CLAIM_TYPE,
  verdictToSeverity,
  DEFAULT_SCORING_CONFIG,
} from './types.js';
import type { GateEvidence } from '../authoritative/verdict-engine.js';
import { findCriticalFailures } from '../authoritative/verdict-engine.js';

// ============================================================================
// Claim Deduplication
// ============================================================================

/**
 * Normalize claim ID for deduplication
 */
function normalizeClaimId(claim: ISLClaim): string {
  // Use behavior + type + description hash for deduplication
  const key = [
    claim.behavior || '',
    claim.type,
    claim.description || claim.expression || claim.id,
  ].join('::');
  return key;
}

/**
 * Merge duplicate claims, keeping the most severe verdict
 */
function mergeDuplicateClaims(claims: ISLClaim[]): ISLClaim[] {
  const seen = new Map<string, ISLClaim>();
  
  for (const claim of claims) {
    const key = normalizeClaimId(claim);
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, claim);
      continue;
    }
    
    // Merge: keep the most severe verdict
    const severityOrder: ClaimVerdict[] = ['fail', 'not_proven', 'warn', 'skip', 'pass'];
    const existingIdx = severityOrder.indexOf(existing.verdict);
    const currentIdx = severityOrder.indexOf(claim.verdict);
    
    if (currentIdx < existingIdx) {
      // Current is more severe, replace
      seen.set(key, claim);
    } else if (currentIdx === existingIdx && !existing.description && claim.description) {
      // Same severity, but current has description
      seen.set(key, claim);
    }
  }
  
  return Array.from(seen.values());
}

// ============================================================================
// Blast Radius Detection
// ============================================================================

/**
 * Determine blast radius for a claim
 */
function determineBlastRadius(
  claim: ISLClaim,
  customMapping?: (claim: ISLClaim) => BlastRadius
): BlastRadius {
  if (customMapping) {
    return customMapping(claim);
  }
  
  // Default heuristic: postconditions and invariants have higher impact
  if (claim.type === 'postcondition' || claim.type === 'invariant') {
    // Check if it's security-related
    const desc = (claim.description || '').toLowerCase();
    if (desc.includes('auth') || desc.includes('security') || desc.includes('permission')) {
      return 'prod-user-impact';
    }
    return 'repo';
  }
  
  if (claim.type === 'precondition') {
    return 'module';
  }
  
  return 'local';
}

// ============================================================================
// Confidence Calculation
// ============================================================================

/**
 * Calculate confidence for a claim based on evidence
 */
function calculateClaimConfidence(
  claim: ISLClaim,
  evidence: GateEvidence[]
): number {
  // Find evidence related to this claim
  const relatedEvidence = evidence.filter(e => {
    // Match by claim ID in check name
    if (e.check.includes(claim.id)) return true;
    // Match by behavior and type
    if (claim.behavior && e.check.includes(claim.behavior)) {
      if (claim.type === 'postcondition' && e.check.includes('postcondition')) return true;
      if (claim.type === 'invariant' && e.check.includes('invariant')) return true;
    }
    return false;
  });
  
  if (relatedEvidence.length === 0) {
    // No evidence - low confidence
    return claim.verdict === 'pass' ? 0.5 : 0.3;
  }
  
  // Average confidence of related evidence, weighted by result
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const e of relatedEvidence) {
    const weight = e.result === 'pass' ? 1.0 : e.result === 'warn' ? 0.5 : 0.0;
    totalWeight += weight;
    weightedSum += e.confidence * weight;
  }
  
  if (totalWeight === 0) {
    return 0.3; // All evidence was failures
  }
  
  return Math.min(1.0, weightedSum / totalWeight);
}

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Calculate score contribution for a claim
 */
function calculateScoreContribution(
  claim: ISLClaim,
  confidence: number,
  blastRadius: BlastRadius,
  severity: Severity
): number {
  const severityConfig = SEVERITY_BY_CLAIM_TYPE[claim.type];
  const radiusInfo = BLAST_RADIUS[blastRadius];
  
  // Base score based on verdict
  let baseScore = 0;
  switch (claim.verdict) {
    case 'pass':
      baseScore = 100;
      break;
    case 'warn':
      baseScore = 50;
      break;
    case 'not_proven':
      baseScore = 30;
      break;
    case 'skip':
      baseScore = 0;
      break;
    case 'fail':
      baseScore = 0;
      break;
  }
  
  // Apply confidence multiplier
  const confidenceAdjusted = baseScore * confidence;
  
  // Apply severity penalty for failures
  if (claim.verdict === 'fail') {
    const penalty = severityConfig.penaltyMultiplier * radiusInfo.weight;
    return Math.max(0, confidenceAdjusted - (penalty * 20));
  }
  
  return confidenceAdjusted;
}

// ============================================================================
// Explanation Generation
// ============================================================================

/**
 * Generate explanation for a scored claim
 */
function generateClaimExplanation(claim: ScoredClaim): string {
  const parts: string[] = [];
  
  if (claim.verdict === 'fail') {
    parts.push(`FAILED ${claim.type.toUpperCase()}`);
    if (claim.behavior) {
      parts.push(`in behavior "${claim.behavior}"`);
    }
    if (claim.description) {
      parts.push(`: ${claim.description}`);
    }
    parts.push(` (${claim.severity} severity, ${claim.blastRadius} impact)`);
  } else if (claim.verdict === 'warn') {
    parts.push(`WARNING: ${claim.type}`);
    if (claim.description) {
      parts.push(` - ${claim.description}`);
    }
  } else if (claim.verdict === 'not_proven') {
    parts.push(`UNPROVEN: ${claim.type}`);
    if (claim.description) {
      parts.push(` - ${claim.description}`);
    }
    parts.push(' (insufficient evidence)');
  } else {
    parts.push(`PASSED: ${claim.type}`);
    if (claim.description) {
      parts.push(` - ${claim.description}`);
    }
  }
  
  if (claim.fixLocation) {
    parts.push(` → Fix in ${claim.fixLocation.file}`);
    if (claim.fixLocation.line) {
      parts.push(`:${claim.fixLocation.line}`);
    }
  }
  
  return parts.join('');
}

/**
 * Generate verdict-level explanations
 */
function generateVerdictExplanations(
  scoredClaims: ScoredClaim[],
  evidence: GateEvidence[],
  score: number,
  confidence: number,
  config: ScoringConfig
): VerdictExplanation[] {
  const explanations: VerdictExplanation[] = [];
  
  // Check for critical failures
  const criticalFailures = findCriticalFailures(evidence);
  if (criticalFailures.length > 0) {
    explanations.push({
      category: 'critical_failure',
      message: `Critical failure detected: ${criticalFailures[0].check}`,
      evidenceIndices: evidence.map((e, i) => criticalFailures.includes(e) ? i : -1).filter(i => i >= 0),
    });
  }
  
  // Check claim failures
  const failedClaims = scoredClaims.filter(c => c.verdict === 'fail');
  if (failedClaims.length > 0) {
    explanations.push({
      category: 'claim_failure',
      message: `${failedClaims.length} claim(s) failed: ${failedClaims.map(c => c.id).join(', ')}`,
      claimIds: failedClaims.map(c => c.id),
    });
  }
  
  // Threshold explanation
  if (score >= config.thresholds.SHIP) {
    explanations.push({
      category: 'threshold',
      message: `Score ${score.toFixed(1)} meets SHIP threshold (${config.thresholds.SHIP})`,
    });
  } else if (score >= config.thresholds.WARN) {
    explanations.push({
      category: 'threshold',
      message: `Score ${score.toFixed(1)} meets WARN threshold (${config.thresholds.WARN}) but below SHIP (${config.thresholds.SHIP})`,
    });
  } else {
    explanations.push({
      category: 'threshold',
      message: `Score ${score.toFixed(1)} below WARN threshold (${config.thresholds.WARN})`,
    });
  }
  
  // Confidence explanation
  if (confidence < config.minConfidence) {
    explanations.push({
      category: 'confidence',
      message: `Confidence ${(confidence * 100).toFixed(1)}% below minimum ${(config.minConfidence * 100).toFixed(0)}%`,
    });
  }
  
  // Blast radius explanation
  const highImpactClaims = scoredClaims.filter(c => 
    c.blastRadius === 'repo' || c.blastRadius === 'prod-user-impact'
  );
  if (highImpactClaims.length > 0 && failedClaims.length > 0) {
    const highImpactFailures = highImpactClaims.filter(c => c.verdict === 'fail');
    if (highImpactFailures.length > 0) {
      explanations.push({
        category: 'blast_radius',
        message: `${highImpactFailures.length} high-impact claim(s) failed`,
        claimIds: highImpactFailures.map(c => c.id),
      });
    }
  }
  
  return explanations;
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Score verdicts from claims and evidence
 * 
 * This function:
 * 1. Merges duplicate claims
 * 2. Calculates confidence and blast radius for each claim
 * 3. Scores each claim deterministically
 * 4. Orders claims deterministically
 * 5. Generates explanations
 * 
 * @param claims - ISL claims to score
 * @param evidence - Gate evidence
 * @param config - Scoring configuration
 * @returns Scored verdict result
 */
export function scoreVerdicts(
  claims: ISLClaim[],
  evidence: GateEvidence[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): VerdictScoringResult {
  // Step 1: Merge duplicates if enabled
  const deduplicatedClaims = config.mergeDuplicates
    ? mergeDuplicateClaims(claims)
    : claims;
  
  // Step 2: Score each claim
  const scoredClaims: ScoredClaim[] = deduplicatedClaims.map(claim => {
    const blastRadius = determineBlastRadius(claim, config.blastRadiusMapping);
    const severity = verdictToSeverity(claim.verdict);
    const confidence = calculateClaimConfidence(claim, evidence);
    const scoreContribution = calculateScoreContribution(claim, confidence, blastRadius, severity);
    
    // Determine fix location
    const fixLocation = claim.file
      ? { file: claim.file, line: claim.line }
      : undefined;
    
    const scored: ScoredClaim = {
      ...claim,
      confidence,
      blastRadius,
      severity,
      scoreContribution,
      explanation: '',
      fixLocation,
    };
    
    // Generate explanation
    scored.explanation = generateClaimExplanation(scored);
    
    return scored;
  });
  
  // Step 3: Deterministic ordering
  // Order by: severity (desc) -> blast radius (desc) -> verdict severity -> id
  scoredClaims.sort((a, b) => {
    // First by verdict severity
    const verdictOrder: ClaimVerdict[] = ['fail', 'not_proven', 'warn', 'skip', 'pass'];
    const aVerdictIdx = verdictOrder.indexOf(a.verdict);
    const bVerdictIdx = verdictOrder.indexOf(b.verdict);
    if (aVerdictIdx !== bVerdictIdx) {
      return aVerdictIdx - bVerdictIdx;
    }
    
    // Then by blast radius weight
    const aRadiusWeight = BLAST_RADIUS[a.blastRadius].weight;
    const bRadiusWeight = BLAST_RADIUS[b.blastRadius].weight;
    if (aRadiusWeight !== bRadiusWeight) {
      return bRadiusWeight - aRadiusWeight; // Descending
    }
    
    // Then by severity
    const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];
    const aSevIdx = severityOrder.indexOf(a.severity);
    const bSevIdx = severityOrder.indexOf(b.severity);
    if (aSevIdx !== bSevIdx) {
      return aSevIdx - bSevIdx;
    }
    
    // Finally by ID for stability
    return a.id.localeCompare(b.id);
  });
  
  // Step 4: Calculate overall score
  // Weighted average of score contributions
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const claim of scoredClaims) {
    const weight = BLAST_RADIUS[claim.blastRadius].weight;
    totalWeight += weight;
    weightedSum += claim.scoreContribution * weight;
  }
  
  const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  
  // Step 5: Calculate overall confidence
  const overallConfidence = scoredClaims.length > 0
    ? scoredClaims.reduce((sum, c) => sum + c.confidence, 0) / scoredClaims.length
    : 0;
  
  // Step 6: Check for critical failures in evidence
  const criticalFailures = findCriticalFailures(evidence);
  const hasCriticalFailure = criticalFailures.length > 0;
  
  // Step 7: Determine verdict
  let verdict: 'SHIP' | 'WARN' | 'NO_SHIP';
  if (hasCriticalFailure || overallConfidence < config.minConfidence) {
    verdict = 'NO_SHIP';
  } else if (overallScore >= config.thresholds.SHIP) {
    verdict = 'SHIP';
  } else if (overallScore >= config.thresholds.WARN) {
    verdict = 'WARN';
  } else {
    verdict = 'NO_SHIP';
  }
  
  // Step 8: Generate explanations
  const explanations = generateVerdictExplanations(
    scoredClaims,
    evidence,
    overallScore,
    overallConfidence,
    config
  );
  
  // Step 9: Generate blockers and recommendations
  const blockers: string[] = [];
  const recommendations: string[] = [];
  
  if (hasCriticalFailure) {
    blockers.push(...criticalFailures.map(e => `${e.check}: ${e.details}`));
  }
  
  const failedClaims = scoredClaims.filter(c => c.verdict === 'fail');
  for (const claim of failedClaims) {
    if (claim.fixLocation) {
      blockers.push(`${claim.id}: ${claim.explanation}`);
      recommendations.push(`Fix ${claim.type} "${claim.id}" in ${claim.fixLocation.file}${claim.fixLocation.line ? `:${claim.fixLocation.line}` : ''}`);
    } else {
      blockers.push(`${claim.id}: ${claim.explanation}`);
      recommendations.push(`Fix ${claim.type} "${claim.id}": ${claim.description || 'see explanation'}`);
    }
  }
  
  const warnedClaims = scoredClaims.filter(c => c.verdict === 'warn');
  for (const claim of warnedClaims) {
    recommendations.push(`Address warning in ${claim.type} "${claim.id}": ${claim.description || 'see explanation'}`);
  }
  
  // Step 10: Generate summary
  const summary = verdict === 'SHIP'
    ? `SHIP: Score ${overallScore.toFixed(1)}/100, confidence ${(overallConfidence * 100).toFixed(1)}%`
    : verdict === 'WARN'
    ? `WARN: Score ${overallScore.toFixed(1)}/100, ${failedClaims.length} failure(s), ${warnedClaims.length} warning(s)`
    : `NO_SHIP: Score ${overallScore.toFixed(1)}/100, ${failedClaims.length} failure(s), ${blockers.length} blocker(s)`;
  
  return {
    verdict,
    score: Math.round(overallScore),
    confidence: overallConfidence,
    scoredClaims,
    evidence,
    explanations,
    blockers,
    recommendations,
    summary,
  };
}
