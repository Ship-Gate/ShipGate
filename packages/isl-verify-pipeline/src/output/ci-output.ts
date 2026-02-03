/**
 * CI Output Generator
 * 
 * Produces deterministic JSON output suitable for CI/CD systems.
 * Designed for machine parsing, GitHub Actions, and consistent ordering.
 * 
 * @module @isl-lang/verify-pipeline
 */

import type {
  PipelineResult,
  CIOutput,
  PipelineVerdict,
  ClauseEvidence,
  InvariantEvidence,
} from '../types.js';

// ============================================================================
// CI Output Generation
// ============================================================================

/**
 * Generate deterministic CI output from pipeline result
 */
export function generateCIOutput(result: PipelineResult): CIOutput {
  const exitCode = verdictToExitCode(result.verdict);
  const summary = generateSummary(result);
  const violations = collectViolations(result);
  const stageTiming = collectStageTiming(result);
  
  return {
    schemaVersion: '1.0.0',
    runId: result.runId,
    timestamp: result.timing.completedAt,
    verdict: result.verdict,
    exitCode,
    summary,
    score: result.score,
    counts: {
      tests: {
        total: result.summary.tests.total,
        passed: result.summary.tests.passed,
        failed: result.summary.tests.failed,
        skipped: 0,
      },
      postconditions: {
        total: result.summary.postconditions.total,
        proven: result.summary.postconditions.proven,
        violated: result.summary.postconditions.violated,
        notProven: result.summary.postconditions.notProven,
      },
      invariants: {
        total: result.summary.invariants.total,
        proven: result.summary.invariants.proven,
        violated: result.summary.invariants.violated,
        notProven: result.summary.invariants.notProven,
      },
    },
    violations,
    proofBundle: result.proofBundle ? {
      bundleId: result.proofBundle.bundleId,
      path: result.proofBundle.bundlePath,
    } : undefined,
    timing: {
      totalMs: result.timing.totalDurationMs,
      stages: stageTiming,
    },
  };
}

/**
 * Convert verdict to exit code
 */
function verdictToExitCode(verdict: PipelineVerdict): 0 | 1 | 2 {
  switch (verdict) {
    case 'PROVEN':
      return 0;
    case 'FAILED':
      return 1;
    case 'INCOMPLETE_PROOF':
      return 2;
  }
}

/**
 * Generate human-readable summary
 */
function generateSummary(result: PipelineResult): string {
  const { verdict, summary } = result;
  
  if (verdict === 'PROVEN') {
    return `✓ PROVEN: All ${summary.postconditions.total} postconditions and ${summary.invariants.total} invariants verified. Score: ${result.score}/100`;
  }
  
  if (verdict === 'FAILED') {
    const violations = summary.postconditions.violated + summary.invariants.violated;
    return `✗ FAILED: ${violations} violation(s) found. ${summary.postconditions.violated} postcondition(s), ${summary.invariants.violated} invariant(s). Score: ${result.score}/100`;
  }
  
  const notProven = summary.postconditions.notProven + summary.invariants.notProven;
  return `⚠ INCOMPLETE_PROOF: ${notProven} condition(s) could not be verified. ${summary.postconditions.proven}/${summary.postconditions.total} postconditions, ${summary.invariants.proven}/${summary.invariants.total} invariants. Score: ${result.score}/100`;
}

/**
 * Collect all violations sorted by severity
 */
