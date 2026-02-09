// ============================================================================
// Verification Integration - Wire PBT into verify and gate
// ============================================================================
//
// This module integrates PBT results into the ISL verification pipeline:
// 1. PBT failures block SHIP in the gate
// 2. Counterexamples are included in verification reports
// 3. PBT results contribute to trust score calculation
//
// Usage:
//   import { createPBTGateIntegration } from '@isl-lang/pbt';
//   const pbtResult = await runPBT(...);
//   const gateInput = createPBTGateInput(pbtResult);
// ============================================================================

import type { PBTReport, PBTStats, PropertyViolation, PBTJsonReport } from './types.js';
import {
  Counterexample,
  buildCounterexample,
  formatCounterexample,
  counterexampleRegistry,
} from './counterexample.js';

// ============================================================================
// GATE INTEGRATION TYPES
// ============================================================================

/**
 * PBT finding for gate integration
 * Compatible with isl-gate Finding interface
 */
export interface PBTFinding {
  id: string;
  type: 'pbt_violation' | 'pbt_postcondition' | 'pbt_invariant' | 'pbt_precondition';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  file?: string;
  line?: number;
  rule: string;
  autoFixable: boolean;
  suggestion?: string;
  counterexample?: Counterexample;
}

/**
 * PBT blockers for gate integration
 * Compatible with isl-gate CriticalBlockers interface
 */
export interface PBTBlockers {
  /** Number of postcondition violations */
  postconditionViolations: number;
  /** Number of invariant violations */
  invariantViolations: number;
  /** Number of behaviors with failures */
  failedBehaviors: number;
  /** Custom blocker reasons */
  customBlockers: string[];
}

/**
 * Complete PBT gate input
 */
export interface PBTGateInput {
  findings: PBTFinding[];
  blockers: PBTBlockers;
  filesConsidered: number;
  filesScanned: number;
  pbtMetrics: PBTMetrics;
}

/**
 * PBT metrics for trust score contribution
 */
export interface PBTMetrics {
  /** Total properties tested */
  totalProperties: number;
  /** Properties that passed */
  passedProperties: number;
  /** Total test iterations */
  totalIterations: number;
  /** Successful iterations */
  successfulIterations: number;
  /** Coverage ratio (0-1) */
  coverageRatio: number;
  /** Average shrink reduction */
  avgShrinkReduction: number;
  /** Seed for reproduction */
  seed?: number;
}

// ============================================================================
// GATE INPUT CREATION
// ============================================================================

/**
 * Create gate input from PBT report
 * This converts PBT results into a format the gate can consume
 */
export function createPBTGateInput(report: PBTReport): PBTGateInput {
  const findings = createFindings(report);
  const blockers = createBlockers(report);
  const metrics = createMetrics(report);

  return {
    findings,
    blockers,
    filesConsidered: 1, // Single behavior
    filesScanned: 1,
    pbtMetrics: metrics,
  };
}

/**
 * Create gate input from multiple PBT reports
 */
export function createPBTGateInputBatch(reports: PBTReport[]): PBTGateInput {
  const allFindings: PBTFinding[] = [];
  const allBlockers: PBTBlockers = {
    postconditionViolations: 0,
    invariantViolations: 0,
    failedBehaviors: 0,
    customBlockers: [],
  };

  let totalProperties = 0;
  let passedProperties = 0;
  let totalIterations = 0;
  let successfulIterations = 0;
  let totalShrinkReduction = 0;
  let shrinkCount = 0;

  for (const report of reports) {
    const input = createPBTGateInput(report);
    allFindings.push(...input.findings);

    allBlockers.postconditionViolations += input.blockers.postconditionViolations;
    allBlockers.invariantViolations += input.blockers.invariantViolations;
    allBlockers.failedBehaviors += input.blockers.failedBehaviors;
    allBlockers.customBlockers.push(...input.blockers.customBlockers);

    totalProperties += input.pbtMetrics.totalProperties;
    passedProperties += input.pbtMetrics.passedProperties;
    totalIterations += input.pbtMetrics.totalIterations;
    successfulIterations += input.pbtMetrics.successfulIterations;

    if (input.pbtMetrics.avgShrinkReduction > 0) {
      totalShrinkReduction += input.pbtMetrics.avgShrinkReduction;
      shrinkCount++;
    }
  }

  return {
    findings: allFindings,
    blockers: allBlockers,
    filesConsidered: reports.length,
    filesScanned: reports.length,
    pbtMetrics: {
      totalProperties,
      passedProperties,
      totalIterations,
      successfulIterations,
      coverageRatio: totalProperties > 0 ? passedProperties / totalProperties : 0,
      avgShrinkReduction: shrinkCount > 0 ? totalShrinkReduction / shrinkCount : 0,
      seed: reports[0]?.config.seed,
    },
  };
}

