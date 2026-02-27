/**
 * Decision Engine
 * 
 * The authoritative decision maker. SHIP or NO_SHIP, nothing else.
 * 
 * Decision Algorithm:
 * 1. Check for ANY blocking issues -> NO_SHIP
 * 2. Check for critical findings -> NO_SHIP  
 * 3. Check score against threshold -> NO_SHIP if below
 * 4. Check test pass rate -> NO_SHIP if below
 * 5. Check high findings count -> NO_SHIP if exceeded
 * 6. All checks pass -> SHIP
 * 
 * @module @isl-lang/gate/authoritative/decision-engine
 */

import type {
  AuthoritativeVerdict,
  AggregatedSignals,
  ThresholdConfig,
  VerdictReason,
  SignalSource,
} from './types.js';

import { DEFAULT_THRESHOLDS, EXIT_CODES } from './types.js';

// ============================================================================
// Decision Result
// ============================================================================

export interface DecisionResult {
  verdict: AuthoritativeVerdict;
  exitCode: 0 | 1;
  confidence: number;
  reasons: VerdictReason[];
  summary: string;
}

// ============================================================================
// Main Decision Function
// ============================================================================

/**
 * Make the authoritative SHIP/NO_SHIP decision.
 * 
 * This function is deterministic: same inputs always produce same output.
 * The decision is FINAL - no appeals, no intermediate states.
 */
