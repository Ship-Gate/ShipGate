/**
 * Signal Aggregator
 * 
 * Collects and aggregates all verification signals into a unified view.
 * Deterministic: same inputs always produce same outputs.
 * 
 * @module @isl-lang/gate/authoritative/aggregator
 */

import type {
  VerificationSignal,
  SignalSource,
  SignalFinding,
  AggregatedSignals,
} from './types.js';

// ============================================================================
// Signal Collection
// ============================================================================

/**
 * Create a new signal
 */
export function createSignal(
  source: SignalSource,
  passed: boolean,
  summary: string,
  options: {
    score?: number;
    weight?: number;
    findings?: SignalFinding[];
    blocking?: boolean;
    durationMs?: number;
  } = {}
): VerificationSignal {
  return {
    source,
    passed,
    summary,
    score: options.score,
    weight: options.weight ?? 1,
    findings: options.findings ?? [],
    blocking: options.blocking ?? false,
    durationMs: options.durationMs,
  };
}

/**
 * Create a blocking signal (failure blocks SHIP)
 */
export function createBlockingSignal(
  source: SignalSource,
  passed: boolean,
  summary: string,
  options: Omit<Parameters<typeof createSignal>[3], 'blocking'> = {}
): VerificationSignal {
  return createSignal(source, passed, summary, { ...options, blocking: true });
}

/**
 * Create a finding
 */
export function createFinding(
  id: string,
  severity: SignalFinding['severity'],
  message: string,
  options: {
    file?: string;
    line?: number;
    blocking?: boolean;
  } = {}
): SignalFinding {
  return {
    id,
    severity,
    message,
    file: options.file,
    line: options.line,
    blocking: options.blocking ?? (severity === 'critical'),
  };
}

// ============================================================================
// Signal Aggregation
// ============================================================================

/**
 * Aggregate multiple signals into a unified result
 */
export function aggregateSignals(signals: VerificationSignal[]): AggregatedSignals {
  // Calculate weighted overall score
  const overallScore = calculateWeightedScore(signals);
  
  // Aggregate test results
  const tests = aggregateTests(signals);
  
  // Aggregate findings
  const findings = aggregateFindings(signals);
  
  // Collect blocking issues
  const blockingIssues = collectBlockingIssues(signals);
  
  // Get coverage if available
  const coverageSignal = signals.find(s => s.source === 'coverage');
  const coverage = coverageSignal?.score;
  
  return {
    signals,
    overallScore,
    tests,
    findings,
    coverage,
    blockingIssues,
  };
}

/**
 * Calculate weighted average score from signals
 */
function calculateWeightedScore(signals: VerificationSignal[]): number {
  const signalsWithScores = signals.filter(s => s.score !== undefined);
  
  if (signalsWithScores.length === 0) {
    // No scores - use pass rate
    const passedCount = signals.filter(s => s.passed).length;
    return signals.length > 0 
      ? Math.round((passedCount / signals.length) * 100) 
      : 0;
  }
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const signal of signalsWithScores) {
    const weight = signal.weight ?? 1;
    totalWeight += weight;
    weightedSum += (signal.score ?? 0) * weight;
  }
  
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Aggregate test results from test runner signals
 */
function aggregateTests(signals: VerificationSignal[]): AggregatedSignals['tests'] {
  const testSignals = signals.filter(s => s.source === 'test_runner');
  
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const signal of testSignals) {
    // Extract counts from findings metadata or signal summary
    const findings = signal.findings ?? [];
    
    for (const finding of findings) {
      total++;
      if (finding.severity === 'low' && finding.message.includes('passed')) {
        passed++;
      } else if (finding.severity === 'critical' || finding.severity === 'high') {
        failed++;
      } else if (finding.message.includes('skipped')) {
        skipped++;
      } else {
        passed++; // Default to passed if unclear
      }
    }
    
    // If no findings, use signal pass state
    if (findings.length === 0) {
      total++;
      if (signal.passed) {
        passed++;
      } else {
        failed++;
      }
    }
  }
  
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 100;
  
  return { total, passed, failed, skipped, passRate };
}

/**
 * Aggregate findings by severity
 */
function aggregateFindings(signals: VerificationSignal[]): AggregatedSignals['findings'] {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0,
  };
  
  for (const signal of signals) {
    for (const finding of signal.findings ?? []) {
      counts[finding.severity]++;
      counts.total++;
    }
  }
  
  return counts;
}

/**
 * Collect all blocking issues from signals
 */
function collectBlockingIssues(signals: VerificationSignal[]): string[] {
  const issues: string[] = [];
  
  for (const signal of signals) {
    // Signal-level blocking
    if (signal.blocking && !signal.passed) {
      issues.push(`[${signal.source}] ${signal.summary}`);
    }
    
    // Finding-level blocking
    for (const finding of signal.findings ?? []) {
      if (finding.blocking) {
        const location = finding.file 
          ? `${finding.file}${finding.line ? `:${finding.line}` : ''}: `
          : '';
        issues.push(`[${signal.source}] ${location}${finding.message}`);
      }
    }
  }
  
  // Sort for deterministic output
  return issues.sort();
}

// ============================================================================
// Signal Helpers
// ============================================================================

/**
 * Check if any signal has critical blocking issues
 */
export function hasBlockingIssues(signals: VerificationSignal[]): boolean {
  return signals.some(s => 
    (s.blocking && !s.passed) ||
    (s.findings ?? []).some(f => f.blocking)
  );
}

/**
 * Get all failed signals
 */
export function getFailedSignals(signals: VerificationSignal[]): VerificationSignal[] {
  return signals.filter(s => !s.passed);
}

/**
 * Get all blocking signals that failed
 */
export function getBlockingFailures(signals: VerificationSignal[]): VerificationSignal[] {
  return signals.filter(s => s.blocking && !s.passed);
}

/**
 * Count findings by severity
 */
export function countBySeverity(
  signals: VerificationSignal[]
): Record<SignalFinding['severity'], number> {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  
  for (const signal of signals) {
    for (const finding of signal.findings ?? []) {
      counts[finding.severity]++;
    }
  }
  
  return counts;
}