function createFindings(report: PBTReport): PBTFinding[] {
  const findings: PBTFinding[] = [];

  for (const violation of report.violations) {
    const finding = createFindingFromViolation(violation, report);
    findings.push(finding);
  }

  return findings;
}

function createFindingFromViolation(violation: PropertyViolation, report: PBTReport): PBTFinding {
  const id = `pbt-${report.behaviorName}-${violation.property.name}-${Date.now()}`;

  // Determine severity based on property type
  let severity: PBTFinding['severity'] = 'high';
  if (violation.property.type === 'invariant') {
    severity = 'critical'; // Invariant violations are critical
  } else if (violation.property.type === 'precondition') {
    severity = 'medium'; // Precondition violations are less severe
  }

  // Determine type
  let type: PBTFinding['type'] = 'pbt_violation';
  if (violation.property.type === 'postcondition') {
    type = 'pbt_postcondition';
  } else if (violation.property.type === 'invariant') {
    type = 'pbt_invariant';
  } else if (violation.property.type === 'precondition') {
    type = 'pbt_precondition';
  }

  // Build counterexample if available
  let counterexample: Counterexample | undefined;
  if (report.shrinkResult && report.firstFailure) {
    counterexample = buildCounterexample(
      violation.input,
      violation.minimalInput ?? violation.input,
      report.config.seed ?? 0,
      report.firstFailure.size,
      violation.property,
      violation.error,
      report.shrinkResult,
      report.behaviorName
    );
    counterexampleRegistry.add(counterexample);
  }

  return {
    id,
    type,
    severity,
    message: `PBT ${violation.property.type} violation in ${report.behaviorName}: ${violation.property.name}`,
    rule: `pbt/${violation.property.type}`,
    autoFixable: false,
    suggestion: counterexample
      ? `Reproduce with: ${counterexample.reproductionCommand}`
      : undefined,
    counterexample,
  };
}

function createBlockers(report: PBTReport): PBTBlockers {
  const blockers: PBTBlockers = {
    postconditionViolations: 0,
    invariantViolations: 0,
    failedBehaviors: 0,
    customBlockers: [],
  };

  for (const violation of report.violations) {
    if (violation.property.type === 'postcondition') {
      blockers.postconditionViolations++;
    } else if (violation.property.type === 'invariant') {
      blockers.invariantViolations++;
    }
  }

  if (!report.success) {
    blockers.failedBehaviors = 1;
    blockers.customBlockers.push(
      `PBT failure in ${report.behaviorName}: ${report.violations.length} violation(s)`
    );
  }

  return blockers;
}

function createMetrics(report: PBTReport): PBTMetrics {
  const totalProperties = 
    report.violations.length + 
    (report.success ? 1 : 0); // Simplified - actual would count all properties

  return {
    totalProperties,
    passedProperties: report.success ? totalProperties : 0,
    totalIterations: report.testsRun,
    successfulIterations: report.testsPassed,
    coverageRatio: report.testsRun > 0 ? report.testsPassed / report.testsRun : 0,
    avgShrinkReduction: report.shrinkResult
      ? calculateShrinkReduction(report.shrinkResult.original, report.shrinkResult.minimal)
      : 0,
    seed: report.config.seed,
  };
}

