/**
 * Performance Report Generator
 * 
 * Generates human-readable performance reports.
 * 
 * @module @isl-lang/pipeline/performance
 */

import type { BenchmarkResult } from './benchmark.js';
import type { ProfileReport, Hotspot } from './profiler.js';
import type { CacheStats } from './cache.js';
import type { RegressionTestResult } from './regression.js';

// ============================================================================
// Report Generator
// ============================================================================

export class PerformanceReportGenerator {
  /**
   * Generate benchmark report
   */
  generateBenchmarkReport(results: BenchmarkResult[]): string {
    const lines: string[] = [];

    lines.push('═'.repeat(80));
    lines.push(' Performance Benchmark Report');
    lines.push('═'.repeat(80));
    lines.push('');

    for (const result of results) {
      lines.push(`Repo Size: ${result.repoSize.toUpperCase()}`);
      lines.push('─'.repeat(80));
      lines.push('');
      lines.push('Metrics:');
      lines.push(`  Parse/Check Time: ${result.metrics.parseCheckTime.toFixed(2)}ms`);
      lines.push(`  Gate Time: ${result.metrics.gateTime.toFixed(2)}ms`);
      lines.push(`  Heal Iterations Time: ${result.metrics.healIterationsTime.toFixed(2)}ms`);
      lines.push(`  Total Time: ${result.metrics.totalTime.toFixed(2)}ms`);
      lines.push(`  Memory Used: ${result.metrics.memoryUsed.toFixed(2)}MB`);
      lines.push(`  Iterations: ${result.metrics.iterations}`);
      lines.push('');
      lines.push('Breakdown:');
      lines.push(`  Parse Time: ${result.breakdown.parseTime.toFixed(2)}ms`);
      lines.push(`  Check Time: ${result.breakdown.checkTime.toFixed(2)}ms`);
      lines.push(`  Gate Violations: ${result.breakdown.gateViolations}`);
      lines.push(`  Heal Iterations: ${result.breakdown.healIterations}`);
      lines.push('');
    }

    lines.push('═'.repeat(80));

    return lines.join('\n');
  }

  /**
   * Generate hotspot report
   */
  generateHotspotReport(report: ProfileReport): string {
    const lines: string[] = [];

    lines.push('═'.repeat(80));
    lines.push(' Hotspot Profiling Report');
    lines.push('═'.repeat(80));
    lines.push('');
    lines.push(`Total Time: ${report.totalTime.toFixed(2)}ms`);
    lines.push(`Total Memory: ${report.totalMemory.toFixed(2)}MB`);
    lines.push('');
    lines.push('Top Hotspots:');
    lines.push('');

    for (let i = 0; i < report.hotspots.length; i++) {
      const hotspot = report.hotspots[i]!;
      lines.push(`${i + 1}. ${hotspot.name}`);
      lines.push(`   Total Time: ${hotspot.totalTime.toFixed(2)}ms (${hotspot.percentage.toFixed(1)}%)`);
      lines.push(`   Call Count: ${hotspot.callCount}`);
      lines.push(`   Avg Time: ${hotspot.avgTime.toFixed(2)}ms`);
      if (hotspot.stack.length > 1) {
        lines.push(`   Stack: ${hotspot.stack.join(' → ')}`);
      }
      lines.push('');
    }

    lines.push('═'.repeat(80));

    return lines.join('\n');
  }

  /**
   * Generate cache statistics report
   */
  generateCacheReport(parseStats: CacheStats, gateStats: CacheStats): string {
    const lines: string[] = [];

    lines.push('═'.repeat(80));
    lines.push(' Cache Statistics Report');
    lines.push('═'.repeat(80));
    lines.push('');

    lines.push('Parse Cache:');
    lines.push(`  Hits: ${parseStats.hits}`);
    lines.push(`  Misses: ${parseStats.misses}`);
    lines.push(`  Hit Rate: ${(parseStats.hitRate * 100).toFixed(1)}%`);
    lines.push(`  Size: ${parseStats.size}`);
    lines.push(`  Evictions: ${parseStats.evictions}`);
    lines.push('');

    lines.push('Gate Cache:');
    lines.push(`  Hits: ${gateStats.hits}`);
    lines.push(`  Misses: ${gateStats.misses}`);
    lines.push(`  Hit Rate: ${(gateStats.hitRate * 100).toFixed(1)}%`);
    lines.push(`  Size: ${gateStats.size}`);
    lines.push(`  Evictions: ${gateStats.evictions}`);
    lines.push('');

    lines.push('═'.repeat(80));

    return lines.join('\n');
  }

  /**
   * Generate regression test report
   */
  generateRegressionReport(result: RegressionTestResult): string {
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

  /**
   * Generate comprehensive report
   */
  generateComprehensiveReport(
    benchmarkResults: BenchmarkResult[],
    profileReport: ProfileReport | null,
    parseStats: CacheStats | null,
    gateStats: CacheStats | null,
    regressionResult: RegressionTestResult | null
  ): string {
    const lines: string[] = [];

    lines.push('═'.repeat(80));
    lines.push(' Comprehensive Performance Report');
    lines.push('═'.repeat(80));
    lines.push('');

    // Benchmark results
    lines.push(this.generateBenchmarkReport(benchmarkResults));
    lines.push('');

    // Hotspot report
    if (profileReport) {
      lines.push(this.generateHotspotReport(profileReport));
      lines.push('');
    }

    // Cache statistics
    if (parseStats && gateStats) {
      lines.push(this.generateCacheReport(parseStats, gateStats));
      lines.push('');
    }

    // Regression test results
    if (regressionResult) {
      lines.push(this.generateRegressionReport(regressionResult));
    }

    return lines.join('\n');
  }
}
