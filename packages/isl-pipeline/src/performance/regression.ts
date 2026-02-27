/**
 * Performance Regression Tests
 * 
 * Tests that performance stays within budgets.
 * 
 * @module @isl-lang/pipeline/performance
 */

import type { BenchmarkResult } from './benchmark.js';
import { runBenchmarkSuite } from './benchmark.js';

// ============================================================================
// Types
// ============================================================================

export interface PerformanceBudget {
  repoSize: 'small' | 'medium' | 'large';
  parseCheckTime: number; // ms
  gateTime: number; // ms
  healIterationsTime: number; // ms
  totalTime: number; // ms
  memoryUsed: number; // MB
}

export interface RegressionTestResult {
  passed: boolean;
  budgets: PerformanceBudget[];
  results: BenchmarkResult[];
  violations: BudgetViolation[];
}

export interface BudgetViolation {
  repoSize: string;
  metric: string;
  budget: number;
  actual: number;
  percentage: number;
}

// ============================================================================
// Default Performance Budgets
// ============================================================================

export const DEFAULT_BUDGETS: PerformanceBudget[] = [
  {
    repoSize: 'small',
    parseCheckTime: 100, // 100ms
    gateTime: 50, // 50ms
    healIterationsTime: 200, // 200ms
    totalTime: 350, // 350ms
    memoryUsed: 50, // 50MB
  },
  {
    repoSize: 'medium',
    parseCheckTime: 500, // 500ms
    gateTime: 300, // 300ms
    healIterationsTime: 1000, // 1s
    totalTime: 1800, // 1.8s
    memoryUsed: 200, // 200MB
  },
  {
    repoSize: 'large',
    parseCheckTime: 2000, // 2s
    gateTime: 1500, // 1.5s
    healIterationsTime: 5000, // 5s
    totalTime: 8500, // 8.5s
    memoryUsed: 500, // 500MB
  },
];

// ============================================================================
// Regression Test Runner
// ============================================================================

export class PerformanceRegressionTester {
  private budgets: PerformanceBudget[];

  constructor(budgets: PerformanceBudget[] = DEFAULT_BUDGETS) {
    this.budgets = budgets;
  }

  /**
   * Run regression tests
   */
  async run(): Promise<RegressionTestResult> {
    // Run benchmarks
    const results = await runBenchmarkSuite({
      iterations: 5,
      warmupRuns: 2,
    });

    // Check against budgets
    const violations: BudgetViolation[] = [];

    for (const result of results) {
      const budget = this.budgets.find(b => b.repoSize === result.repoSize);
      if (!budget) continue;

      const metrics = result.metrics;

      // Check parse/check time
      if (metrics.parseCheckTime > budget.parseCheckTime) {
        violations.push({
          repoSize: result.repoSize,
          metric: 'parseCheckTime',
          budget: budget.parseCheckTime,
          actual: metrics.parseCheckTime,
          percentage: (metrics.parseCheckTime / budget.parseCheckTime) * 100,
        });
      }

      // Check gate time
      if (metrics.gateTime > budget.gateTime) {
        violations.push({
          repoSize: result.repoSize,
          metric: 'gateTime',
          budget: budget.gateTime,
          actual: metrics.gateTime,
          percentage: (metrics.gateTime / budget.gateTime) * 100,
        });
      }

      // Check heal iterations time
      if (metrics.healIterationsTime > budget.healIterationsTime) {
        violations.push({
          repoSize: result.repoSize,
          metric: 'healIterationsTime',
          budget: budget.healIterationsTime,
          actual: metrics.healIterationsTime,
          percentage: (metrics.healIterationsTime / budget.healIterationsTime) * 100,
        });
      }

      // Check total time
      if (metrics.totalTime > budget.totalTime) {
        violations.push({
          repoSize: result.repoSize,
          metric: 'totalTime',
          budget: budget.totalTime,
          actual: metrics.totalTime,
          percentage: (metrics.totalTime / budget.totalTime) * 100,
        });
      }

      // Check memory usage
      if (metrics.memoryUsed > budget.memoryUsed) {
        violations.push({
          repoSize: result.repoSize,
          metric: 'memoryUsed',
          budget: budget.memoryUsed,
          actual: metrics.memoryUsed,
          percentage: (metrics.memoryUsed / budget.memoryUsed) * 100,
        });
      }
    }

    return {
      passed: violations.length === 0,
      budgets: this.budgets,
      results,
      violations,
    };
  }

  /**
   * Generate report
   */
  generateReport(result: RegressionTestResult): string {
    const lines: string[] = [];

    lines.push('═'.repeat(80));
    lines.push(' Performance Regression Test Report');
    lines.push('═'.repeat(80));
    lines.push('');

    if (result.passed) {
      lines.push('✓ All performance budgets met');
    } else {
      lines.push(`✗ ${result.violations.length} budget violation(s) detected`);
    }

    lines.push('');

    // Budget violations
    if (result.violations.length > 0) {
      lines.push('Budget Violations:');
      lines.push('');
      for (const violation of result.violations) {
        lines.push(`  [${violation.repoSize}] ${violation.metric}:`);
        lines.push(`    Budget: ${violation.budget}ms`);
        lines.push(`    Actual: ${violation.actual.toFixed(2)}ms`);
        lines.push(`    Over by: ${(violation.percentage - 100).toFixed(1)}%`);
        lines.push('');
      }
    }

    // Results summary
    lines.push('Results Summary:');
    lines.push('');
    for (const benchmarkResult of result.results) {
      lines.push(`  [${benchmarkResult.repoSize}]`);
      lines.push(`    Parse/Check: ${benchmarkResult.metrics.parseCheckTime.toFixed(2)}ms`);
      lines.push(`    Gate: ${benchmarkResult.metrics.gateTime.toFixed(2)}ms`);
      lines.push(`    Heal Iterations: ${benchmarkResult.metrics.healIterationsTime.toFixed(2)}ms`);
      lines.push(`    Total: ${benchmarkResult.metrics.totalTime.toFixed(2)}ms`);
      lines.push(`    Memory: ${benchmarkResult.metrics.memoryUsed.toFixed(2)}MB`);
      lines.push(`    Iterations: ${benchmarkResult.metrics.iterations}`);
      lines.push('');
    }

    lines.push('═'.repeat(80));

    return lines.join('\n');
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Run performance regression tests with default budgets
 */
export async function runRegressionTests(
  budgets?: PerformanceBudget[]
): Promise<RegressionTestResult> {
  const tester = new PerformanceRegressionTester(budgets);
  return tester.run();
}