function calculateShrinkReduction(
  original: Record<string, unknown>,
  minimal: Record<string, unknown>
): number {
  const originalSize = JSON.stringify(original).length;
  const minimalSize = JSON.stringify(minimal).length;
  return originalSize > 0 ? 1 - (minimalSize / originalSize) : 0;
}

// ============================================================================
// VERIFICATION RESULT INTEGRATION
// ============================================================================

/**
 * PBT contribution to trust score
 */
export interface PBTTrustContribution {
  /** Score contribution (0-100) */
  score: number;
  /** Weight in overall trust score */
  weight: number;
  /** Confidence in the score (0-100) */
  confidence: number;
  /** Breakdown by category */
  breakdown: {
    postconditions: { passed: number; failed: number; score: number };
    invariants: { passed: number; failed: number; score: number };
    iterations: { total: number; passed: number; score: number };
  };
}

/**
 * Calculate PBT contribution to trust score
 */
export function calculatePBTTrustContribution(report: PBTReport): PBTTrustContribution {
  const stats = report.stats;

  // Count violations by type
  let postconditionsPassed = 0;
  let postconditionsFailed = 0;
  let invariantsPassed = 0;
  let invariantsFailed = 0;

  for (const violation of report.violations) {
    if (violation.property.type === 'postcondition') {
      postconditionsFailed++;
    } else if (violation.property.type === 'invariant') {
      invariantsFailed++;
    }
  }

  // If no failures, assume all passed
  if (report.success) {
    postconditionsPassed = 1;
    invariantsPassed = 1;
  }

  // Calculate subscores
  const postconditionsTotal = postconditionsPassed + postconditionsFailed;
  const postconditionsScore = postconditionsTotal > 0
    ? (postconditionsPassed / postconditionsTotal) * 100
    : 100;

  const invariantsTotal = invariantsPassed + invariantsFailed;
  const invariantsScore = invariantsTotal > 0
    ? (invariantsPassed / invariantsTotal) * 100
    : 100;

  const iterationsScore = stats.iterations > 0
    ? (stats.successes / stats.iterations) * 100
    : 100;

  // Weighted overall score
  // Postconditions: 40%, Invariants: 40%, Iterations: 20%
  const overallScore = Math.round(
    postconditionsScore * 0.4 +
    invariantsScore * 0.4 +
    iterationsScore * 0.2
  );

  // Confidence based on number of iterations
  const confidence = Math.min(100, Math.round((stats.iterations / 100) * 100));

  return {
    score: overallScore,
    weight: 20, // PBT contributes 20% to overall trust score
    confidence,
    breakdown: {
      postconditions: {
        passed: postconditionsPassed,
        failed: postconditionsFailed,
        score: Math.round(postconditionsScore),
      },
      invariants: {
        passed: invariantsPassed,
        failed: invariantsFailed,
        score: Math.round(invariantsScore),
      },
      iterations: {
        total: stats.iterations,
        passed: stats.successes,
        score: Math.round(iterationsScore),
      },
    },
  };
}

// ============================================================================
// SHIP DECISION
// ============================================================================

/**
 * Check if PBT results should block SHIP
 */
export function shouldBlockShip(report: PBTReport): boolean {
  // Any failure blocks SHIP
  if (!report.success) {
    return true;
  }

  // Any violation blocks SHIP
  if (report.violations.length > 0) {
    return true;
  }

  // Invariant violations always block SHIP
  for (const violation of report.violations) {
    if (violation.property.type === 'invariant') {
      return true;
    }
  }

  return false;
}

/**
 * Get reasons for blocking SHIP
 */
export function getBlockReasons(report: PBTReport): string[] {
  const reasons: string[] = [];

  if (!report.success) {
    reasons.push(`PBT tests failed: ${report.testsPassed}/${report.testsRun} passed`);
  }

  for (const violation of report.violations) {
    reasons.push(
      `${violation.property.type} violation: ${violation.property.name} - ${violation.error}`
    );
  }

  if (report.shrinkResult && report.violations.length > 0) {
    const reduction = calculateShrinkReduction(
      report.shrinkResult.original,
      report.shrinkResult.minimal
    );
    reasons.push(
      `Minimal counterexample found (${Math.round(reduction * 100)}% reduction)`
    );
  }

  return reasons;
}

