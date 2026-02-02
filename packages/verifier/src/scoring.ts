// ============================================================================
// Deterministic Scoring - Compute verification score with SHIP/NO_SHIP rules
// ============================================================================

import type {
  ClauseResult,
  ClauseStatus,
  ScoreBreakdown,
  ShipVerdict,
  WorkspaceScanArtifacts,
} from './types';

/**
 * Scoring weights (must be deterministic and documented)
 */
export const SCORING_WEIGHTS = {
  /** Weight for precondition clauses (0-100 scale contribution) */
  preconditions: 0.20,
  /** Weight for postcondition clauses */
  postconditions: 0.30,
  /** Weight for invariant clauses */
  invariants: 0.15,
  /** Weight for security clauses */
  security: 0.20,
  /** Weight for binding completeness */
  bindings: 0.10,
  /** Weight for test coverage */
  testCoverage: 0.05,
} as const;

/**
 * Status scores (points per clause based on status)
 */
export const STATUS_SCORES: Record<ClauseStatus, number> = {
  PASS: 100,
  PARTIAL: 50,
  FAIL: 0,
  SKIPPED: 0,
};

/**
 * SHIP/NO_SHIP threshold (score required for SHIP verdict)
 * 70% is the stable MVP threshold - evidence scores can vary based on
 * test coverage, binding strength, and runtime assertion counts
 */
export const DEFAULT_SHIP_THRESHOLD = 70;

/**
 * NO_SHIP blocking rules
 */
export const NO_SHIP_RULES = {
  /** Any FAIL status on a security clause blocks SHIP */
  securityFailBlocks: true,
  /** Any FAIL status on a postcondition blocks SHIP */
  postconditionFailBlocks: true,
  /** Missing all bindings blocks SHIP */
  noBindingsBlocks: true,
  /** Zero test files blocks SHIP */
  noTestsBlocks: true,
} as const;

/**
 * Compute verification score from clause results
 * Returns deterministic score and breakdown
 */
export function computeScore(
  clauseResults: ClauseResult[],
  artifacts: WorkspaceScanArtifacts,
  shipThreshold: number = DEFAULT_SHIP_THRESHOLD
): {
  score: number;
  breakdown: ScoreBreakdown;
  verdict: ShipVerdict;
  blockingIssues: string[];
} {
  // Group clauses by type
  const byType = groupByClauseType(clauseResults);
  
  // Calculate component scores
  const preconditionScore = calculateComponentScore(byType.preconditions);
  const postconditionScore = calculateComponentScore(byType.postconditions);
  const invariantScore = calculateComponentScore(byType.invariants);
  const securityScore = calculateComponentScore(byType.security);
  const temporalScore = calculateComponentScore(byType.temporal);
  
  // Calculate binding score
  const bindingScore = calculateBindingScore(clauseResults, artifacts);
  
  // Calculate test coverage score
  const testCoverageScore = calculateTestCoverageScore(clauseResults, artifacts);
  
  // Compute weighted total
  const weightedTotal = 
    preconditionScore * SCORING_WEIGHTS.preconditions +
    postconditionScore * SCORING_WEIGHTS.postconditions +
    invariantScore * SCORING_WEIGHTS.invariants +
    securityScore * SCORING_WEIGHTS.security +
    bindingScore * SCORING_WEIGHTS.bindings +
    testCoverageScore * SCORING_WEIGHTS.testCoverage;
  
  // Round to integer for stability
  const score = Math.round(weightedTotal);
  
  // Build breakdown
  const breakdown: ScoreBreakdown = {
    total: score,
    preconditions: Math.round(preconditionScore),
    postconditions: Math.round(postconditionScore),
    invariants: Math.round(invariantScore),
    security: Math.round(securityScore),
    bindings: Math.round(bindingScore),
    testCoverage: Math.round(testCoverageScore),
  };
  
  // Check blocking issues
  const blockingIssues = checkBlockingIssues(clauseResults, artifacts, byType);
  
  // Determine verdict
  const verdict = determineVerdict(score, blockingIssues, shipThreshold);
  
  return { score, breakdown, verdict, blockingIssues };
}

/**
 * Group clause results by type
 */
function groupByClauseType(results: ClauseResult[]): {
  preconditions: ClauseResult[];
  postconditions: ClauseResult[];
  invariants: ClauseResult[];
  security: ClauseResult[];
  temporal: ClauseResult[];
} {
  return {
    preconditions: results.filter(r => r.clauseType === 'precondition'),
    postconditions: results.filter(r => r.clauseType === 'postcondition'),
    invariants: results.filter(r => r.clauseType === 'invariant'),
    security: results.filter(r => r.clauseType === 'security'),
    temporal: results.filter(r => r.clauseType === 'temporal'),
  };
}

/**
 * Calculate score for a component (group of clauses)
 */
function calculateComponentScore(clauses: ClauseResult[]): number {
  if (clauses.length === 0) {
    // No clauses = 100% (nothing to verify)
    return 100;
  }
  
  let totalPoints = 0;
  for (const clause of clauses) {
    totalPoints += STATUS_SCORES[clause.status];
  }
  
  return totalPoints / clauses.length;
}

/**
 * Calculate binding completeness score
 */