export function makeDecision(
  aggregation: AggregatedSignals,
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): DecisionResult {
  const reasons: VerdictReason[] = [];
  let verdict: AuthoritativeVerdict = 'SHIP';
  
  // ========================================================================
  // Check 1: Blocking Issues (HIGHEST PRIORITY)
  // ========================================================================
  if (aggregation.blockingIssues.length > 0) {
    verdict = 'NO_SHIP';
    reasons.push({
      code: 'BLOCKING_ISSUES',
      message: `${aggregation.blockingIssues.length} blocking issue(s) detected`,
      severity: 'critical',
      source: 'verifier',
      blocking: true,
    });
    
    // Add individual blocking issues
    for (const issue of aggregation.blockingIssues.slice(0, 5)) {
      const source = extractSource(issue);
      reasons.push({
        code: 'BLOCKER',
        message: issue,
        severity: 'critical',
        source,
        blocking: true,
      });
    }
    
    if (aggregation.blockingIssues.length > 5) {
      reasons.push({
        code: 'MORE_BLOCKERS',
        message: `... and ${aggregation.blockingIssues.length - 5} more blocking issues`,
        severity: 'critical',
        source: 'verifier',
        blocking: true,
      });
    }
  }
  
  // ========================================================================
  // Check 2: Critical Findings
  // ========================================================================
  if (aggregation.findings.critical > thresholds.maxCriticalFindings) {
    verdict = 'NO_SHIP';
    reasons.push({
      code: 'CRITICAL_FINDINGS',
      message: `${aggregation.findings.critical} critical finding(s) exceed threshold (max: ${thresholds.maxCriticalFindings})`,
      severity: 'critical',
      source: 'static_analysis',
      blocking: true,
    });
  }
  
  // ========================================================================
  // Check 3: High Findings
  // ========================================================================
  if (aggregation.findings.high > thresholds.maxHighFindings) {
    verdict = 'NO_SHIP';
    reasons.push({
      code: 'HIGH_FINDINGS',
      message: `${aggregation.findings.high} high-severity finding(s) exceed threshold (max: ${thresholds.maxHighFindings})`,
      severity: 'high',
      source: 'static_analysis',
      blocking: true,
    });
  }
  
  // ========================================================================
  // Check 4: Overall Score
  // ========================================================================
  if (aggregation.overallScore < thresholds.minScore) {
    verdict = 'NO_SHIP';
    reasons.push({
      code: 'SCORE_BELOW_THRESHOLD',
      message: `Score ${aggregation.overallScore} is below minimum threshold ${thresholds.minScore}`,
      severity: 'high',
      source: 'verifier',
      blocking: true,
    });
  }
  
  // ========================================================================
  // Check 5: Test Pass Rate
  // ========================================================================
  if (aggregation.tests.total > 0) {
    if (aggregation.tests.passRate < thresholds.minTestPassRate) {
      verdict = 'NO_SHIP';
      reasons.push({
        code: 'TEST_PASS_RATE_BELOW_THRESHOLD',
        message: `Test pass rate ${aggregation.tests.passRate}% is below minimum ${thresholds.minTestPassRate}%`,
        severity: 'critical',
        source: 'test_runner',
        blocking: true,
      });
    }
    
    if (aggregation.tests.failed > 0) {
      verdict = 'NO_SHIP';
      reasons.push({
        code: 'TESTS_FAILED',
        message: `${aggregation.tests.failed} test(s) failed`,
        severity: 'critical',
        source: 'test_runner',
        blocking: true,
      });
    }
    
    if (!thresholds.allowSkipped && aggregation.tests.skipped > 0) {
      verdict = 'NO_SHIP';
      reasons.push({
        code: 'TESTS_SKIPPED',
        message: `${aggregation.tests.skipped} test(s) skipped (not allowed)`,
        severity: 'high',
        source: 'test_runner',
        blocking: true,
      });
    }
  }
  
  // ========================================================================
  // Check 6: Coverage (if available)
  // ========================================================================
  if (aggregation.coverage !== undefined && aggregation.coverage < thresholds.minCoverage) {
    verdict = 'NO_SHIP';
    reasons.push({
      code: 'COVERAGE_BELOW_THRESHOLD',
      message: `Coverage ${aggregation.coverage}% is below minimum ${thresholds.minCoverage}%`,
      severity: 'high',
      source: 'coverage',
      blocking: true,
    });
  }
  
  // ========================================================================
  // Check 7: Any Failed Blocking Signals
  // ========================================================================
  const failedBlockingSignals = aggregation.signals.filter(s => s.blocking && !s.passed);
  for (const signal of failedBlockingSignals) {
    if (!reasons.some(r => r.source === signal.source && r.code === 'SIGNAL_FAILED')) {
      verdict = 'NO_SHIP';
      reasons.push({
        code: 'SIGNAL_FAILED',
        message: `${signal.source}: ${signal.summary}`,
        severity: 'critical',
        source: signal.source,
        blocking: true,
      });
    }
  }
  
  // ========================================================================
  // Success Case
  // ========================================================================
  if (verdict === 'SHIP') {
    reasons.push({
      code: 'ALL_CHECKS_PASSED',
      message: 'All verification checks passed',
      severity: 'info',
      source: 'verifier',
      blocking: false,
    });
    
    if (aggregation.tests.total > 0) {
      reasons.push({
        code: 'TESTS_PASSED',
        message: `${aggregation.tests.passed}/${aggregation.tests.total} tests passed`,
        severity: 'info',
        source: 'test_runner',
        blocking: false,
      });
    }
  }
  
  // Calculate confidence
  const confidence = calculateConfidence(aggregation, verdict);
  
  // Generate summary
  const summary = generateSummary(verdict, aggregation, reasons);
  
  return {
    verdict,
    exitCode: verdict === 'SHIP' ? EXIT_CODES.SHIP : EXIT_CODES.NO_SHIP,
    confidence,
    reasons: sortReasons(reasons),
    summary,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract signal source from issue string
 */
function extractSource(issue: string): SignalSource {
  const match = issue.match(/^\[(\w+)\]/);
  if (match) {
    const source = match[1].toLowerCase();
    const validSources: SignalSource[] = [
      'parser', 'typechecker', 'verifier', 'test_runner', 'coverage',
      'static_analysis', 'security_scan', 'hallucination_scan',
      'contract_check', 'env_validation'
    ];
    if (validSources.includes(source as SignalSource)) {
      return source as SignalSource;
    }
  }
  return 'verifier';
}

/**
 * Calculate confidence in the decision
 */
function calculateConfidence(
  aggregation: AggregatedSignals,
  verdict: AuthoritativeVerdict
): number {
  let confidence = 100;
  
  // Reduce confidence if fewer signals
  const signalCount = aggregation.signals.length;
  if (signalCount < 3) {
    confidence -= (3 - signalCount) * 10;
  }
  
  // Reduce confidence if score is borderline (within 10 points of threshold)
  if (verdict === 'SHIP' && aggregation.overallScore < 90) {
    confidence -= Math.round((90 - aggregation.overallScore) / 2);
  }
  
  // Reduce confidence if there are medium findings
  if (aggregation.findings.medium > 5) {
    confidence -= Math.min(15, aggregation.findings.medium);
  }
  
  // For NO_SHIP with many blocking issues, confidence is high
  if (verdict === 'NO_SHIP' && aggregation.blockingIssues.length > 3) {
    confidence = Math.min(100, confidence + 10);
  }
  
  return Math.max(50, Math.min(100, confidence));
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  verdict: AuthoritativeVerdict,
  aggregation: AggregatedSignals,
  reasons: VerdictReason[]
): string {
  const blockingReasons = reasons.filter(r => r.blocking);
  
  if (verdict === 'SHIP') {
    const parts = [`SHIP: Score ${aggregation.overallScore}/100`];
    
    if (aggregation.tests.total > 0) {
      parts.push(`${aggregation.tests.passed}/${aggregation.tests.total} tests passed`);
    }
    
    if (aggregation.coverage !== undefined) {
      parts.push(`${aggregation.coverage}% coverage`);
    }
    
    return parts.join(', ');
  }
  
  // NO_SHIP summary
  const topIssue = blockingReasons[0]?.message ?? 'Verification failed';
  const issueCount = blockingReasons.length;
  
  if (issueCount === 1) {
    return `NO_SHIP: ${topIssue}`;
  }
  
  return `NO_SHIP: ${topIssue} (+${issueCount - 1} more issue${issueCount > 2 ? 's' : ''})`;
}

/**
 * Sort reasons: blocking first, then by severity, then alphabetically
 */
function sortReasons(reasons: VerdictReason[]): VerdictReason[] {
  const severityOrder = { critical: 0, high: 1, medium: 2, info: 3 };
  
  return [...reasons].sort((a, b) => {
    // Blocking first
    if (a.blocking !== b.blocking) {
      return a.blocking ? -1 : 1;
    }
    // Then by severity
    const aSev = severityOrder[a.severity] ?? 4;
    const bSev = severityOrder[b.severity] ?? 4;
    if (aSev !== bSev) {
      return aSev - bSev;
    }
    // Then alphabetically
    return a.code.localeCompare(b.code);
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if decision would be SHIP with given aggregation and thresholds
 */
export function wouldShip(
  aggregation: AggregatedSignals,
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): boolean {
  return makeDecision(aggregation, thresholds).verdict === 'SHIP';
}

/**
 * Get minimum score needed to SHIP
 */
export function getMinScoreToShip(thresholds: ThresholdConfig = DEFAULT_THRESHOLDS): number {
  return thresholds.minScore;
}

/**
 * Get suggestions for improving to SHIP
 */
export function getSuggestions(
  aggregation: AggregatedSignals,
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): string[] {
  const suggestions: string[] = [];
  
  if (aggregation.blockingIssues.length > 0) {
    suggestions.push(`Fix ${aggregation.blockingIssues.length} blocking issue(s)`);
  }
  
  if (aggregation.findings.critical > thresholds.maxCriticalFindings) {
    suggestions.push(`Resolve ${aggregation.findings.critical} critical finding(s)`);
  }
  
  if (aggregation.findings.high > thresholds.maxHighFindings) {
    const excess = aggregation.findings.high - thresholds.maxHighFindings;
    suggestions.push(`Resolve at least ${excess} high-severity finding(s)`);
  }
  
  if (aggregation.overallScore < thresholds.minScore) {
    const needed = thresholds.minScore - aggregation.overallScore;
    suggestions.push(`Improve score by ${needed} points (current: ${aggregation.overallScore}, needed: ${thresholds.minScore})`);
  }
  
  if (aggregation.tests.failed > 0) {
    suggestions.push(`Fix ${aggregation.tests.failed} failing test(s)`);
  }
  
  if (!thresholds.allowSkipped && aggregation.tests.skipped > 0) {
    suggestions.push(`Implement ${aggregation.tests.skipped} skipped test(s) or enable allowSkipped`);
  }
  
  if (aggregation.coverage !== undefined && aggregation.coverage < thresholds.minCoverage) {
    const needed = thresholds.minCoverage - aggregation.coverage;
    suggestions.push(`Increase coverage by ${needed}% (current: ${aggregation.coverage}%, needed: ${thresholds.minCoverage}%)`);
  }
  
  return suggestions;
}