function collectViolations(result: PipelineResult): CIOutput['violations'] {
  const violations: CIOutput['violations'] = [];
  
  // Collect test failures
  const testRunner = result.stages.testRunner;
  if (testRunner?.output?.suites) {
    for (const suite of testRunner.output.suites) {
      for (const test of suite.tests) {
        if (test.status === 'failed') {
          violations.push({
            type: 'test',
            message: test.error?.message || `Test failed: ${test.name}`,
          });
        }
      }
    }
  }
  
  // Collect postcondition violations
  for (const evidence of result.evidence.postconditions) {
    if (evidence.status === 'violated') {
      violations.push({
        type: 'postcondition',
        clauseId: evidence.clauseId,
        behavior: evidence.behavior,
        expression: evidence.expression,
        message: evidence.reason || `Postcondition violated: ${evidence.expression}`,
        location: evidence.sourceLocation,
      });
    }
  }
  
  // Collect invariant violations
  for (const evidence of result.evidence.invariants) {
    if (evidence.status === 'violated') {
      violations.push({
        type: 'invariant',
        clauseId: evidence.clauseId,
        behavior: evidence.behavior,
        expression: evidence.expression,
        message: evidence.reason || `Invariant violated: ${evidence.expression}`,
        location: evidence.sourceLocation,
      });
    }
  }
  
  // Sort by type (tests first, then postconditions, then invariants)
  const typeOrder = { test: 0, postcondition: 1, invariant: 2 };
  violations.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
  
  return violations;
}

/**
 * Collect stage timing information
 */
function collectStageTiming(result: PipelineResult): Record<string, number> {
  const timing: Record<string, number> = {};
  
  for (const [stageName, stageResult] of Object.entries(result.stages)) {
    if (stageResult?.durationMs !== undefined) {
      timing[stageName] = stageResult.durationMs;
    }
  }
  
  return timing;
}

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Format CI output as JSON string with deterministic ordering
 */
export function formatCIOutput(output: CIOutput): string {
  return JSON.stringify(output, null, 2);
}

/**
 * Format CI output for GitHub Actions
 */
export function formatGitHubOutput(output: CIOutput): string {
  const lines: string[] = [];
  
  // Set output variables
  lines.push(`verdict=${output.verdict}`);
  lines.push(`exit_code=${output.exitCode}`);
  lines.push(`score=${output.score}`);
  lines.push(`summary=${output.summary}`);
  
  // Annotations for violations
  for (const violation of output.violations) {
    if (violation.location) {
      const file = violation.location.file || 'unknown';
      const line = violation.location.line;
      const col = violation.location.column;
      lines.push(`::error file=${file},line=${line},col=${col}::${violation.message}`);
    } else {
      lines.push(`::error::${violation.message}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format CI output for human consumption
 */
export function formatHumanOutput(output: CIOutput): string {
  const lines: string[] = [];
  
  // Header
  lines.push('═'.repeat(60));
  lines.push(`  ISL Verification Pipeline - ${output.verdict}`);
  lines.push('═'.repeat(60));
  lines.push('');
  
  // Summary
  lines.push(output.summary);
  lines.push('');
  
  // Counts
  lines.push('─ Results ─');
  lines.push(`  Tests:          ${output.counts.tests.passed}/${output.counts.tests.total} passed`);
  lines.push(`  Postconditions: ${output.counts.postconditions.proven}/${output.counts.postconditions.total} proven`);
  lines.push(`  Invariants:     ${output.counts.invariants.proven}/${output.counts.invariants.total} proven`);
  lines.push('');
  
  // Violations
  if (output.violations.length > 0) {
    lines.push('─ Violations ─');
    for (const v of output.violations) {
      const loc = v.location 
        ? `${v.location.file || ''}:${v.location.line}:${v.location.column}` 
        : '';
      lines.push(`  ✗ [${v.type}] ${v.message}${loc ? ` (${loc})` : ''}`);
    }
    lines.push('');
  }
  
  // Timing
  lines.push('─ Timing ─');
  lines.push(`  Total: ${output.timing.totalMs}ms`);
  for (const [stage, ms] of Object.entries(output.timing.stages)) {
    lines.push(`    ${stage}: ${ms}ms`);
  }
  lines.push('');
  
  // Proof bundle
  if (output.proofBundle) {
    lines.push('─ Proof Bundle ─');
    lines.push(`  ID: ${output.proofBundle.bundleId}`);
    lines.push(`  Path: ${output.proofBundle.path}`);
    lines.push('');
  }
  
  lines.push('═'.repeat(60));
  
  return lines.join('\n');
}