function calculateBindingScore(
  results: ClauseResult[],
  artifacts: WorkspaceScanArtifacts
): number {
  if (results.length === 0) {
    return artifacts.bindings.length > 0 ? 100 : 0;
  }
  
  // Count clauses with binding evidence
  let withBinding = 0;
  let withoutBinding = 0;
  
  for (const result of results) {
    const hasBinding = result.evidence.some(e => e.kind === 'binding_found');
    const hasMissing = result.evidence.some(e => e.kind === 'binding_missing');
    
    if (hasBinding) {
      withBinding++;
    } else if (hasMissing) {
      withoutBinding++;
    }
  }
  
  const total = withBinding + withoutBinding;
  if (total === 0) {
    return artifacts.bindings.length > 0 ? 75 : 25;
  }
  
  return (withBinding / total) * 100;
}

/**
 * Calculate test coverage score
 */
function calculateTestCoverageScore(
  results: ClauseResult[],
  artifacts: WorkspaceScanArtifacts
): number {
  // Base score from test file presence
  if (artifacts.testFiles.length === 0) {
    return 0;
  }
  
  // Count assertions in evidence
  let assertionsCovered = 0;
  let totalClauses = results.length;
  
  for (const result of results) {
    const hasAssertion = result.evidence.some(
      e => e.kind === 'test_assertion' || 
           e.kind === 'assertion_pass' ||
           e.kind === 'assertion_fail'
    );
    if (hasAssertion) {
      assertionsCovered++;
    }
  }
  
  if (totalClauses === 0) {
    return artifacts.assertions.length > 0 ? 75 : 50;
  }
  
  // Score based on assertion coverage
  const coverageRatio = assertionsCovered / totalClauses;
  return coverageRatio * 100;
}

/**
 * Check for blocking issues that prevent SHIP
 */
function checkBlockingIssues(
  results: ClauseResult[],
  artifacts: WorkspaceScanArtifacts,
  byType: {
    security: ClauseResult[];
    postconditions: ClauseResult[];
  }
): string[] {
  const issues: string[] = [];
  
  // Security FAIL blocks
  if (NO_SHIP_RULES.securityFailBlocks) {
    const failedSecurity = byType.security.filter(r => r.status === 'FAIL');
    if (failedSecurity.length > 0) {
      issues.push(`SECURITY_FAIL: ${failedSecurity.length} security clause(s) failed`);
    }
  }
  
  // Postcondition FAIL blocks
  if (NO_SHIP_RULES.postconditionFailBlocks) {
    const failedPost = byType.postconditions.filter(r => r.status === 'FAIL');
    if (failedPost.length > 0) {
      issues.push(`POSTCONDITION_FAIL: ${failedPost.length} postcondition(s) failed`);
    }
  }
  
  // No bindings blocks
  if (NO_SHIP_RULES.noBindingsBlocks) {
    const allMissing = results.every(r => 
      r.evidence.some(e => e.kind === 'binding_missing') &&
      !r.evidence.some(e => e.kind === 'binding_found')
    );
    if (allMissing && results.length > 0) {
      issues.push('NO_BINDINGS: No implementation bindings found');
    }
  }
  
  // No tests blocks
  if (NO_SHIP_RULES.noTestsBlocks) {
    if (artifacts.testFiles.length === 0) {
      issues.push('NO_TESTS: No test files detected');
    }
  }
  
  // Sort for deterministic output
  return issues.sort();
}

/**
 * Determine SHIP/NO_SHIP verdict
 */
function determineVerdict(
  score: number,
  blockingIssues: string[],
  threshold: number
): ShipVerdict {
  // Blocking issues always result in NO_SHIP
  if (blockingIssues.length > 0) {
    return 'NO_SHIP';
  }
  
  // Score below threshold is NO_SHIP
  if (score < threshold) {
    return 'NO_SHIP';
  }
  
  return 'SHIP';
}

// ============================================================================
// SCORE UTILITIES
// ============================================================================

/**
 * Get human-readable explanation of score
 */
export function explainScore(
  score: number,
  breakdown: ScoreBreakdown,
  verdict: ShipVerdict,
  blockingIssues: string[]
): string {
  const lines: string[] = [];
  
  lines.push(`Score: ${score}/100`);
  lines.push(`Verdict: ${verdict}`);
  lines.push('');
  lines.push('Breakdown:');
  lines.push(`  Preconditions: ${breakdown.preconditions}/100 (weight: ${SCORING_WEIGHTS.preconditions * 100}%)`);
  lines.push(`  Postconditions: ${breakdown.postconditions}/100 (weight: ${SCORING_WEIGHTS.postconditions * 100}%)`);
  lines.push(`  Invariants: ${breakdown.invariants}/100 (weight: ${SCORING_WEIGHTS.invariants * 100}%)`);
  lines.push(`  Security: ${breakdown.security}/100 (weight: ${SCORING_WEIGHTS.security * 100}%)`);
  lines.push(`  Bindings: ${breakdown.bindings}/100 (weight: ${SCORING_WEIGHTS.bindings * 100}%)`);
  lines.push(`  Test Coverage: ${breakdown.testCoverage}/100 (weight: ${SCORING_WEIGHTS.testCoverage * 100}%)`);
  
  if (blockingIssues.length > 0) {
    lines.push('');
    lines.push('Blocking Issues:');
    for (const issue of blockingIssues) {
      lines.push(`  - ${issue}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format score as compact string
 */
export function formatScoreCompact(
  score: number,
  verdict: ShipVerdict
): string {
  const icon = verdict === 'SHIP' ? '✓' : '✗';
  return `${icon} ${score}/100 [${verdict}]`;
}