// ============================================================================
// JSON REPORT GENERATION
// ============================================================================

/**
 * Generate JSON report for CI/CD integration
 */
export function generatePBTJsonReport(
  reports: PBTReport[],
  seed?: number
): PBTJsonReport {
  const timestamp = new Date().toISOString();
  const success = reports.every(r => r.success);

  let totalBehaviors = 0;
  let passedBehaviors = 0;
  let failedBehaviors = 0;
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let duration = 0;

  const behaviors: PBTJsonReport['behaviors'] = [];

  for (const report of reports) {
    totalBehaviors++;
    if (report.success) {
      passedBehaviors++;
    } else {
      failedBehaviors++;
    }

    totalTests += report.testsRun;
    passedTests += report.testsPassed;
    failedTests += report.testsRun - report.testsPassed;
    duration += report.totalDuration;

    behaviors.push({
      name: report.behaviorName,
      success: report.success,
      testsRun: report.testsRun,
      testsPassed: report.testsPassed,
      duration: report.totalDuration,
      violations: report.violations.map(v => ({
        property: v.property.name,
        type: v.property.type,
        error: v.error,
        input: v.input,
        minimalInput: v.minimalInput,
      })),
      error: report.firstFailure?.error,
    });
  }

  return {
    version: '1.0',
    timestamp,
    success,
    seed: seed ?? reports[0]?.config.seed ?? 0,
    summary: {
      totalBehaviors,
      passedBehaviors,
      failedBehaviors,
      totalTests,
      passedTests,
      failedTests,
      duration,
    },
    behaviors,
    config: {
      numTests: reports[0]?.config.numTests ?? 100,
      seed: seed ?? reports[0]?.config.seed,
      maxShrinks: reports[0]?.config.maxShrinks ?? 100,
      timeout: reports[0]?.config.timeout ?? 5000,
    },
  };
}

// ============================================================================
// CONSOLE OUTPUT
// ============================================================================

/**
 * Format PBT results for console output
 */
export function formatPBTConsoleOutput(report: PBTReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('┌─────────────────────────────────────────────────┐');
  lines.push('│          PROPERTY-BASED TEST RESULTS            │');
  lines.push('└─────────────────────────────────────────────────┘');
  lines.push('');

  const icon = report.success ? '✓' : '✗';
  const status = report.success ? 'PASSED' : 'FAILED';
  lines.push(`${icon} ${report.behaviorName}: ${status}`);
  lines.push('');

  lines.push(`Tests:     ${report.testsPassed}/${report.testsRun} passed`);
  lines.push(`Duration:  ${report.totalDuration}ms`);

  if (report.config.seed !== undefined) {
    lines.push(`Seed:      ${report.config.seed}`);
  }

  if (report.violations.length > 0) {
    lines.push('');
    lines.push('Violations:');
    for (const v of report.violations) {
      lines.push(`  ✗ [${v.property.type}] ${v.property.name}`);
      lines.push(`    ${v.error}`);
      if (v.minimalInput) {
        lines.push(`    Minimal input: ${JSON.stringify(v.minimalInput)}`);
      }
    }
  }

  if (!report.success && report.config.seed !== undefined) {
    lines.push('');
    lines.push('To reproduce:');
    lines.push(`  isl verify --pbt --pbt-seed ${report.config.seed}`);
  }

  // Add counterexample output if available
  for (const v of report.violations) {
    if (report.shrinkResult && report.firstFailure) {
      const ce = buildCounterexample(
        v.input,
        v.minimalInput ?? v.input,
        report.config.seed ?? 0,
        report.firstFailure.size,
        v.property,
        v.error,
        report.shrinkResult,
        report.behaviorName
      );
      lines.push('');
      lines.push(formatCounterexample(ce));
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  counterexampleRegistry,
  formatCounterexample,
};
